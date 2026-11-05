// api/webhook.js
// Optional postback receiver. Configure in the MedusaPay panel as:
//   https://<your-site>/api/webhook
//
// The payload is NOT trusted: the sale id is re-checked against the MedusaPay API
// before anything is logged as paid. Polling remains the primary confirmation path.

import { getStatus } from './_lib/medusa.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  try {
    const body = req.body || {};
    const saleId = body?.venda?.id ?? body?.data?.id ?? body?.pagamento?.id ?? body?.id ?? null;
    if (!saleId) {
      console.warn('[webhook] sem id:', JSON.stringify(body).slice(0, 300));
      return res.status(200).json({ ok: true });
    }
    if (body?.simulada === true || body?.venda?.simulada === true) {
      console.log(`[webhook] venda simulada ignorada | ${saleId}`);
      return res.status(200).json({ ok: true });
    }
    const status = await getStatus(String(saleId));
    console.log(`[webhook] ${saleId} | evento:${body?.event || body?.evento || '-'} | status confirmado:${status}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[webhook] erro:', err.message || err);
    return res.status(200).json({ ok: true });
  }
}
