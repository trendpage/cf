/* assets/config.js
 * SITE SETTINGS — the only file you need to edit to change company data,
 * contact and Google Ads tracking. Loaded by every page.
 */
window.SITE = {
  brand: 'Guia CFTV Prático',

  // Company that receives the PIX. Shown ONLY in Termos de Uso and Política de Privacidade
  // (Decreto 7.962/2013 requires name and CNPJ to be visible on the site).
  // The PIX name in the buyer's bank app comes from this CNPJ's bank account.
  companyName: 'RAZÃO SOCIAL LTDA',
  cnpj: '00.000.000/0001-00',
  email: 'contato@seudominio.com.br',
  whatsapp: '', // digits only, e.g. 5511999999999 (leave empty to hide)

  // Google Ads conversion (leave empty to disable all Google tags).
  gadsId: '',     // e.g. 'AW-123456789'
  gadsLabel: '',  // e.g. 'AbCdEfGhIjk'
};

(function () {
  var S = window.SITE;

  // Footer / legal placeholders: any element with data-site="field" receives the value.
  function fill() {
    var nodes = document.querySelectorAll('[data-site]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-site');
      if (S[key]) nodes[i].textContent = S[key];
    }
    var y = document.querySelectorAll('[data-year]');
    for (var j = 0; j < y.length; j++) y[j].textContent = new Date().getFullYear();
    var wa = document.querySelectorAll('[data-whatsapp]');
    for (var k = 0; k < wa.length; k++) {
      if (S.whatsapp) { wa[k].href = 'https://wa.me/' + S.whatsapp; wa[k].hidden = false; }
      else wa[k].hidden = true;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill);
  else fill();

  // Keep ad-click data across blog -> checkout (first touch wins within the session).
  try {
    var p = new URLSearchParams(location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'];
    var stored = JSON.parse(sessionStorage.getItem('cftv_utm') || '{}');
    var changed = false;
    keys.forEach(function (k) { if (p.get(k) && !stored[k]) { stored[k] = p.get(k); changed = true; } });
    if (changed) sessionStorage.setItem('cftv_utm', JSON.stringify(stored));
  } catch (e) {}

  // Google Ads base tag (only when configured).
  if (S.gadsId) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + S.gadsId;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', S.gadsId);
  }
})();
