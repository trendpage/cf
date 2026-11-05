// lib/catalog.js
// SINGLE SOURCE OF TRUTH for products, prices and delivery files.
// The frontend never hardcodes prices: it reads everything from GET /api/create-pix.
//
// - amount is in CENTS (integer). MedusaPay receives reais; conversion happens in medusa.js.
// - enabled:false hides an extra from the offer without deleting it.
// - files: PDFs released on /acesso after the payment is confirmed (folder /materiais).

export const MAIN = {
  id: 'GUIA',
  title: '+150 Guias Visuais de CFTV, Alarmes e Segurança Eletrônica',
  // Text sent to the gateway (short and recognizable: reduces MED).
  gatewayTitle: 'Guias Visuais CFTV - material digital',
  amount: 2990,
  includes: ['+150 Guias Visuais (2 PDFs)', 'Bônus: 10 Projetos Visuais Prontos', 'Bônus: Calculadora Visual do Instalador', 'Bônus: Kit Profissional de Instalação e Entrega'],
  files: [
    { label: '+150 Guias Visuais · Parte 1', path: '/materiais/150-guias-visuais-cftv-parte-1-2776ad6c.pdf' },
    { label: '+150 Guias Visuais · Parte 2', path: '/materiais/150-guias-visuais-cftv-parte-2-2776ad6c.pdf' },
    { label: 'Bônus · 10 Projetos Visuais Prontos', path: '/materiais/bonus-10-projetos-visuais-2776ad6c.pdf' },
    { label: 'Bônus · Calculadora Visual do Instalador', path: '/materiais/bonus-calculadora-visual-instalador-2776ad6c.pdf' },
    { label: 'Bônus · Kit Profissional de Instalação e Entrega', path: '/materiais/bonus-kit-instalacao-e-entrega-2776ad6c.pdf' },
  ],
};

export const BUMPS = [
  {
    id: 'DIAGNOSTICO',
    enabled: true,
    title: 'Diagnóstico Visual de CFTV',
    description: '50 diagnósticos: imagem, fonte, gravação, acesso remoto, alarmes e fechaduras. Sintoma, causa e teste rápido em cada página.',
    amount: 1490,
    files: [{ label: 'Diagnóstico Visual de CFTV', path: '/materiais/diagnostico-visual-cftv-2776ad6c.pdf' }],
  },
  {
    id: 'INTERFONIA',
    enabled: true,
    title: 'Guia Visual de Interfonia e Vídeo Porteiro',
    description: '50 guias visuais de interfone, vídeo porteiro e fechadura. Mais um serviço para oferecer ao mesmo cliente.',
    amount: 1290,
    files: [{ label: 'Guia Visual de Interfonia e Vídeo Porteiro', path: '/materiais/guia-visual-interfonia-video-porteiro-2776ad6c.pdf' }],
  },
  {
    id: 'CONTROLE_ACESSO',
    enabled: true,
    title: 'Guia Visual de Controle de Acesso',
    description: '50 guias de leitoras, controladoras, fechaduras e botoeiras: como o sistema funciona, onde usar e como ligar.',
    amount: 1290,
    files: [{ label: 'Guia Visual de Controle de Acesso', path: '/materiais/guia-visual-controle-de-acesso-2776ad6c.pdf' }],
  },
];

export function activeBumps() {
  return BUMPS.filter((b) => b.enabled);
}

// Resolves bump ids from the browser into trusted catalog items.
// Unknown or disabled ids are dropped: the browser never sets prices.
export function resolveOrder(rawBumps) {
  const wanted = Array.isArray(rawBumps) ? rawBumps.map((x) => String(x).toUpperCase()) : [];
  const bumps = activeBumps().filter((b) => wanted.includes(b.id));
  const amount = MAIN.amount + bumps.reduce((sum, b) => sum + b.amount, 0);
  return { items: [MAIN.id, ...bumps.map((b) => b.id)], bumps, amount };
}

export function filesForItems(itemIds) {
  const ids = Array.isArray(itemIds) ? itemIds : [];
  const out = [];
  if (ids.includes(MAIN.id)) out.push(...MAIN.files);
  for (const b of BUMPS) if (ids.includes(b.id)) out.push(...b.files);
  return out;
}

export function formatBRL(cents) {
  return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',');
}

// Public shape consumed by the frontend (no file paths before payment).
export function publicCatalog() {
  return {
    main: { id: MAIN.id, title: MAIN.title, includes: MAIN.includes, amount: MAIN.amount, price: formatBRL(MAIN.amount) },
    bumps: activeBumps().map((b) => ({ id: b.id, title: b.title, description: b.description, amount: b.amount, price: formatBRL(b.amount) })),
  };
}
