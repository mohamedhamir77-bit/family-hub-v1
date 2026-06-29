import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC_PKBvJUilRc5i86N9Qoc-ExNC9vU2WAY",
  authDomain: "family-hub-9b455.firebaseapp.com",
  projectId: "family-hub-9b455",
  storageBucket: "family-hub-9b455.firebasestorage.app",
  messagingSenderId: "216625262154",
  appId: "1:216625262154:web:d57b706db14db9477780b3"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp };
