// POST /api/webhook — optional MedusaPay postback. Configure in the MedusaPay panel as
//   https://<your-site>/api/webhook
// The payload is NOT trusted: the sale id is re-checked against the MedusaPay API.

import { getStatus } from '../../lib/medusa.js';
import { json, readJson } from '../../lib/http.js';

export const config = { path: '/api/webhook' };

export default async (req) => {
  if (req.method !== 'POST') return json(200, { ok: true });
  try {
    const body = await readJson(req);
    const saleId = body?.venda?.id ?? body?.data?.id ?? body?.pagamento?.id ?? body?.id ?? null;
    if (!saleId) {
      console.warn('[webhook] sem id:', JSON.stringify(body).slice(0, 300));
      return json(200, { ok: true });
    }
    if (body?.simulada === true || body?.venda?.simulada === true) return json(200, { ok: true });
    const status = await getStatus(String(saleId));
    console.log(`[webhook] ${saleId} | evento:${body?.event || body?.evento || '-'} | status confirmado:${status}`);
    return json(200, { ok: true });
  } catch (err) {
    console.error('[webhook] erro:', err.message || err);
    return json(200, { ok: true });
  }
};
