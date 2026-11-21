import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBxoCyvMFa3hlD2seCFqkpRmHwYIbjcrS8",
  authDomain: "homekeep-service.firebaseapp.com",
  projectId: "homekeep-service",
  storageBucket: "homekeep-service.firebasestorage.app",
  messagingSenderId: "584924377257",
  appId: "1:584924377257:web:c2f05c53eaebe9ea4739b8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Make globally accessible
window.db = db;

window.firebaseFns = {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc
};

// 🔥 notify when Firebase is ready
window.dispatchEvent(new Event("firebaseReady"));