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
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

var gate = document.getElementById("gate");
var dash = document.getElementById("dash");
var dashName = document.getElementById("dash-name");
var dashHex = document.getElementById("dash-hex");
var signInBtn = document.getElementById("sign-in-btn");
var signOutBtn = document.getElementById("sign-out");

var subGate = document.getElementById("sub-gate");
var subActive = document.getElementById("sub-active");
var subDot = document.getElementById("sub-dot");
var subLabel = document.getElementById("sub-label");
var subManage = document.getElementById("sub-manage");
var subscribeBtn = document.getElementById("subscribe-btn");

var engLookup = document.getElementById("eng-lookup");
var engList = document.getElementById("eng-list");
var engEmpty = document.getElementById("eng-empty");

var stripe = window.MOZENTAI_STRIPE || {};

var app = initializeApp(window.MOZENTAI_FIREBASE);
var auth = getAuth(app);
var db = getFirestore(app);
var provider = new GoogleAuthProvider();

var engineers = [];

function showGate() {
  dash.classList.remove("is-visible");
  gate.hidden = false;
}

function showDash() {
  gate.hidden = true;
  dash.classList.add("is-visible");
}

function renderSubscription(sub) {
  if (!sub || sub.status !== "active") {
    subGate.hidden = false;
    subActive.hidden = true;
    return false;
  }

  subGate.hidden = true;
  subActive.hidden = false;

  subDot.className = "sub-dot sub-dot--active";
  subLabel.className = "sub-label sub-label--active";
  subLabel.textContent = "Plan active";

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
  return true;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderEngineers(list) {
  engList.innerHTML = "";
  if (!list.length) {
    engEmpty.hidden = false;
    return;
  }
  engEmpty.hidden = true;
  list.forEach(function (eng) {
    var row = document.createElement("div");
    row.className = "eng-row";
    var titles = eng.titles && eng.titles.length
      ? eng.titles.join(", ")
      : "Registered";
    row.innerHTML =
      '<span class="eng-name">' + escapeHtml(eng.name) + "</span>" +
      '<span class="eng-hex">' + escapeHtml(eng.smarthex) + "</span>" +
      '<span class="eng-titles">' + escapeHtml(titles) + "</span>";
    engList.appendChild(row);
  });
}

function filterEngineers(term) {
  if (!term) {
    renderEngineers([]);
    engEmpty.hidden = true;
    return;
  }
  var lower = term.toLowerCase();
  var filtered = engineers.filter(function (eng) {
    if ((eng.name || "").toLowerCase().indexOf(lower) !== -1) return true;
    if ((eng.smarthex || "").toLowerCase().indexOf(lower) !== -1) return true;
    if (eng.titles) {
      for (var i = 0; i < eng.titles.length; i++) {
        if (eng.titles[i].toLowerCase().indexOf(lower) !== -1) return true;
      }
    }
    return false;
  });
  renderEngineers(filtered);
}

async function loadEngineers(companyData) {
  try {
    var group = companyData.group;
    var q;
    if (group) {
      q = query(collection(db, "engineers"), where("group", "==", group));
    } else {
      q = query(collection(db, "engineers"));
    }
    var snap = await getDocs(q);
    engineers = snap.docs.map(function (d) {
      var data = d.data();
      return {
        name: data.name || "",
        smarthex: data.smarthex || "",
        titles: data.titles || [],
      };
    });
  } catch (err) {
    engineers = [];
  }
}

async function loadCompany(user) {
  try {
    var snap = await getDoc(doc(db, "companies", user.uid));
    if (!snap.exists()) {
      dashName.textContent = user.displayName || user.email;
      dashHex.textContent = "";
      renderSubscription(null);
      return;
    }
    var data = snap.data();
    dashName.textContent = data.name || user.displayName || user.email;
    dashHex.textContent = data.smarthex || "";

    var isActive = renderSubscription(data.subscription || null);
    if (isActive) {
      await loadEngineers(data);
    }
  } catch (err) {
    dashName.textContent = user.displayName || user.email;
    dashHex.textContent = "";
    renderSubscription(null);
  }
}

onAuthStateChanged(auth, function (user) {
  if (user) {
    showDash();
    loadCompany(user);

    subscribeBtn.onclick = function () {
      var link = stripe.company_link;
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

engLookup.addEventListener("input", function () {
  filterEngineers(engLookup.value.trim());
});
