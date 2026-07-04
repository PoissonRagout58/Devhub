import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, push, set, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDFDXL0VWgUmjZ4f1unvX8XkK9yRiRMC9Y",
  authDomain: "alpha-b5f6a.firebaseapp.com",
  databaseURL: "https://alpha-b5f6a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "alpha-b5f6a",
  storageBucket: "alpha-b5f6a.firebasestorage.app",
  messagingSenderId: "940984890627",
  appId: "1:940984890627:web:89d5bc204b06cb21712536",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// ── AUTH ──────────────────────────────────────────────────────
export const loginModerator = (e, p) => signInWithEmailAndPassword(auth, e, p);
export const logoutModerator = () => signOut(auth);
export const watchAuth = cb => onAuthStateChanged(auth, cb);

// ── Helper liste ─────────────────────────────────────────────
function listenList(path, cb, sortKey = "createdAt", desc = true) {
  const r = ref(db, path);
  return onValue(r, snap => {
    const val = snap.val() || {};
    let list = Object.entries(val).map(([id, data]) => ({ id, ...data }));
    list.sort((a, b) => { const av = a[sortKey]||0, bv = b[sortKey]||0; return desc ? bv-av : av-bv; });
    cb(list);
  });
}

// ── PROJECTS ─────────────────────────────────────────────────
export const watchProjects = cb => listenList("projects", cb, "createdAt", true);
export async function addProject(data) { const r = push(ref(db,"projects")); await set(r,{...data,createdAt:Date.now()}); return r.key; }
export const updateProject = (id,data) => update(ref(db,`projects/${id}`),data);
export const deleteProjectDoc = id => remove(ref(db,`projects/${id}`));

// ── COLLABORATORS ─────────────────────────────────────────────
export const watchCollabs = cb => listenList("collaborators", cb, "name", false);
export const addCollab = data => set(push(ref(db,"collaborators")), data);
export const deleteCollabDoc = id => remove(ref(db,`collaborators/${id}`));

// ── NEWS ──────────────────────────────────────────────────────
export const watchNews = cb => listenList("news", cb, "createdAt", true);
export const addNews = data => set(push(ref(db,"news")), {...data, createdAt:Date.now()});

// ── COMMENTS ─────────────────────────────────────────────────
export const watchComments = cb => listenList("comments", cb, "createdAt", true);
export const addComment = data => set(push(ref(db,"comments")), {...data, createdAt:Date.now()});

// ── ROLES ─────────────────────────────────────────────────────
// roles/{uid} = 'admin' | 'developer'
export function watchUserRole(uid, cb) {
  return onValue(ref(db, `roles/${uid}`), snap => cb(snap.val() || null));
}
export const setUserRole = (uid, role) => set(ref(db, `roles/${uid}`), role);
export const deleteUserRole = uid => remove(ref(db, `roles/${uid}`));
export const watchAllRoles = cb => onValue(ref(db, "roles"), snap => cb(snap.val() || {}));

// ── DEMANDES (join requests) ─────────────────────────────────
export const watchRequests = cb => listenList("requests", cb, "createdAt", true);
export const addRequest = data => set(push(ref(db,"requests")), {...data, createdAt:Date.now(), status:"pending"});
export const updateRequest = (id, data) => update(ref(db,`requests/${id}`), data);

// ── INVITATIONS ─────────────────────────────────────────────
export const watchAllInvitations = cb => listenList("invitations", cb, "createdAt", true);
export const addInvitation = data => set(push(ref(db,"invitations")), {...data, createdAt:Date.now(), status:"pending"});
export const updateInvitation = (id, data) => update(ref(db,`invitations/${id}`), data);

// ── INSCRIPTION & MOT DE PASSE OUBLIÉ ───────────────────────
export const createAccount = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const resetPassword  = email => sendPasswordResetEmail(auth, email);

// ── USERS (profils membres) ──────────────────────────────────
// users/{uid} = { name, email, role, createdAt }
export const watchAllUsers = cb => onValue(ref(db, "users"), snap => cb(snap.val() || {}));
export const setUserData   = (uid, data) => update(ref(db, `users/${uid}`), data);
export const getUserData   = (uid, cb) => onValue(ref(db, `users/${uid}`), snap => cb(snap.val()));

// ── LIKES ────────────────────────────────────────────────────
// likes/{projectId}/{uid} = true
export const watchLikes  = cb => onValue(ref(db,"likes"), snap => cb(snap.val()||{}));
export const setLike     = (pid,uid) => set(ref(db,`likes/${pid}/${uid}`), true);
export const removeLike  = (pid,uid) => remove(ref(db,`likes/${pid}/${uid}`));

export const updateCollab = (id, data) => update(ref(db, `collaborators/${id}`), data);
