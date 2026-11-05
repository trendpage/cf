// lib/medusa.js
// MedusaPay adapter. Every gateway-specific detail lives here, so switching
// or adjusting the gateway never touches the rest of the site.
//
// Env vars:
//   MEDUSAPAY_API_KEY   (required)  Bearer key "mk_live_..."  (also accepts MEDUSA_API_KEY / MEDUSAPAY_KEY)
//   MEDUSAPAY_BASE_URL  (optional)  default https://api.medusapayoficial.pro/api/v1
//
// >>> Before going live, compare the 3 marked points (PATH, BODY, RESPONSE)
// >>> with the create-pix of the site currently running on MedusaPay.

import crypto from 'crypto';

// trim(): a key pasted with a space or line break would silently break auth.
const KEY = String(process.env.MEDUSAPAY_API_KEY || process.env.MEDUSA_API_KEY || process.env.MEDUSAPAY_KEY || '').trim();
const BASE = String(process.env.MEDUSAPAY_BASE_URL || 'https://api.medusapayoficial.pro/api/v1').trim().replace(/\/+$/, '');

// [PATH] payments endpoint
const PAYMENTS_PATH = '/api/pagamentos';

export function isConfigured() {
  return Boolean(KEY);
}

// Safe diagnostics: never returns the key itself.
export function diagnostics() {
  return {
    chave_medusapay_encontrada: Boolean(KEY),
    chave_comeca_com_mk: KEY.startsWith('mk_'),
    chave_tamanho: KEY.length,
    endereco_api: `${BASE}${PAYMENTS_PATH}`,
  };
}

function headers() {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${KEY}`,
  };
}

// Creates a PIX charge. amountCents is converted to reais (MedusaPay uses float BRL).
export async function createPix({ name, email, cpf, amountCents, product }) {
  const body = {
    // [BODY]
    clienteNome: name,
    clienteEmail: email,
    clienteCpf: cpf,
    valor: Number((amountCents / 100).toFixed(2)),
    metodo: 'PIX',
    produto: String(product).slice(0, 200),
    idempotencyKey: crypto.randomUUID(),
  };

  const r = await fetch(`${BASE}${PAYMENTS_PATH}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    const err = new Error(data?.message || `MedusaPay HTTP ${r.status}`);
    err.status = r.status;
    err.payload = data;
    throw err;
  }

  // [RESPONSE] tolerant parsing
  const saleId = data?.venda?.id ?? data?.pagamento?.id ?? data?.id ?? null;
  const pixCode = data?.pixCopiaECola ?? data?.venda?.pixCopiaECola ?? data?.pix?.copiaECola ?? null;
  const qrCode = data?.pixQrCode ?? data?.venda?.pixQrCode ?? data?.pix?.qrCode ?? null;

  if (!saleId || !pixCode) {
    const err = new Error('PIX not returned by gateway');
    err.payload = data;
    throw err;
  }

  let qr = qrCode || null;
  if (qr && !qr.startsWith('data:') && !qr.startsWith('http')) qr = `data:image/png;base64,${qr}`;

  return { saleId: String(saleId), pixCode, qrCode: qr };
}

// Returns normalized status: PAGO | PENDENTE | RECUSADO | ESTORNADO
export async function getStatus(saleId) {
  if (!KEY) return 'PENDENTE';
  const r = await fetch(`${BASE}${PAYMENTS_PATH}/${encodeURIComponent(saleId)}`, { headers: headers() });
  if (!r.ok) return 'PENDENTE';
  const data = await r.json().catch(() => ({}));
  const raw = data?.status ?? data?.venda?.status ?? data?.pagamento?.status ?? '';
  return mapStatus(raw);
}

export function mapStatus(raw) {
  switch (String(raw || '').toLowerCase()) {
    case 'aprovado':
    case 'pago':
    case 'paid':
    case 'approved':
      return 'PAGO';
    case 'recusado':
    case 'refused':
      return 'RECUSADO';
    case 'estornado':
    case 'refunded':
      return 'ESTORNADO';
    default:
      return 'PENDENTE';
  }
}
