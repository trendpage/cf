// api/create-pix.js
//
// GET  /api/create-pix          -> public catalog (main product + active bumps, prices from backend)
// POST /api/create-pix          -> creates the PIX on MedusaPay for main product + selected bumps
//
// POST body:
// {
//   customer: { name, email, phone, cpf },
//   bumps: ["BIBLIOTECA", "ORCAMENTO"],
//   quiz: { perfil, sistema, objetivo },
//   origem, artigo, utm: { source, medium, campaign, term, content, gclid }
// }

import { MAIN, publicCatalog, resolveOrder, formatBRL } from './_lib/catalog.js';
import { createPix, isConfigured } from './_lib/medusa.js';
import { makeToken } from './_lib/token.js';
import { siteUrl, cors } from './_lib/site.js';

function validCpf(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(cpf[10]);
}

const clean = (v, max = 60) => String(v || '').replace(/[^\w\-áéíóúâêôãõç ]/gi, '').slice(0, max);

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(publicCatalog());
  }

  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  const { customer = {}, bumps = [], quiz = {}, origem = '', artigo = '', utm = {} } = req.body || {};

  const name = String(customer.name || '').trim().replace(/\s+/g, ' ');
  const email = String(customer.email || '').trim().toLowerCase();
  const cpf = String(customer.cpf || '').replace(/\D/g, '');
  const phone = String(customer.phone || '').replace(/\D/g, '');

  const errs = [];
  if (name.length < 5 || !name.includes(' ')) errs.push('nome completo');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) errs.push('e-mail');
  if (!validCpf(cpf)) errs.push('CPF');
  if (!/^\d{10,11}$/.test(phone)) errs.push('WhatsApp');
  if (errs.length) return res.status(422).json({ message: 'Confira: ' + errs.join(', ') });

  if (!isConfigured()) {
    console.error('[create-pix] MEDUSAPAY_API_KEY não configurada');
    return res.status(500).json({ message: 'Pagamento indisponível no momento. Tente em instantes.' });
  }

  const order = resolveOrder(bumps);

  try {
    const pix = await createPix({
      name,
      email,
      cpf,
      amountCents: order.amount,
      product: order.bumps.length ? `${MAIN.gatewayTitle} + ${order.bumps.length} extra(s)` : MAIN.gatewayTitle,
    });

    const token = makeToken({ saleId: pix.saleId, items: order.items });
    const base = siteUrl(req);
    const accessUrl = `${base}/acesso?pedido=${encodeURIComponent(pix.saleId)}&t=${encodeURIComponent(token)}`;

    // One structured line per order: lets you cross quiz answers x ad group x revenue in Vercel logs.
    console.log(
      '[venda]',
      JSON.stringify({
        saleId: pix.saleId,
        valor: order.amount,
        itens: order.items,
        perfil: clean(quiz.perfil),
        sistema: clean(quiz.sistema),
        objetivo: clean(quiz.objetivo),
        origem: clean(origem),
        artigo: clean(artigo, 80),
        utm_campaign: clean(utm.campaign, 80),
        utm_term: clean(utm.term, 80),
        gclid: Boolean(utm.gclid),
      })
    );

    try {
      await scheduleRecovery({ saleId: pix.saleId, name, phone, base, accessUrl, checkoutUrl: `${base}/checkout` });
    } catch (e) {
      console.error('[create-pix] recovery não agendado (PIX segue ok):', e.message || e);
    }

    return res.status(200).json({
      saleId: pix.saleId,
      amount: order.amount,
      price: formatBRL(order.amount),
      items: order.items,
      token,
      accessUrl,
      pix: { key: pix.pixCode, qrCodeBase64: pix.qrCode },
    });
  } catch (err) {
    console.error('[create-pix] erro MedusaPay:', err.status || '', err.message, JSON.stringify(err.payload || {}).slice(0, 400));
    return res.status(400).json({ message: 'Não foi possível gerar o PIX. Tente novamente.' });
  }
}

// SMS recovery via QStash -> /api/recovery (~90s after PIX generation).
// Dedup by phone: several PIX generations by the same person collapse into one job.
async function scheduleRecovery({ saleId, name, phone, base, accessUrl, checkoutUrl }) {
  const token = process.env.QSTASH_TOKEN;
  if (!token || !base || !phone) {
    console.warn('[create-pix] QStash não agendado: falta QSTASH_TOKEN, SITE_URL ou telefone');
    return;
  }
  const qstashBase = (process.env.QSTASH_URL || 'https://qstash.upstash.io').replace(/\/+$/, '');
  const delay = process.env.RECOVERY_DELAY || '90s';
  const secret = process.env.RECOVERY_SECRET || '';

  const r = await fetch(`${qstashBase}/v2/publish/${base}/api/recovery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Upstash-Delay': delay,
      'Upstash-Retries': '0',
      'Upstash-Deduplication-Id': `recovery-${phone}`,
      ...(secret ? { 'Upstash-Forward-X-Recovery-Key': secret } : {}),
    },
    body: JSON.stringify({ saleId, name, phone, checkout: checkoutUrl, access: accessUrl }),
  });

  if (r.ok) console.log(`[create-pix] recovery agendado | sale:${saleId} | delay:${delay}`);
  else console.error(`[create-pix] QStash falhou | sale:${saleId} | http:${r.status}`);
}
