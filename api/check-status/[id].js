// api/check-status/[id].js
// Polled by the checkout every 5s. Returns { status: PAGO | PENDENTE | RECUSADO | ESTORNADO }.
// Never throws to the client: on any error it answers PENDENTE and polling continues.

import { getStatus } from '../_lib/medusa.js';
import { cors } from '../_lib/site.js';

export default async function handler(req, res) {
  cors(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ message: 'Método não permitido' });

  res.setHeader('Cache-Control', 'no-store');
  const { id } = req.query;
  // MedusaPay ids are UUID strings: no numeric validation.
  if (!id || typeof id !== 'string' || id.length < 6 || id.length > 80) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  try {
    return res.status(200).json({ status: await getStatus(id) });
  } catch (err) {
    console.error('[check-status] erro:', err.message || err);
    return res.status(200).json({ status: 'PENDENTE' });
  }
}
