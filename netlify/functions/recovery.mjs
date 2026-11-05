// POST /api/recovery — called by QStash ~90s after the PIX is generated.
//   PENDENTE -> sends "pix_notpaid" to Integrax (SMS recovery)
//   PAGO     -> sends "pix_paid" with the access link, only if DELIVERY_SMS=on
//               (covers the buyer who pays in the bank app and closes the tab)

import { getStatus } from '../../lib/medusa.js';
import { json, readJson } from '../../lib/http.js';

export const config = { path: '/api/recovery' };

async function sendIntegrax(payload) {
  const url = process.env.INTEGRAX_AUTOMATION_URL;
  if (!url) {
    console.error('[recovery] INTEGRAX_AUTOMATION_URL não configurada');
    return { ok: false };
  }
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const text = await r.text().catch(() => '');
  console.log(`[recovery] ${payload.event} | http:${r.status} | ${text.slice(0, 160)}`);
  return { ok: r.ok };
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { message: 'Método não permitido' });

  const secret = process.env.RECOVERY_SECRET;
  if (secret && req.headers.get('x-recovery-key') !== secret) {
    console.warn('[recovery] chave inválida');
    return json(401, { message: 'Não autorizado' });
  }

  try {
    const { saleId, phone, name, checkout, access } = await readJson(req);
    if (!saleId || !phone) return json(200, { skipped: 'payload incompleto' });

    let status = 'PENDENTE';
    try {
      status = await getStatus(saleId);
    } catch (e) {
      console.warn('[recovery] status indisponível, assumindo pendente:', e.message || e);
    }

    if (status === 'PAGO') {
      if ((process.env.DELIVERY_SMS || '').toLowerCase() !== 'on') return json(200, { skipped: 'pago' });
      const r = await sendIntegrax({ event: 'pix_paid', phone, name: name || '', access: access || '' });
      return json(200, { delivered: r.ok });
    }
    if (status !== 'PENDENTE') return json(200, { skipped: status });

    const r = await sendIntegrax({ event: 'pix_notpaid', phone, name: name || '', checkout: checkout || '' });
    return json(200, { sent: r.ok });
  } catch (err) {
    console.error('[recovery] erro:', err.message || err);
    return json(200, { error: true });
  }
};
