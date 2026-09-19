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

var profileName = document.getElementById("profile-name");
var profileEmail = document.getElementById("profile-email");
var profileHex = document.getElementById("profile-hex");
var profileSave = document.getElementById("profile-save");
var profileOk = document.getElementById("profile-ok");

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

function isManager(user) {
  return user && user.email && MANAGER_EMAILS.indexOf(user.email) !== -1;
}

function populateCompanyProfile(user, data) {
  var name = (data && data.name) || user.displayName || "";
  var email = user.email || "";
  var hex = (data && data.smarthex) || "";

  dashName.textContent = name || email;
  dashHex.textContent = hex || "";

  profileName.value = name;
  profileEmail.value = email;
  profileHex.value = hex;

  if (isManager(user)) {
    profileHex.removeAttribute("readonly");
    profileHex.placeholder = "SmartHex-16";
  }
}

async function loadCompany(user) {
  try {
    var snap = await getDoc(doc(db, "companies", user.uid));
    if (!snap.exists()) {
      populateCompanyProfile(user, null);
      renderSubscription(null);
      return;
    }
    var data = snap.data();
    populateCompanyProfile(user, data);

    var isActive = renderSubscription(data.subscription || null);
    if (isActive) {
      await loadEngineers(data);
    }
  } catch (err) {
    populateCompanyProfile(user, null);
    renderSubscription(null);
  }
}

onAuthStateChanged(auth, function (user) {
  if (user) {
    showDash();
    loadCompany(user);

    subscribeBtn.onclick = function () {
      var link = stripe.company_link;
      if (!link || !link.startsWith("https://")) return;
      var url = link +
        "?client_reference_id=" + encodeURIComponent(user.uid) +
        "&prefilled_email=" + encodeURIComponent(user.email);
      window.location.href = url;
    };

    profileSave.onclick = async function () {
      profileOk.classList.remove("is-visible");
      profileSave.disabled = true;
      profileSave.textContent = "Saving...";

      var update = {
        name: profileName.value.trim(),
        email: user.email || "",
      };

      if (isManager(user)) {
        update.smarthex = profileHex.value.trim();
      }

      try {
        await setDoc(doc(db, "companies", user.uid), update, { merge: true });
        dashName.textContent = update.name || user.email;
        if (update.smarthex !== undefined) dashHex.textContent = update.smarthex;
        profileOk.classList.add("is-visible");
        setTimeout(function () { profileOk.classList.remove("is-visible"); }, 2000);
      } catch (err) {
        profileOk.textContent = "Save failed";
        profileOk.style.color = "var(--stale)";
        profileOk.classList.add("is-visible");
        setTimeout(function () {
          profileOk.classList.remove("is-visible");
          profileOk.textContent = "Saved";
          profileOk.style.color = "";
        }, 3000);
      }

      profileSave.disabled = false;
      profileSave.textContent = "Save";
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
