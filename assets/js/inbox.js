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
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const gate = document.getElementById("gate");
const inbox = document.getElementById("inbox");
const list = document.getElementById("request-list");
const empty = document.getElementById("request-empty");
const signInBtn = document.getElementById("wordmark");

const app = initializeApp(window.MOZENTAI_FIREBASE);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

function showGate() {
  inbox.hidden = true;
  gate.hidden = false;
  document.title = "404";
}

function showInbox() {
  gate.hidden = true;
  inbox.hidden = false;
  document.title = "Requests";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatWhen(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

async function visitorIp() {
  const res = await fetch("https://api.ipify.org?format=json");
  if (!res.ok) throw new Error("ip");
  const data = await res.json();
  return data.ip;
}

async function ipAllowed() {
  const [ip, allowSnap] = await Promise.all([
    visitorIp(),
    getDoc(doc(db, "config", "allow")),
  ]);
  const ips = (allowSnap.exists() && allowSnap.data().ips) || [];
  return ips.indexOf(ip) !== -1;
}

function render(requests) {
  list.innerHTML = "";
  if (!requests.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  requests.forEach(function (item) {
    const article = document.createElement("article");
    article.className = "request";
    article.innerHTML =
      "<p class=\"request-meta\">" +
      "<span>" + escapeHtml(item.name) + "</span>" +
      "<span>" + escapeHtml(item.email) + "</span>" +
      "<span>" + escapeHtml(formatWhen(item.createdAt)) + "</span>" +
      "</p>" +
      "<p class=\"request-sub\">" +
      escapeHtml(item.company) +
      (item.company && item.engagement ? " · " : "") +
      escapeHtml(item.engagement) +
      "</p>" +
      "<p class=\"request-body\">" + escapeHtml(item.message) + "</p>";
    list.appendChild(article);
  });
}

async function loadRequests() {
  try {
    if (!(await ipAllowed())) {
      showGate();
      return;
    }
    const snap = await getDocs(
      query(collection(db, "inquiries"), orderBy("createdAt", "desc"))
    );
    const requests = snap.docs.map(function (item) {
      const data = item.data();
      return {
        name: data.name,
        email: data.email,
        company: data.company,
        engagement: data.engagement,
        message: data.message,
        createdAt: data.createdAt && data.createdAt.toDate
          ? data.createdAt.toDate().toISOString()
          : null,
      };
    });
    showInbox();
    render(requests);
  } catch (err) {
    showGate();
  }
}

onAuthStateChanged(auth, function (user) {
  if (user) {
    loadRequests();
  } else {
    showGate();
  }
});

signInBtn.addEventListener("click", function () {
  signInWithPopup(auth, provider).catch(function () {
    showGate();
  });
});

const signOutBtn = document.getElementById("sign-out");
if (signOutBtn) {
  signOutBtn.addEventListener("click", function () {
    signOut(auth);
  });
}
