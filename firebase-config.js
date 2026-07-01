// firebase-config.js
// Configuration Firebase — projet "alpha-b5f6a"
// Chargé directement depuis le CDN Google, pas besoin de npm/build.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, push, set, update, remove, onValue,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDFDXL0VWgUmjZ4f1unvX8XkK9yRiRMC9Y",
  authDomain: "alpha-b5f6a.firebaseapp.com",
  databaseURL: "https://alpha-b5f6a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "alpha-b5f6a",
  storageBucket: "alpha-b5f6a.firebasestorage.app",
  messagingSenderId: "940984890627",
  appId: "1:940984890627:web:89d5bc204b06cb21712536",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// ─── AUTH ───────────────────────────────────────────────────────────────
export function loginModerator(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}
export function logoutModerator() {
  return signOut(auth);
}
export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

// ─── Helper : convertit l'objet RTDB { id: {...} } en tableau trié ────────
function listenList(path, cb, sortKey = "createdAt", desc = true) {
  const r = ref(db, path);
  return onValue(r, (snap) => {
    const val = snap.val() || {};
    let list = Object.entries(val).map(([id, data]) => ({ id, ...data }));
    list.sort((a, b) => {
      const av = a[sortKey] || 0, bv = b[sortKey] || 0;
      return desc ? bv - av : av - bv;
    });
    cb(list);
  });
}

// ─── PROJECTS ───────────────────────────────────────────────────────────
export function watchProjects(cb) { return listenList("projects", cb, "createdAt", true); }
export async function addProject(data) {
  const r = push(ref(db, "projects"));
  await set(r, { ...data, createdAt: Date.now() });
  return r.key;
}
export function updateProject(id, data) { return update(ref(db, `projects/${id}`), data); }
export function deleteProjectDoc(id) { return remove(ref(db, `projects/${id}`)); }

// ─── COLLABORATORS ───────────────────────────────────────────────────────
export function watchCollabs(cb) { return listenList("collaborators", cb, "name", false); }
export function addCollab(data) { return set(push(ref(db, "collaborators")), data); }
export function deleteCollabDoc(id) { return remove(ref(db, `collaborators/${id}`)); }

// ─── NEWS ───────────────────────────────────────────────────────────────
export function watchNews(cb) { return listenList("news", cb, "createdAt", true); }
export function addNews(data) { return set(push(ref(db, "news")), { ...data, createdAt: Date.now() }); }

// ─── COMMENTS ─────────────────────────────────────────────────────────────
export function watchComments(cb) { return listenList("comments", cb, "createdAt", true); }
export function addComment(data) { return set(push(ref(db, "comments")), { ...data, createdAt: Date.now() }); }
