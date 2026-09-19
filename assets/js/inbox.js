import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

var ADMIN_ACCOUNTS = {
  victorblack: "victorblack@mozentai.com",
};

var gate = document.getElementById("gate");
var inbox = document.getElementById("inbox");
var list = document.getElementById("request-list");
var empty = document.getElementById("request-empty");

var wordmark = document.getElementById("wordmark");
var loginForm = document.getElementById("login-form");
var loginUser = document.getElementById("login-user");
var loginPass = document.getElementById("login-pass");
var loginErr = document.getElementById("login-err");
var signOutBtn = document.getElementById("sign-out");

var app = initializeApp(window.MOZENTAI_FIREBASE);
var auth = getAuth(app);
var db = getFirestore(app);

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
  var date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function render(requests) {
  list.innerHTML = "";
  if (!requests.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  requests.forEach(function (item) {
    var article = document.createElement("article");
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
    var snap = await getDocs(
      query(collection(db, "inquiries"), orderBy("createdAt", "desc"))
    );
    var requests = snap.docs.map(function (item) {
      var data = item.data();
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

wordmark.addEventListener("click", function () {
  loginForm.classList.toggle("is-visible");
  if (loginForm.classList.contains("is-visible")) {
    loginUser.focus();
  }
});

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  loginErr.classList.remove("is-visible");

  var username = loginUser.value.trim().toLowerCase();
  var password = loginPass.value;
  var email = ADMIN_ACCOUNTS[username];

  if (!email) {
    loginErr.textContent = "Unknown user";
    loginErr.classList.add("is-visible");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginErr.textContent = "Invalid credentials";
    loginErr.classList.add("is-visible");
  }
});

onAuthStateChanged(auth, function (user) {
  if (user) {
    loadRequests();
  } else {
    showGate();
  }
});

signOutBtn.addEventListener("click", function () {
  signOut(auth);
});
