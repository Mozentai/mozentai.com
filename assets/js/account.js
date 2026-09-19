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
  collection,
  query,
  where,
  getDocs,
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

var adminPanel = document.getElementById("admin-panel");
var adminLookup = document.getElementById("admin-lookup");
var adminFind = document.getElementById("admin-find");
var adminEditor = document.getElementById("admin-editor");
var adminUid = document.getElementById("admin-uid");
var adminName = document.getElementById("admin-name");
var adminHex = document.getElementById("admin-hex");
var adminTitles = document.getElementById("admin-titles");
var adminSave = document.getElementById("admin-save");
var adminOk = document.getElementById("admin-ok");
var adminErr = document.getElementById("admin-err");

var MANAGER_EMAILS = [
  "victor@mozentai.com",
  "spacemany2k38@gmail.com",
  "victorblack@mozentai.com",
];

var stripe = window.MOZENTAI_STRIPE || {};
var app = initializeApp(window.MOZENTAI_FIREBASE);
var auth = getAuth(app);
var db = getFirestore(app);
var provider = new GoogleAuthProvider();

var FRESHNESS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
var EXPIRING_MS = 30 * 24 * 60 * 60 * 1000;

var editingUid = null;

function showAdminError(msg) {
  adminErr.textContent = msg;
  adminErr.style.display = msg ? "block" : "none";
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

function highlightCatalog(titles) {
  document.querySelectorAll(".catalog-item").forEach(function (el) {
    el.classList.remove("catalog-item--held");
  });
  if (!titles || !titles.length) return;
  var held = titles.map(function (t) { return t.toUpperCase(); });
  document.querySelectorAll(".catalog-item").forEach(function (el) {
    var code = (el.getAttribute("data-exam") || "").toUpperCase();
    if (held.indexOf(code) !== -1) el.classList.add("catalog-item--held");
  });
}

function checkManager(user) {
  return user && user.email && MANAGER_EMAILS.indexOf(user.email) !== -1;
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
    highlightCatalog(data.titles || []);
  } catch (err) {
    dashName.textContent = user.displayName || user.email;
    dashHex.textContent = "";
    renderSubscription(null);
    dashEmpty.textContent = "Could not load your data.";
    dashEmpty.hidden = false;
  }
}

async function findEngineer(term) {
  showAdminError("");
  adminEditor.hidden = true;
  editingUid = null;

  var snap;
  if (term.indexOf("@") !== -1) {
    snap = await getDocs(query(collection(db, "engineers"), where("email", "==", term)));
  } else {
    snap = await getDocs(query(collection(db, "engineers"), where("smarthex", "==", term)));
  }

  if (snap.empty) {
    showAdminError("No engineer found for \"" + term + "\"");
    return;
  }

  var d = snap.docs[0];
  var data = d.data();
  editingUid = d.id;
  adminUid.textContent = d.id;
  adminName.value = data.name || "";
  adminHex.value = data.smarthex || "";
  adminTitles.value = (data.titles || []).join(", ");
  adminEditor.hidden = false;
}

onAuthStateChanged(auth, function (user) {
  if (user) {
    showDash();
    loadEngineer(user);

    if (checkManager(user)) {
      adminPanel.classList.add("is-visible");
    }

    subscribeBtn.onclick = async function () {
      subscribeBtn.disabled = true;
      subscribeBtn.textContent = "Redirecting...";

      try {
        await setDoc(doc(db, "engineers", user.uid), {
          name: user.displayName || "",
          email: user.email || "",
        }, { merge: true });
      } catch (err) {
        subscribeBtn.disabled = false;
        subscribeBtn.textContent = "Subscribe";
        return;
      }

      var link = stripe.engineer_link;
      if (!link || link.indexOf("REPLACE") !== -1) {
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

adminFind.addEventListener("click", function () {
  var term = adminLookup.value.trim();
  if (!term) return;
  findEngineer(term);
});

adminLookup.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    var term = adminLookup.value.trim();
    if (term) findEngineer(term);
  }
});

adminSave.addEventListener("click", async function () {
  var user = auth.currentUser;
  if (!user || !checkManager(user) || !editingUid) return;

  adminOk.classList.remove("is-visible");
  adminSave.disabled = true;
  adminSave.textContent = "Saving...";

  var titleStr = adminTitles.value.trim();
  var titles = titleStr
    ? titleStr.split(",").map(function (t) { return t.trim().toUpperCase(); }).filter(Boolean)
    : [];

  var update = {
    name: adminName.value.trim(),
    smarthex: adminHex.value.trim(),
    titles: titles,
  };

  try {
    await setDoc(doc(db, "engineers", editingUid), update, { merge: true });
    adminOk.classList.add("is-visible");
    setTimeout(function () { adminOk.classList.remove("is-visible"); }, 2000);
  } catch (err) {
    showAdminError("Save failed. Check permissions.");
  }

  adminSave.disabled = false;
  adminSave.textContent = "Save";
});
