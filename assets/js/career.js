(function () {
  var input = document.getElementById("wall-lookup");
  if (!input) return;

  var rows = Array.prototype.slice.call(document.querySelectorAll("#wall-results .wall-row"));
  var hint = document.getElementById("wall-hint");

  function filter() {
    var q = (input.value || "").trim().toLowerCase();
    var any = false;
    rows.forEach(function (r) {
      var isPerson = r.classList.contains("wall-row--person");
      var show = false;
      if (q.length > 0) {
        if (isPerson) {
          var hex = (r.getAttribute("data-hex") || "").toLowerCase();
          show = hex === q;
        } else {
          var hay = (
            (r.getAttribute("data-title") || "") +
            " " +
            (r.getAttribute("data-exam") || "")
          ).toLowerCase();
          show = hay.indexOf(q) !== -1;
        }
      }
      r.hidden = !show;
      if (show) any = true;
    });
    if (hint) hint.hidden = q.length > 0;
  }

  input.addEventListener("input", filter);
})();
