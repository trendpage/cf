// api/_lib/site.js
// Normalized site URL (strips trailing slash: avoids "//api/recovery").

export function siteUrl(req) {
  const env = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (env) return env;
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host || '';
  return host ? `https://${host}` : '';
}

export function cors(res, methods = 'GET, POST, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
