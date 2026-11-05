// api/_lib/catalog.js
// SINGLE SOURCE OF TRUTH for products, prices and delivery files.
// The frontend never hardcodes prices: it reads everything from GET /api/create-pix.
//
// - amount is in CENTS (integer). MedusaPay receives reais; conversion happens in medusa.js.
// - enabled:false hides an item from the offer without deleting it.
// - files: paths of the PDFs delivered on /acesso after payment is confirmed.
//   Upload the PDFs to /materiais with exactly these names.

export const MAIN = {
  id: 'GUIA',
  title: 'Guia Visual do Instalador CFTV',
  // Text sent to the gateway (keep short and recognizable: reduces MED).
  gatewayTitle: 'Guia Visual CFTV - material digital',
  amount: 2990,
  files: [
    { label: 'Guia Visual do Instalador CFTV (PDF)', path: '/materiais/guia-visual-instalador-cftv.pdf' },
  ],
};

export const BUMPS = [
  {
    id: 'BIBLIOTECA',
    enabled: true,
    title: 'Biblioteca +150 Guias Visuais',
    description: 'Câmeras, DVR/NVR, cabos, PoE, rede, gravação e alarmes. Um assunto por página para consultar em campo.',
    amount: 1790,
    files: [{ label: 'Biblioteca +150 Guias Visuais (PDF)', path: '/materiais/biblioteca-guias-visuais-cftv.pdf' }],
  },
  {
    id: 'ORCAMENTO',
    enabled: true,
    title: 'Kit Orçamento e Precificação',
    description: 'Tabela de referência de preços, modelo de orçamento, checklist de visita técnica e termo de entrega.',
    amount: 1490,
    files: [{ label: 'Kit Orçamento e Precificação (PDF)', path: '/materiais/kit-orcamento-precificacao-cftv.pdf' }],
  },
  {
    id: 'CALCULOS',
    enabled: true,
    title: 'Tabelas de Cálculo do Instalador',
    description: 'HD e dias de gravação, fonte e queda de tensão, distância de cabo e PoE, prontos para usar no orçamento.',
    amount: 990,
    files: [{ label: 'Tabelas de Cálculo do Instalador (PDF)', path: '/materiais/tabelas-calculo-instalador-cftv.pdf' }],
  },
];

export function activeBumps() {
  return BUMPS.filter((b) => b.enabled);
}

// Resolves a list of bump ids coming from the browser into trusted catalog items.
// Unknown or disabled ids are silently dropped: the browser never sets prices.
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

// Public shape consumed by the frontend (no file paths exposed before payment).
export function publicCatalog() {
  return {
    main: { id: MAIN.id, title: MAIN.title, amount: MAIN.amount, price: formatBRL(MAIN.amount) },
    bumps: activeBumps().map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      amount: b.amount,
      price: formatBRL(b.amount),
    })),
  };
}
