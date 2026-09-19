import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

function sanitize(str, max) {
  return (str || "").trim().replace(/<[^>]*>/g, "").slice(0, max);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

var ALLOWED_ENGAGEMENTS = [
  "Staff Augmentation",
  "Dedicated Team",
  "Project-Based",
  "CITC Credential",
  "Not sure yet",
];

var form = document.querySelector(".hire-form");
if (form && window.MOZENTAI_FIREBASE) {
  var app = initializeApp(window.MOZENTAI_FIREBASE);
  var db = getFirestore(app);

  form.addEventListener("submit", async function (event) {
    var honey = form.querySelector('input[name="_honey"]');
    if (honey && honey.value) return;

    var name = sanitize(form.name.value, 200);
    var email = sanitize(form.email.value, 320);
    var company = sanitize(form.company.value, 200);
    var engagement = form.engagement.value || "";
    var message = sanitize(form.message.value, 8000);

    if (!name || !email || !message) return;
    if (!isValidEmail(email)) return;
    if (ALLOWED_ENGAGEMENTS.indexOf(engagement) === -1) return;

    event.preventDefault();
    var payload = {
      name: name,
      email: email,
      company: company,
      engagement: engagement,
      message: message,
      source: "hire-form",
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, "inquiries"), payload);
    } catch (err) {}
    form.submit();
  });
}
