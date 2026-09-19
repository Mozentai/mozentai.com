(function () {
  var input = document.getElementById("wall-lookup");
  if (!input) return;

  var rows = Array.prototype.slice.call(document.querySelectorAll("#wall-people .wall-row"));
  var ladder = Array.prototype.slice.call(document.querySelectorAll(".ladder-grid .ladder-item"));
  var empty = document.getElementById("wall-empty");

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
    ).replace(/\s+/g, " ").trim();
  }

  function filter() {
    var q = (input.value || "").trim().toLowerCase();
    var hits = 0;
    rows.forEach(function (r) {
      var show = !q || hay(r).toLowerCase().indexOf(q) !== -1;
      r.hidden = !show;
      if (show) hits += 1;
    });
    ladder.forEach(function (l) {
      l.hidden = q ? hay(l).toLowerCase().indexOf(q) === -1 : false;
    });
    if (empty) {
      empty.classList.toggle("is-hidden", rows.length === 0 ? !q : hits > 0);
    }
  }

  input.addEventListener("input", filter);
})();
