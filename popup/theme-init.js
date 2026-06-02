(function () {
  try {
    var t = localStorage.getItem("cos-theme");
    if (t === "dark" || t === "light") {
      document.documentElement.dataset.theme = t;
    } else {
      delete document.documentElement.dataset.theme;
    }
  } catch (e) {}
})();
