(function () {
  var input = document.getElementById("wall-lookup");
  if (!input) return;

  var cards = Array.prototype.slice.call(document.querySelectorAll("#wall-people .wall-card"));
  var titles = Array.prototype.slice.call(document.querySelectorAll("#wall-titles .card"));
  var empty = document.getElementById("wall-empty");
  var registered = cards.length;

  function hay(el) {
    return (
      (el.getAttribute("data-name") || "") +
      " " +
      (el.getAttribute("data-hex") || "") +
      " " +
      (el.getAttribute("data-titles") || "") +
      " " +
      (el.getAttribute("data-title") || "")
    ).replace(/\s+/g, " ").trim();
  }

  function escapeRe(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function matches(el, q) {
    if (!q) return true;
    var blob = hay(el);
    if (blob === q) return true;
    var tokens = q.split(/\s+/).filter(Boolean);
    return tokens.every(function (token) {
      return new RegExp("(^|\\s)" + escapeRe(token) + "(\\s|$)", "i").test(blob);
    });
  }

  function filter() {
    var q = (input.value || "").trim().toLowerCase();
    var peopleHits = 0;
    cards.forEach(function (card) {
      var show = matches(card, q);
      card.hidden = !show;
      if (show) peopleHits += 1;
    });
    titles.forEach(function (card) {
      card.hidden = q ? !matches(card, q) : false;
    });
    if (empty) {
      var none = registered === 0 || (q && peopleHits === 0);
      empty.classList.toggle("is-hidden", !none);
    }
  }

  input.addEventListener("input", filter);
})();
