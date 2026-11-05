/* assets/blog.js — prices from backend + sticky CTA. Prices are never hardcoded:
 * every [data-price="main"] starts as "—" and is filled from GET /api/create-pix. */
(function () {
  'use strict';
  fetch('/api/create-pix', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.main) return;
      document.querySelectorAll('[data-price="main"]').forEach(function (el) { el.textContent = d.main.price; });
    })
    .catch(function () {});

  var bar = document.querySelector('.sticky-cta');
  if (!bar) return;
  var finalCta = document.querySelector('.cta-final');
  function onScroll() {
    var y = window.scrollY, h = document.documentElement.scrollHeight - window.innerHeight;
    var nearFinal = false;
    if (finalCta) {
      var r = finalCta.getBoundingClientRect();
      nearFinal = r.top < window.innerHeight && r.bottom > 0;
    }
    bar.classList.toggle('show', h > 0 && y / h > 0.18 && !nearFinal);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
