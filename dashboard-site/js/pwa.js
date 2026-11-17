/* Install as an app + offline support */
(function () {
  'use strict';
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  var box = document.getElementById('installBox'), btn = document.getElementById('installBtn'), deferred = null;
  if (!box || !btn) return;
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  if (standalone) return;
  if (ios) { box.hidden = false; btn.hidden = true; document.getElementById('installNote').textContent = 'On iPhone: tap the Share button, then Add to Home Screen.'; }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; box.hidden = false; btn.hidden = false; });
  btn.addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function () { deferred = null; box.hidden = true; });
  });
  window.addEventListener('appinstalled', function () { box.hidden = true; });
})();
