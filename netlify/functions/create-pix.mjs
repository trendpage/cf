// GET  /api/create-pix  -> public catalog (main product + active extras, prices from backend)
// POST /api/create-pix  -> creates the PIX on MedusaPay for main product + selected extras
//
// POST body: { customer:{name,email,phone,cpf}, bumps:[ids], quiz:{perfil,sistema,objetivo}, origem, artigo, utm:{...} }

import { MAIN, publicCatalog, resolveOrder, formatBRL } from '../../lib/catalog.js';
import { createPix, isConfigured, diagnostics } from '../../lib/medusa.js';
import { makeToken } from '../../lib/token.js';
import { json, readJson, siteUrl } from '../../lib/http.js';

export const config = { path: '/api/create-pix' };

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

export default async (req) => {
  try {
    return await handle(req);
  } catch (err) {
    // Any unexpected crash still answers JSON, with the reason in the function log.
    console.error('[create-pix] erro inesperado:', err && err.stack ? err.stack : err);
    return json(500, { message: 'Erro interno ao gerar o PIX. Tente novamente.', codigo: 'ERRO_INTERNO' });
  }
};

async function handle(req) {
  if (req.method === 'GET') {
    // /api/create-pix?diag=1 -> shows whether the env vars reached the function (no secrets exposed)
    if (new URL(req.url).searchParams.get('diag') === '1') {
      return json(200, {
        ...diagnostics(),
        access_secret_encontrado: Boolean(process.env.ACCESS_SECRET),
        qstash_encontrado: Boolean(process.env.QSTASH_TOKEN),
        integrax_encontrado: Boolean(process.env.INTEGRAX_AUTOMATION_URL),
      });
    }
    return json(200, publicCatalog());
  }
  if (req.method !== 'POST') return json(405, { message: 'Método não permitido' });

  const { customer = {}, bumps = [], quiz = {}, origem = '', artigo = '', utm = {} } = await readJson(req);

  const name = String(customer.name || '').trim().replace(/\s+/g, ' ');
  const email = String(customer.email || '').trim().toLowerCase();
  const cpf = String(customer.cpf || '').replace(/\D/g, '');
  const phone = String(customer.phone || '').replace(/\D/g, '');

  const errs = [];
  if (name.length < 5 || !name.includes(' ')) errs.push('nome completo');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) errs.push('e-mail');
  if (!validCpf(cpf)) errs.push('CPF');
  if (!/^\d{10,11}$/.test(phone)) errs.push('WhatsApp');
  if (errs.length) return json(422, { message: 'Confira: ' + errs.join(', ') });

  if (!isConfigured()) {
    console.error('[create-pix] MEDUSAPAY_API_KEY não configurada (ou sem escopo Functions / sem novo deploy)');
    return json(500, { message: 'Pagamento indisponível no momento. Tente em instantes.', codigo: 'SEM_CHAVE_MEDUSAPAY' });
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

    // One structured line per order: crosses quiz answers x ad group x revenue in the function logs.
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

    return json(200, {
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
    return json(400, { message: 'Não foi possível gerar o PIX. Tente novamente.', codigo: 'MEDUSAPAY_RECUSOU', http_gateway: err.status || null });
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
