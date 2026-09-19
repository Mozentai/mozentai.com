(function () {
  var input = document.getElementById("wall-lookup");
  if (!input) return;

  var rows = Array.prototype.slice.call(document.querySelectorAll("#wall-results .wall-row"));
  var hint = document.getElementById("wall-hint");

  function hay(el) {
    return (
      (el.getAttribute("data-name") || "") +
      " " +
      (el.getAttribute("data-hex") || "") +
      " " +
      (el.getAttribute("data-titles") || "") +
      " " +
      (el.getAttribute("data-title") || "") +
      " " +
      (el.getAttribute("data-exam") || "")
    ).toLowerCase();
  }

  function filter() {
    var q = (input.value || "").trim().toLowerCase();
    var any = false;
    rows.forEach(function (r) {
      var show = q.length > 0 && hay(r).indexOf(q) !== -1;
      r.hidden = !show;
      if (show) any = true;
    });
    if (hint) hint.hidden = q.length > 0;
  }

  input.addEventListener("input", filter);
})();
