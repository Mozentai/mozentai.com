import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const form = document.querySelector(".hire-form");
if (form && window.MOZENTAI_FIREBASE) {
  const app = initializeApp(window.MOZENTAI_FIREBASE);
  const db = getFirestore(app);

  form.addEventListener("submit", async function (event) {
    const honey = form.querySelector('input[name="_honey"]');
    if (honey && honey.value) return;

    event.preventDefault();
    const payload = {
      name: (form.name.value || "").trim(),
      email: (form.email.value || "").trim(),
      company: (form.company.value || "").trim(),
      engagement: form.engagement.value || "",
      message: (form.message.value || "").trim(),
      source: "hire-form",
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, "inquiries"), payload);
    } catch (err) {
      // FormSubmit still delivers the email if the inbox write fails.
    }
    form.submit();
  });
}
