/* Aplica o tema salvo antes da pintura, para a página não "piscar". */
(function () {
  try {
    var s = JSON.parse(localStorage.getItem('atlas:v1') || '{}');
    if (s.settings && s.settings.theme) document.documentElement.dataset.theme = s.settings.theme;
  } catch (e) {}
})();
