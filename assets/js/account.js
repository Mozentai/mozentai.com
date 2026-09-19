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

const gate = document.getElementById("gate");
const dash = document.getElementById("dash");
const dashName = document.getElementById("dash-name");
const dashHex = document.getElementById("dash-hex");
const certList = document.getElementById("cert-list");
const dashEmpty = document.getElementById("dash-empty");
const signInBtn = document.getElementById("sign-in-btn");
const signOutBtn = document.getElementById("sign-out");

const app = initializeApp(window.MOZENTAI_FIREBASE);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const FRESHNESS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const EXPIRING_MS = 30 * 24 * 60 * 60 * 1000;

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

function renderCerts(certs) {
  certList.innerHTML = "";
  if (!certs || Object.keys(certs).length === 0) {
    dashEmpty.hidden = false;
    return;
  }
  dashEmpty.hidden = true;
  var codes = Object.keys(certs).sort();
  codes.forEach(function (code) {
    var cert = certs[code];
    var f = freshnessStatus(cert);
    var row = document.createElement("div");
    row.className = "cert-row";
    row.innerHTML =
      '<span class="cert-dot cert-dot--' + f.status + '"></span>' +
      '<span class="cert-code"><a href="/titles/' + code.toLowerCase() + '/">' + code + "</a></span>" +
      '<span class="cert-freshness cert-freshness--' + f.status + '">' + f.label + "</span>";
    certList.appendChild(row);
  });
}

async function loadEngineer(user) {
  try {
    var snap = await getDoc(doc(db, "engineers", user.uid));
    if (!snap.exists()) {
      dashName.textContent = user.displayName || user.email;
      dashHex.textContent = "Not registered";
      dashEmpty.hidden = false;
      return;
    }
    var data = snap.data();
    dashName.textContent = data.name || user.displayName || user.email;
    dashHex.textContent = data.smarthex || "";
    renderCerts(data.certs || {});
  } catch (err) {
    dashName.textContent = user.displayName || user.email;
    dashHex.textContent = "";
    dashEmpty.textContent = "Could not load your data.";
    dashEmpty.hidden = false;
  }
}

onAuthStateChanged(auth, function (user) {
  if (user) {
    showDash();
    loadEngineer(user);
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
