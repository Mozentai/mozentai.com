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
  setDoc,
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
var cpfInput = document.getElementById("cpf-input");
var cpfErr = document.getElementById("cpf-err");

var stripe = window.MOZENTAI_STRIPE || {};

var app = initializeApp(window.MOZENTAI_FIREBASE);
var auth = getAuth(app);
var db = getFirestore(app);
var provider = new GoogleAuthProvider();

var FRESHNESS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
var EXPIRING_MS = 30 * 24 * 60 * 60 * 1000;

function validateCPF(raw) {
  var cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  var sum = 0;
  for (var i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  var d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (parseInt(cpf[9], 10) !== d1) return false;
  sum = 0;
  for (var i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  var d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  if (parseInt(cpf[10], 10) !== d2) return false;
  return true;
}

function formatCPF(raw) {
  var digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return digits.slice(0, 3) + "." + digits.slice(3);
  if (digits.length <= 9) return digits.slice(0, 3) + "." + digits.slice(3, 6) + "." + digits.slice(6);
  return digits.slice(0, 3) + "." + digits.slice(3, 6) + "." + digits.slice(6, 9) + "-" + digits.slice(9);
}

cpfInput.addEventListener("input", function () {
  var pos = cpfInput.selectionStart;
  var before = cpfInput.value.length;
  cpfInput.value = formatCPF(cpfInput.value);
  var after = cpfInput.value.length;
  var newPos = pos + (after - before);
  cpfInput.setSelectionRange(newPos, newPos);
  cpfInput.classList.remove("is-invalid");
  cpfErr.classList.remove("is-visible");
});

function showCpfError(msg) {
  cpfErr.textContent = msg;
  cpfErr.classList.add("is-visible");
  cpfInput.classList.add("is-invalid");
}

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

async function isCpfTaken(cpfDigits, currentUid) {
  try {
    var snap = await getDoc(doc(db, "cpf_index", cpfDigits));
    if (!snap.exists()) return false;
    return snap.data().uid !== currentUid;
  } catch (err) {
    return false;
  }
}

async function claimCpf(cpfDigits, uid) {
  await setDoc(doc(db, "cpf_index", cpfDigits), { uid: uid });
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
    if (data.cpf) {
      cpfInput.value = formatCPF(data.cpf);
      cpfInput.disabled = true;
    }
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

    subscribeBtn.onclick = async function () {
      cpfErr.classList.remove("is-visible");
      cpfInput.classList.remove("is-invalid");

      var raw = cpfInput.value;
      if (!validateCPF(raw)) {
        showCpfError("Invalid CPF");
        return;
      }

      var cpfDigits = raw.replace(/\D/g, "");

      subscribeBtn.disabled = true;
      subscribeBtn.textContent = "Checking...";

      var taken = await isCpfTaken(cpfDigits, user.uid);
      if (taken) {
        showCpfError("This CPF is already registered");
        subscribeBtn.disabled = false;
        subscribeBtn.textContent = "Subscribe";
        return;
      }

      try {
        await claimCpf(cpfDigits, user.uid);
        await setDoc(doc(db, "engineers", user.uid), {
          cpf: cpfDigits,
          name: user.displayName || "",
          email: user.email || "",
        }, { merge: true });
      } catch (err) {
        showCpfError("Could not save. Try again.");
        subscribeBtn.disabled = false;
        subscribeBtn.textContent = "Subscribe";
        return;
      }

      var link = stripe.engineer_link;
      if (!link || !link.startsWith("https://")) {
        subscribeBtn.disabled = false;
        subscribeBtn.textContent = "Subscribe";
        return;
      }
      window.location.href = link +
        "?client_reference_id=" + encodeURIComponent(user.uid) +
        "&prefilled_email=" + encodeURIComponent(user.email);
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
