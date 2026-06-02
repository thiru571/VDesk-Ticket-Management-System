// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD6PNa84Ddm_Sp-TVlQzmTBmCYq32ws64Y",
  authDomain: "ticket-booking-424a2.firebaseapp.com",
  projectId: "ticket-booking-424a2",
  storageBucket: "ticket-booking-424a2.firebasestorage.app",
  messagingSenderId: "503183744932",
  appId: "1:503183744932:web:e1d544f431b0fcb61a2b31",
  measurementId: "G-8XWCS7WJTP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, analytics, auth, db, storage };
export default app;
