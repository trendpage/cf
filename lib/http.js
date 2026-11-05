// lib/http.js — small helpers for Netlify Functions (Web Request/Response API).

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// Public site address, without trailing slash (avoids "//api/recovery").
// SITE_URL wins; otherwise Netlify's built-in URL; otherwise the request origin.
export function siteUrl(req) {
  const env = (process.env.SITE_URL || process.env.URL || '').trim().replace(/\/+$/, '');
  if (env) return env;
  try {
    return new URL(req.url).origin;
  } catch {
    return '';
  }
}
