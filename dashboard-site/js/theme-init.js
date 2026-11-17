/* Apply saved theme and accent before first paint to avoid a flash */
(function () {
  var root = document.documentElement;
  try {
    var saved = JSON.parse(localStorage.getItem('dash.theme'));
    var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    var acc = JSON.parse(localStorage.getItem('dash.accent'));
    if (acc) root.setAttribute('data-accent', acc);
    var nm = JSON.parse(localStorage.getItem('dash.name'));
    if (!nm || typeof nm !== 'string') root.setAttribute('data-welcome', '');
  } catch (e) {
    root.setAttribute('data-theme', 'light');
    root.setAttribute('data-welcome', '');
  }
})();
