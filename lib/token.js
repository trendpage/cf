// api/_lib/token.js
// Signed access token: binds a saleId to the items bought, so /acesso can
// release only what was paid for, without a database.
//
// Env var: ACCESS_SECRET (required in production; any long random string)

import crypto from 'crypto';

const SECRET = process.env.ACCESS_SECRET || '';

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function sign(payload) {
  return b64url(crypto.createHmac('sha256', SECRET || 'dev-only-secret').update(payload).digest());
}

export function makeToken({ saleId, items }) {
  const payload = b64url(JSON.stringify({ s: saleId, i: items }));
  return `${payload}.${sign(payload)}`;
}

export function readToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = sign(payload);
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(fromB64url(payload));
    if (!data?.s || !Array.isArray(data?.i)) return null;
    return { saleId: String(data.s), items: data.i.map(String) };
  } catch {
    return null;
  }
}
