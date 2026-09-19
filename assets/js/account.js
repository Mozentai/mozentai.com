import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

var gate = document.getElementById("gate");
var dash = document.getElementById("dash");
var dashName = document.getElementById("dash-name");
var dashHex = document.getElementById("dash-hex");
var certList = document.getElementById("cert-list");
var dashEmpty = document.getElementById("dash-empty");
var signInBtn = document.getElementById("sign-in-btn");
var signOutBtn = document.getElementById("sign-out");

var subGate = document.getElementById("sub-gate");
var subActive = document.getElementById("sub-active");
var subDot = document.getElementById("sub-dot");
var subLabel = document.getElementById("sub-label");
var subManage = document.getElementById("sub-manage");
var subscribeBtn = document.getElementById("subscribe-btn");

var stripe = window.MOZENTAI_STRIPE || {};

var app = initializeApp(window.MOZENTAI_FIREBASE);
var auth = getAuth(app);
var db = getFirestore(app);
var provider = new GoogleAuthProvider();

var FRESHNESS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
var EXPIRING_MS = 30 * 24 * 60 * 60 * 1000;

function showGate() {
  dash.classList.remove("is-visible");
  gate.hidden = false;
}

function showDash() {
  gate.hidden = true;
  dash.classList.add("is-visible");
}

function freshnessStatus(cert) {
  var base = cert.renewedAt || cert.grantedAt;
  if (!base) return { status: "stale", label: "No date" };
  var ts = base.toDate ? base.toDate() : new Date(base);
  var expiry = new Date(ts.getTime() + FRESHNESS_MS);
  var now = new Date();
  var remaining = expiry.getTime() - now.getTime();
  var dateStr = expiry.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (remaining <= 0) return { status: "stale", label: "Stale since " + dateStr };
  if (remaining <= EXPIRING_MS) return { status: "expiring", label: "Expiring " + dateStr };
  return { status: "fresh", label: "Fresh until " + dateStr };
}

function esc(str) {
  var d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function renderCerts(certs) {
  certList.innerHTML = "";
  if (!certs || Object.keys(certs).length === 0) {
    dashEmpty.hidden = false;
    return;
  }
  dashEmpty.hidden = true;
  var codes = Object.keys(certs).filter(function (c) {
    return /^[A-Z0-9]{2,4}$/i.test(c);
  }).sort();
  codes.forEach(function (code) {
    var cert = certs[code];
    var f = freshnessStatus(cert);
    var safe = esc(code);
    var row = document.createElement("div");
    row.className = "cert-row";

    var dot = document.createElement("span");
    dot.className = "cert-dot cert-dot--" + f.status;

    var codeEl = document.createElement("span");
    codeEl.className = "cert-code";
    var link = document.createElement("a");
    link.href = "/titles/" + encodeURIComponent(code.toLowerCase()) + "/";
    link.textContent = code;
    codeEl.appendChild(link);

    var fresh = document.createElement("span");
    fresh.className = "cert-freshness cert-freshness--" + f.status;
    fresh.textContent = f.label;

    row.appendChild(dot);
    row.appendChild(codeEl);
    row.appendChild(fresh);
    certList.appendChild(row);
  });
}

function renderSubscription(sub) {
  if (!sub || sub.status !== "active") {
    subGate.hidden = false;
    subActive.hidden = true;
    return;
  }

  subGate.hidden = true;
  subActive.hidden = false;

  subDot.className = "sub-dot sub-dot--active";
  subLabel.className = "sub-label sub-label--active";
  subLabel.textContent = "CREA active";

  if (sub.currentPeriodEnd) {
    var end = sub.currentPeriodEnd.toDate
      ? sub.currentPeriodEnd.toDate()
      : new Date(sub.currentPeriodEnd);
    subLabel.textContent += " until " + end.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  subManage.href = stripe.portal || "#";
}

async function loadEngineer(user) {
  try {
    var snap = await getDoc(doc(db, "engineers", user.uid));
    if (!snap.exists()) {
      dashName.textContent = user.displayName || user.email;
      dashHex.textContent = "Not registered";
      renderSubscription(null);
      dashEmpty.hidden = false;
      return;
    }
    var data = snap.data();
    dashName.textContent = data.name || user.displayName || user.email;
    dashHex.textContent = data.smarthex || "";
    renderSubscription(data.subscription || null);
    renderCerts(data.certs || {});
  } catch (err) {
    dashName.textContent = user.displayName || user.email;
    dashHex.textContent = "";
    renderSubscription(null);
    dashEmpty.textContent = "Could not load your data.";
    dashEmpty.hidden = false;
  }
}

onAuthStateChanged(auth, function (user) {
  if (user) {
    showDash();
    loadEngineer(user);

    subscribeBtn.onclick = function () {
      var link = stripe.engineer_link;
      if (!link || link.indexOf("REPLACE") !== -1) return;
      var url = link +
        "?client_reference_id=" + encodeURIComponent(user.uid) +
        "&prefilled_email=" + encodeURIComponent(user.email);
      window.location.href = url;
    };
  } else {
    showGate();
  }
});

signInBtn.addEventListener("click", function () {
  signInWithPopup(auth, provider).catch(function () {});
});

signOutBtn.addEventListener("click", function () {
  signOut(auth);
});
