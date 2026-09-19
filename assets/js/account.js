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

var profileName = document.getElementById("profile-name");
var profileEmail = document.getElementById("profile-email");
var profileHex = document.getElementById("profile-hex");
var profileHexValue = document.getElementById("profile-hex-value");
var profileHexHint = document.getElementById("profile-hex-hint");
var profileTitles = document.getElementById("profile-titles");
var profileSave = document.getElementById("profile-save");
var profileOk = document.getElementById("profile-ok");

var adminPanel = document.getElementById("admin-panel");
var adminLookup = document.getElementById("admin-lookup");
var adminFind = document.getElementById("admin-find");
var adminEditor = document.getElementById("admin-editor");
var adminUid = document.getElementById("admin-uid");
var adminName = document.getElementById("admin-name");
var adminHex = document.getElementById("admin-hex");
var adminHexValue = document.getElementById("admin-hex-value");
var adminHexHint = document.getElementById("admin-hex-hint");
var adminTitles = document.getElementById("admin-titles");
var adminSave = document.getElementById("admin-save");
var adminOk = document.getElementById("admin-ok");
var adminErr = document.getElementById("admin-err");

var sit = document.getElementById("sit");
var sitCode = document.getElementById("sit-code");
var sitTitle = document.getElementById("sit-title");
var sitTopics = document.getElementById("sit-topics");
var sitErr = document.getElementById("sit-err");
var sitQuestionnaire = document.getElementById("sit-questionnaire");
var sitInstructor = document.getElementById("sit-instructor");
var sitCancel = document.getElementById("sit-cancel");

var heldTitles = [];
var pendingExam = null;

var MANAGER_EMAILS = [
  "victor@mozentai.com",
  "spacemany2k38@gmail.com",
  "victorblack@mozentai.com",
];

var stripe = window.MOZENTAI_STRIPE || {};
var examsCatalog = window.MOZENTAI_EXAMS || {};
var app = initializeApp(window.MOZENTAI_FIREBASE);
var auth = getAuth(app);
var db = getFirestore(app);
var provider = new GoogleAuthProvider();

var FRESHNESS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
var EXPIRING_MS = 30 * 24 * 60 * 60 * 1000;

var editingUid = null;

function smarthexChecksum(base) {
  var total = 0;
  for (var i = 0; i < 14; i++) {
    total += parseInt(base.charAt(i), 16) * (i + 1);
  }
  var hex = (total % 256).toString(16);
  return hex.length < 2 ? "0" + hex : hex;
}

function generateSmartHex() {
  var bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  var base = "";
  for (var i = 0; i < bytes.length; i++) {
    var h = bytes[i].toString(16);
    base += h.length < 2 ? "0" + h : h;
  }
  return base + smarthexChecksum(base);
}

function validateSmartHex(id) {
  if (!id || id.length !== 16 || !/^[0-9a-f]{16}$/.test(id)) return false;
  return id.slice(14) === smarthexChecksum(id.slice(0, 14));
}

function issuedHex() {
  var hex = (profileHexValue && profileHexValue.textContent || "").trim();
  return validateSmartHex(hex) ? hex : "";
}

function flashCopied(hintEl) {
  if (!hintEl) return;
  hintEl.textContent = "Copied";
  setTimeout(function () { hintEl.textContent = "Copy"; }, 1500);
}

function fallbackCopy(hex, done) {
  var ta = document.createElement("textarea");
  ta.value = hex;
  ta.setAttribute("readonly", "");
  ta.style.position = "absolute";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch (e) {}
  document.body.removeChild(ta);
}

function copyHex(hex, hintEl) {
  if (!validateSmartHex(hex)) return;
  function done() { flashCopied(hintEl); }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(hex).then(done).catch(function () { fallbackCopy(hex, done); });
    return;
  }
  fallbackCopy(hex, done);
}

function setCitcNumber(hex) {
  var value = validateSmartHex(hex) ? hex : "";
  profileHexValue.textContent = value || "Not issued";
  profileHex.disabled = !value;
  profileHexHint.textContent = value ? "Copy" : "";
  dashHex.textContent = value || "Not registered";
  dashHex.classList.toggle("is-copyable", !!value);
}

function showAdminError(msg) {
  adminErr.textContent = msg;
  adminErr.style.display = msg ? "block" : "none";
}

function showSitError(msg) {
  sitErr.textContent = msg || "";
  sitErr.classList.toggle("is-visible", !!msg);
}

function closeSit() {
  sit.hidden = true;
  pendingExam = null;
  showSitError("");
}

function openSit(code, name) {
  var examCode = (code || "").toUpperCase();
  if (heldTitles.indexOf(examCode) !== -1) return;
  if (!issuedHex()) {
    var gateEl = document.getElementById("sub-gate");
    if (gateEl) gateEl.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (heldTitles.length >= 5) {
    pendingExam = null;
    sitCode.textContent = examCode;
    sitTitle.textContent = name || examCode;
    sitTopics.innerHTML = "";
    sit.hidden = false;
    showSitError("No more titles can be added to this standing.");
    sitQuestionnaire.disabled = true;
    sitInstructor.disabled = true;
    return;
  }
  sitQuestionnaire.disabled = false;
  sitInstructor.disabled = false;
  var exam = examsCatalog[examCode] || { title: name, topics: [] };
  pendingExam = examCode;
  sitCode.textContent = examCode;
  sitTitle.textContent = exam.title || name || examCode;
  sitTopics.textContent = "";
  (exam.topics || []).forEach(function (topic) {
    var li = document.createElement("li");
    li.textContent = topic;
    sitTopics.appendChild(li);
  });
  sit.hidden = false;
  showSitError("");
}

function startExam(mode) {
  if (!pendingExam) return;
  var user = auth.currentUser;
  if (!user) return;
  var links = stripe.exam_links || {};
  var link = links[pendingExam];
  if (!link || link.indexOf("http") !== 0) {
    showSitError("Checkout for this exam is not live yet.");
    return;
  }
  window.location.href = link +
    (link.indexOf("?") === -1 ? "?" : "&") +
    "client_reference_id=" + encodeURIComponent(user.uid + ":" + pendingExam + ":" + mode) +
    "&prefilled_email=" + encodeURIComponent(user.email || "");
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

function populateProfile(user, data) {
  var name = (data && data.name) || user.displayName || "";
  var email = user.email || "";
  var hex = (data && data.smarthex) || "";
  var titles = (data && data.titles) || [];
  heldTitles = titles.map(function (t) { return String(t).toUpperCase(); });

  dashName.textContent = name || email;
  setCitcNumber(hex);
  profileName.value = name;
  profileEmail.value = email;
  profileTitles.value = titles.join(", ");

  if (checkManager(user)) {
    profileTitles.removeAttribute("readonly");
    profileTitles.placeholder = "P1, C1, AW1, GH1";
  }
}

async function loadEngineer(user) {
  try {
    var snap = await getDoc(doc(db, "engineers", user.uid));
    if (!snap.exists()) {
      populateProfile(user, null);
      renderSubscription(null);
      dashEmpty.hidden = false;
      return;
    }
    var data = snap.data();
    populateProfile(user, data);
    renderSubscription(data.subscription || null);
    renderCerts(data.certs || {});
    highlightCatalog(data.titles || []);
  } catch (err) {
    populateProfile(user, null);
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
  var foundHex = data.smarthex || "";
  adminHexValue.textContent = foundHex || "Not issued";
  adminHex.disabled = !validateSmartHex(foundHex);
  adminHexHint.textContent = validateSmartHex(foundHex) ? "Copy" : "";
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
        var snap = await getDoc(doc(db, "engineers", user.uid));
        var current = snap.exists() ? snap.data() : {};
        var hex = current.smarthex;
        if (!validateSmartHex(hex)) hex = generateSmartHex();
        await setDoc(doc(db, "engineers", user.uid), {
          name: current.name || user.displayName || "",
          email: user.email || "",
          smarthex: hex,
        }, { merge: true });
        setCitcNumber(hex);
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

    profileSave.onclick = async function () {
      profileOk.classList.remove("is-visible");
      profileSave.disabled = true;
      profileSave.textContent = "Saving...";

      var update = {
        name: profileName.value.trim(),
        email: user.email || "",
      };

      if (checkManager(user)) {
        var titleStr = profileTitles.value.trim();
        update.titles = titleStr
          ? titleStr.split(",").map(function (t) { return t.trim().toUpperCase(); }).filter(Boolean)
          : [];
      }

      try {
        await setDoc(doc(db, "engineers", user.uid), update, { merge: true });
        dashName.textContent = update.name || user.email;
        if (update.titles) highlightCatalog(update.titles);
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

document.querySelectorAll(".catalog-item").forEach(function (el) {
  el.addEventListener("click", function () {
    openSit(el.getAttribute("data-exam"), el.getAttribute("data-name"));
  });
});

sitCancel.addEventListener("click", closeSit);
sit.addEventListener("click", function (e) {
  if (e.target === sit) closeSit();
});
sitQuestionnaire.addEventListener("click", function () {
  startExam("questionnaire");
});
sitInstructor.addEventListener("click", function () {
  startExam("instructor");
});

if (location.hash === "#exams") {
  var examsEl = document.getElementById("exams");
  if (examsEl) examsEl.scrollIntoView();
}

profileHex.addEventListener("click", function () {
  copyHex(issuedHex(), profileHexHint);
});
dashHex.addEventListener("click", function () {
  copyHex(issuedHex(), profileHexHint);
});
adminHex.addEventListener("click", function () {
  copyHex((adminHexValue.textContent || "").trim(), adminHexHint);
});
