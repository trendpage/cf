// GET /api/check-status/:id  -> { status: PAGO | PENDENTE | RECUSADO | ESTORNADO }
// Polled by the checkout every 5s. On any error it answers PENDENTE and polling continues.

import { getStatus } from '../../lib/medusa.js';
import { json } from '../../lib/http.js';

export const config = { path: '/api/check-status/:id' };

export default async (req, context) => {
  if (req.method !== 'GET') return json(405, { message: 'Método não permitido' });
  const id = String(context?.params?.id || '');
  // MedusaPay ids are UUID strings: no numeric validation.
  if (id.length < 6 || id.length > 80) return json(400, { message: 'ID inválido' });
  try {
    return json(200, { status: await getStatus(id) });
  } catch (err) {
    console.error('[check-status] erro:', err.message || err);
    return json(200, { status: 'PENDENTE' });
  }
};
