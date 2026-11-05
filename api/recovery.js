// api/recovery.js
// Called by QStash ~90s after the PIX is generated.
//   - still PENDENTE  -> sends "pix_notpaid" to Integrax (SMS recovery)
//   - PAGO            -> sends "pix_paid" with the access link, only if DELIVERY_SMS=on
//                        (covers the buyer who pays in the bank app and closes the tab)
//
// Env vars: RECOVERY_SECRET, INTEGRAX_AUTOMATION_URL, DELIVERY_SMS (optional: "on")

import { getStatus } from './_lib/medusa.js';

async function sendIntegrax(payload) {
  const url = process.env.INTEGRAX_AUTOMATION_URL;
  if (!url) {
    console.error('[recovery] INTEGRAX_AUTOMATION_URL não configurada');
    return { ok: false };
  }
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await r.text().catch(() => '');
  console.log(`[recovery] ${payload.event} | http:${r.status} | ${text.slice(0, 160)}`);
  return { ok: r.ok };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  const secret = process.env.RECOVERY_SECRET;
  if (secret && req.headers['x-recovery-key'] !== secret) {
    console.warn('[recovery] chave inválida');
    return res.status(401).json({ message: 'Não autorizado' });
  }

  try {
    const { saleId, phone, name, checkout, access } = req.body || {};
    if (!saleId || !phone) return res.status(200).json({ skipped: 'payload incompleto' });

    let status = 'PENDENTE';
    try {
      status = await getStatus(saleId);
    } catch (e) {
      console.warn('[recovery] status indisponível, assumindo pendente:', e.message || e);
    }

    if (status === 'PAGO') {
      if ((process.env.DELIVERY_SMS || '').toLowerCase() !== 'on') {
        return res.status(200).json({ skipped: 'pago' });
      }
      const r = await sendIntegrax({ event: 'pix_paid', phone, name: name || '', access: access || '' });
      return res.status(200).json({ delivered: r.ok });
    }

    if (status !== 'PENDENTE') return res.status(200).json({ skipped: status });

    const r = await sendIntegrax({ event: 'pix_notpaid', phone, name: name || '', checkout: checkout || '' });
    return res.status(200).json({ sent: r.ok });
  } catch (err) {
    console.error('[recovery] erro:', err.message || err);
    return res.status(200).json({ error: true });
  }
}
