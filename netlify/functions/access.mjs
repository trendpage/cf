// GET /api/access?pedido=<saleId>&t=<token>
// Checks the signed token AND that MedusaPay confirms the payment, then returns the files of that order.
//   200 { status:"PAGO", files:[{label,path}] } | 200 { status:"PENDENTE" } | 403 invalid link

import { readToken } from '../../lib/token.js';
import { getStatus } from '../../lib/medusa.js';
import { filesForItems } from '../../lib/catalog.js';
import { json } from '../../lib/http.js';

export const config = { path: '/api/access' };

export default async (req) => {
  if (req.method !== 'GET') return json(405, { message: 'Método não permitido' });
  const q = new URL(req.url).searchParams;
  const data = readToken(q.get('t'));
  if (!data || data.saleId !== String(q.get('pedido') || '')) return json(403, { message: 'Link de acesso inválido.' });

  try {
    const status = await getStatus(data.saleId);
    if (status !== 'PAGO') return json(200, { status });
    return json(200, { status, files: filesForItems(data.items) });
  } catch (err) {
    console.error('[access] erro:', err.message || err);
    return json(200, { status: 'PENDENTE' });
  }
};
