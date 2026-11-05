// api/access.js
// GET /api/access?pedido=<saleId>&t=<token>
// Verifies the signed token AND that MedusaPay confirms the payment,
// then returns the files for the items in that order.
//
// Responses:
//   200 { status: "PAGO", files: [{label, path}] }
//   200 { status: "PENDENTE" }            -> page keeps polling
//   403 { message }                       -> invalid/forged link

import { readToken } from './_lib/token.js';
import { getStatus } from './_lib/medusa.js';
import { filesForItems } from './_lib/catalog.js';
import { cors } from './_lib/site.js';

export default async function handler(req, res) {
  cors(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ message: 'Método não permitido' });
  res.setHeader('Cache-Control', 'no-store');

  const { pedido, t } = req.query;
  const data = readToken(t);
  if (!data || data.saleId !== String(pedido || '')) {
    return res.status(403).json({ message: 'Link de acesso inválido.' });
  }

  try {
    const status = await getStatus(data.saleId);
    if (status !== 'PAGO') return res.status(200).json({ status });
    return res.status(200).json({ status, files: filesForItems(data.items) });
  } catch (err) {
    console.error('[access] erro:', err.message || err);
    return res.status(200).json({ status: 'PENDENTE' });
  }
}
