// app.js — DevHub, version HTML/CSS/JS pur (pas de build, pas de npm)
import {
  watchAuth, loginModerator, logoutModerator,
  watchProjects, addProject, updateProject, deleteProjectDoc,
  watchCollabs, addCollab, deleteCollabDoc,
  watchNews, addNews,
  watchComments, addComment,
} from "./firebase-config.js";
import { extractZipToPages } from "./zip-embed.js";

const root = document.getElementById("root");

// ─── STATE ────────────────────────────────────────────────────────────────
const state = {
  view: "home", selId: null,
  projects: [], collabs: [], news: [], comments: [],
  loggedIn: false, filter: "all", search: "",
  seenFirstNews: false, showPopupQueued: false,
};

const uid = () => Math.random().toString(36).slice(2, 9);
const fd = (d) => { if (!d) return ""; return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }); };
const now = () => new Date().toISOString().split("T")[0];
const esc = (s) => (s || "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function avatarHTML(c, size = 32) {
  return `<div class="avatar" style="width:${size}px;height:${size}px;background:${c.color};font-size:${size * 0.38}px">${esc(c.initials || c.name[0])}</div>`;
}

// ─── FIREBASE LISTENERS ───────────────────────────────────────────────────
watchAuth((u) => { state.loggedIn = !!u; render(); });
watchProjects((p) => { state.projects = p; render(); });
watchCollabs((c) => { state.collabs = c; render(); });
watchNews((n) => {
  state.news = n;
  if (!state.seenFirstNews && n.length) {
    state.seenFirstNews = true;
    setTimeout(() => { state.showPopupQueued = true; render(); }, 900);
  }
  render();
});
watchComments((c) => { state.comments = c; render(); });

// ─── MAIN RENDER ──────────────────────────────────────────────────────────
function render() {
  root.innerHTML = `
    ${renderTicker()}
    ${renderNav()}
    <div id="view-content">
      ${state.view === "home" ? renderHome() : ""}
      ${state.view === "project" ? renderProject() : ""}
      ${state.view === "admin" && state.loggedIn ? renderAdmin() : ""}
    </div>
    <div id="modal-root"></div>
  `;
  attachGlobalHandlers();
  if (state.showPopupQueued) { state.showPopupQueued = false; openNewsPopup(); }
}

// ─── TICKER ───────────────────────────────────────────────────────────────
function renderTicker() {
  if (!state.news.length) return "";
  const items = [...state.news, ...state.news];
  const spans = items.map((n) => `
    <span class="inter" style="margin-right:90px;font-size:12px;color:#C4B5FD;flex-shrink:0">
      <span style="color:#A78BFA;font-weight:600">⚡ ${esc(n.author)}</span> ${esc(n.description)} →
      <span style="color:#22D3EE">${esc(n.projectTitle)}</span>
      <span style="color:#4B5563">· ${fd(n.createdAt)}</span>
    </span>`).join("");
  return `<div style="background:rgba(124,58,237,.1);border-bottom:1px solid rgba(124,58,237,.2);padding:7px 0">
    <div class="tw"><div class="ti">${spans}</div></div>
  </div>`;
}

// ─── NAV ──────────────────────────────────────────────────────────────────
function renderNav() {
  return `<nav>
    <button class="logo-btn" data-go="home"><div class="logo-icon">🚀</div><span class="sg" style="font-size:17px;font-weight:700">DevHub</span></button>
    <div style="display:flex;gap:8px">
      ${state.loggedIn
        ? `<button class="bg" style="font-size:12px" data-go="admin">⚙ Admin</button>
           <button class="bg" style="font-size:12px;color:#F87171;border-color:rgba(239,68,68,.25)" id="btn-logout">Déconnexion</button>`
        : `<button class="bg" style="font-size:12px" id="btn-login">🔒 Connexion</button>`}
    </div>
  </nav>`;
}

// ─── HOME ─────────────────────────────────────────────────────────────────
function renderHome() {
  const stats = [
    { v: state.projects.length, l: "Projets", c: "#A78BFA" },
    { v: state.collabs.length, l: "Membres", c: "#22D3EE" },
    { v: state.projects.reduce((s, p) => s + (p.updates?.length || 0), 0), l: "Mises à jour", c: "#34D399" },
    { v: state.projects.filter((p) => p.hasServer).length, l: "En ligne", c: "#FBB54A" },
  ];
  const filtered = state.projects.filter((p) => {
    if (state.filter !== "all" && p.type !== state.filter) return false;
    if (state.search && !p.title?.toLowerCase().includes(state.search.toLowerCase()) && !(p.tags || []).join(" ").toLowerCase().includes(state.search.toLowerCase())) return false;
    return true;
  });

  return `
  <div style="text-align:center;padding:80px 20px 56px;position:relative;overflow:hidden">
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:800px;height:500px;background:radial-gradient(ellipse,rgba(124,58,237,.11) 0%,transparent 70%);pointer-events:none"></div>
    <div class="inter" style="font-size:11px;color:#A78BFA;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-bottom:14px">Portfolio Collaboratif</div>
    <h1 class="sg grad" style="font-size:clamp(48px,10vw,90px);font-weight:700;line-height:1.04;margin-bottom:16px">DevHub</h1>
    <p class="inter" style="font-size:15px;color:#9CA3AF;max-width:440px;margin:0 auto 36px;line-height:1.7">Tous nos projets, leurs mises à jour et leur code — au même endroit.</p>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
      ${stats.map((s) => `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:12px 22px">
        <div class="sg" style="font-size:26px;font-weight:700;color:${s.c}">${s.v}</div>
        <div class="inter" style="font-size:11px;color:#6B7280">${s.l}</div></div>`).join("")}
    </div>
  </div>

  <section style="padding:0 20px 56px;max-width:1300px;margin:0 auto">
    <div class="sg" style="font-size:20px;font-weight:700;margin-bottom:18px">👥 L'équipe</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px">
      ${state.collabs.map((c) => {
        const n = state.projects.filter((p) => p.collaborators?.includes(c.id)).length;
        return `<div class="card" style="padding:20px">
          <div style="display:flex;gap:14px;align-items:center;margin-bottom:10px">
            ${avatarHTML(c, 52)}
            <div><div class="sg" style="font-weight:700;font-size:16px">${esc(c.name)}</div><div class="inter" style="font-size:12px;color:#A78BFA">${esc(c.role)}</div></div>
          </div>
          ${c.bio ? `<div class="inter" style="font-size:13px;color:#9CA3AF;line-height:1.5;margin-bottom:8px">${esc(c.bio)}</div>` : ""}
          <div class="inter" style="font-size:12px;color:#4B5563">${n} projet${n !== 1 ? "s" : ""}</div>
        </div>`;
      }).join("") || `<div class="inter" style="color:#6B7280;font-size:13px">Aucun membre.${state.loggedIn ? " Ajoute-toi via Admin → Membres." : ""}</div>`}
    </div>
  </section>

  <section style="padding:0 20px 100px;max-width:1300px;margin:0 auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px">
      <div class="sg" style="font-size:20px;font-weight:700">🚀 Projets</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input class="inp" id="search-input" placeholder="🔍 Rechercher..." value="${esc(state.search)}" style="width:180px;padding:7px 12px;font-size:13px">
        <div style="display:flex;gap:5px">
          ${[["all", "Tous"], ["solo", "Solo"], ["collab", "Collab"]].map(([v, l]) => `<button class="ft${state.filter === v ? " on" : ""}" data-filter="${v}">${l}</button>`).join("")}
        </div>
        ${state.loggedIn ? `<button class="bp" id="btn-add-project" style="font-size:12px">+ Créer</button>` : ""}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
      ${filtered.map((p) => projectCardHTML(p)).join("") || `<div class="inter" style="color:#6B7280;font-size:13px;grid-column:1/-1;padding:20px 0">Aucun projet trouvé.</div>`}
    </div>
  </section>`;
}

function projectCardHTML(p) {
  const team = state.collabs.filter((c) => p.collaborators?.includes(c.id));
  const isSolo = p.type === "solo";
  return `<div class="card" style="padding:22px;cursor:pointer;position:relative" data-open-project="${p.id}">
    ${state.loggedIn ? `<button class="bd" data-del-project="${p.id}" style="position:absolute;top:14px;right:14px;font-size:11px;padding:3px 8px">✕</button>` : ""}
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;padding-right:${state.loggedIn ? 36 : 0}px">
      <span class="tag ${isSolo ? "b-solo" : "b-collab"}" style="font-size:11px">${isSolo ? "Solo" : "Collab"}</span>
      ${p.hasServer ? `<span class="tag b-server" style="font-size:11px">🌐 Live</span>` : ""}
      ${p.hasDownload ? `<span class="tag b-dl" style="font-size:11px">📦 DL</span>` : ""}
      ${p.hasEmbed ? `<span class="tag b-html" style="font-size:11px">📄 Intégré</span>` : ""}
    </div>
    <div class="sg" style="font-size:17px;font-weight:700;margin-bottom:8px">${esc(p.title)}</div>
    <div class="inter" style="font-size:13px;color:#9CA3AF;line-height:1.6;margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(p.description)}</div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px">${(p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,.06);padding-top:12px">
      <div style="display:flex">${team.map((c, i) => `<div style="margin-left:${i ? -7 : 0}px" title="${esc(c.name)}">${avatarHTML(c, 26)}</div>`).join("")}</div>
      ${p.updates?.[0] ? `<div class="mono" style="font-size:11px;color:#6B7280">↑ ${fd(p.updates[0].date)}</div>` : ""}
    </div>
  </div>`;
}

// ─── PROJECT PAGE ─────────────────────────────────────────────────────────
let projectTab = "desc";
let embedCurrentPage = null; // page actuellement affichée pour un embed multi-pages (zip)
function buildEmbedSrcDoc(embed) {
  if (!embed) return "";
  if (embed.mode === "zip" && embed.pages) {
    const page = embedCurrentPage && embed.pages[embedCurrentPage] ? embedCurrentPage : embed.defaultPage;
    return embed.pages[page] || "";
  }
  if (!embed.html) return "";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${embed.css || ""}</style></head><body>${embed.html}<script>${embed.js || ""}<\/script></body></html>`;
}
// Écoute les clics sur des liens internes capturés dans les pages embarquées (voir zip-embed.js)
window.addEventListener("message", (e) => {
  if (e.data && e.data.devhubNav) {
    embedCurrentPage = e.data.devhubNav;
    if (state.view === "project" && projectTab === "preview") render();
  }
});
function renderProject() {
  const project = state.projects.find((p) => p.id === state.selId);
  if (!project) return `<div style="padding:40px;text-align:center" class="inter">Projet introuvable.</div>`;
  const team = state.collabs.filter((c) => project.collaborators?.includes(c.id));
  const pc = state.comments.filter((c) => c.projectId === project.id);
  const isSolo = project.type === "solo";
  const embedSrc = project.hasEmbed ? buildEmbedSrcDoc(project.embed) : "";

  const tabs = [
    { id: "desc", label: "📝 Description" },
    ...(project.hasEmbed && embedSrc ? [{ id: "preview", label: "👁 Aperçu" }] : []),
    { id: "history", label: `📋 Historique (${project.updates?.length || 0})` },
    { id: "comments", label: `💬 Avis (${pc.length})` },
  ];
  if (!tabs.find((t) => t.id === projectTab)) projectTab = "desc";

  return `<div class="fu" style="max-width:920px;margin:0 auto;padding:28px 20px 80px">
    <div style="display:flex;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:8px">
      <button class="bg" style="font-size:12px" data-go="home">← Retour</button>
      ${state.loggedIn ? `<div style="display:flex;gap:8px">
        <button class="bg" style="font-size:12px" id="btn-edit-project">✏️ Modifier</button>
        <button class="bp" style="font-size:12px" id="btn-push">⚡ Push</button>
      </div>` : ""}
    </div>

    <div style="margin-bottom:28px">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        <span class="tag ${isSolo ? "b-solo" : "b-collab"}" style="font-size:12px">${isSolo ? "👤 Solo" : "👥 Collaboratif"}</span>
        ${project.hasServer ? `<span class="tag b-server" style="font-size:12px">🌐 Live</span>` : ""}
        ${project.hasDownload ? `<span class="tag b-dl" style="font-size:12px">📦 Téléchargeable</span>` : ""}
        ${project.hasEmbed ? `<span class="tag b-html" style="font-size:12px">📄 Intégré</span>` : ""}
        ${(project.tags || []).map((t) => `<span class="tag" style="font-size:12px">${esc(t)}</span>`).join("")}
      </div>
      <h1 class="sg" style="font-size:clamp(28px,5vw,46px);font-weight:700;margin-bottom:12px">${esc(project.title)}</h1>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
        ${team.map((c) => `<div style="display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:100px;padding:5px 12px 5px 6px">${avatarHTML(c, 24)}<span class="inter" style="font-size:12px;color:#D1D5DB">${esc(c.name)}</span></div>`).join("")}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${project.hasServer && project.serverUrl ? `<a href="${esc(project.serverUrl)}" target="_blank" rel="noopener noreferrer" class="bp" style="font-size:13px">🌐 Voir en ligne</a>` : ""}
        ${project.hasDownload && project.downloadUrl ? `<a href="${esc(project.downloadUrl)}" target="_blank" rel="noopener noreferrer" class="bg" style="font-size:13px">⬇ Code source</a>` : ""}
      </div>
    </div>

    <div style="border-bottom:1px solid rgba(255,255,255,.07);margin-bottom:28px;overflow-x:auto;display:flex">
      ${tabs.map((t) => `<button class="ptab${projectTab === t.id ? " on" : ""}" data-ptab="${t.id}">${t.label}</button>`).join("")}
    </div>

    <div id="ptab-content">${renderProjectTabContent(project, embedSrc, pc)}</div>
  </div>`;
}

function renderProjectTabContent(project, embedSrc, pc) {
  if (projectTab === "desc") {
    return `<div class="inter" style="font-size:14px;color:#D1D5DB;line-height:1.8;white-space:pre-wrap">${esc(project.description)}</div>`;
  }
  if (projectTab === "preview") {
    const isMultiPage = project.embed?.mode === "zip" && project.embed?.pages && Object.keys(project.embed.pages).length > 1;
    const currentPage = embedCurrentPage && project.embed?.pages?.[embedCurrentPage] ? embedCurrentPage : project.embed?.defaultPage;
    return `<div>
      ${isMultiPage ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        ${Object.keys(project.embed.pages).map((p) => `<button class="stab${p === currentPage ? " on" : ""}" data-embed-page="${esc(p)}">${esc(p)}</button>`).join("")}
      </div>` : `<div class="inter" style="font-size:12px;color:#6B7280;margin-bottom:12px">Rendu du projet intégré :</div>`}
      <div style="border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden">
        <iframe srcdoc="${esc(embedSrc)}" title="aperçu" style="width:100%;height:560px;border:none;display:block;background:#fff" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
      </div>
    </div>`;
  }
  if (projectTab === "history") {
    const updates = project.updates || [];
    if (!updates.length) return `<div class="inter" style="color:#6B7280;font-size:13px">Aucune mise à jour pour l'instant.</div>`;
    return updates.map((u, i) => `
      <div style="display:flex;gap:12px">
        <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
          <div style="width:20px;height:20px;border-radius:50%;background:${i === 0 ? "linear-gradient(135deg,#7C3AED,#06B6D4)" : "rgba(124,58,237,.25)"};border:${i === 0 ? "none" : "1px solid rgba(124,58,237,.4)"};box-shadow:${i === 0 ? "0 0 12px rgba(124,58,237,.6)" : "none"};display:flex;align-items:center;justify-content:center;font-size:8px;color:#fff;flex-shrink:0">${i === 0 ? "★" : "·"}</div>
          ${i < updates.length - 1 ? `<div style="width:1px;flex:1;background:rgba(124,58,237,.2);margin-top:3px;min-height:24px"></div>` : ""}
        </div>
        <div style="padding-bottom:18px;flex:1">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;flex-wrap:wrap;gap:4px">
            <div><span class="inter" style="font-size:13px;color:#A78BFA;font-weight:600">${esc(u.author)}</span><span class="mono" style="font-size:11px;color:#6B7280;margin-left:8px">${fd(u.date)}</span></div>
            ${state.loggedIn ? `<button class="bd" data-del-update="${i}" style="font-size:10px;padding:2px 7px">✕</button>` : ""}
          </div>
          <div class="inter" style="color:#D1D5DB;font-size:13px;line-height:1.6">${esc(u.description)}</div>
        </div>
      </div>`).join("");
  }
  if (projectTab === "comments") {
    return `<div>
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:16px;margin-bottom:18px">
        <input class="inp" id="comment-name" placeholder="Votre nom" style="margin-bottom:8px;max-width:220px">
        <textarea class="ta" id="comment-text" placeholder="Partagez votre avis..." rows="3" style="margin-bottom:10px"></textarea>
        <button class="bp" id="btn-comment" style="font-size:13px">Publier</button>
      </div>
      ${pc.length === 0 ? `<div class="inter" style="color:#6B7280;font-size:13px">Aucun avis. Soyez le premier !</div>` : ""}
      <div style="display:flex;flex-direction:column;gap:10px">
        ${pc.map((c) => `<div class="flat" style="padding:14px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span class="inter" style="font-weight:600;color:#A78BFA;font-size:14px">${esc(c.author)}</span>
            <span class="mono" style="font-size:11px;color:#6B7280">${fd(c.createdAt)}</span>
          </div>
          <div class="inter" style="color:#D1D5DB;font-size:13px;line-height:1.6">${esc(c.content)}</div>
        </div>`).join("")}
      </div>
    </div>`;
  }
  return "";
}

// ─── ADMIN ────────────────────────────────────────────────────────────────
let adminTab = "projects";
function renderAdmin() {
  const totalUpdates = state.projects.reduce((s, p) => s + (p.updates?.length || 0), 0);
  return `<div class="fu" style="max-width:1000px;margin:0 auto;padding:28px 20px 80px">
    <div style="margin-bottom:28px">
      <div class="sg" style="font-size:26px;font-weight:700;margin-bottom:4px">⚙ Panneau Admin</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
        ${[{ v: state.projects.length, l: "Projets", c: "#A78BFA" }, { v: state.collabs.length, l: "Membres", c: "#22D3EE" }, { v: totalUpdates, l: "Mises à jour", c: "#34D399" }, { v: state.projects.filter((p) => p.hasServer).length, l: "En ligne", c: "#FBB54A" }].map((s) => `
          <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:10px 20px">
            <div class="sg" style="font-size:20px;font-weight:700;color:${s.c}">${s.v}</div>
            <div class="inter" style="font-size:11px;color:#6B7280">${s.l}</div>
          </div>`).join("")}
      </div>
    </div>
    <div style="display:flex;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:26px">
      ${[["projects", "🗂 Projets"], ["collabs", "👥 Membres"]].map(([k, l]) => `<button class="ptab${adminTab === k ? " on" : ""}" data-atab="${k}">${l}</button>`).join("")}
    </div>
    <div id="atab-content">${renderAdminTabContent()}</div>
  </div>`;
}
function renderAdminTabContent() {
  if (adminTab === "projects") {
    return `<button class="bp" id="btn-add-project-admin" style="margin-bottom:18px;font-size:13px">+ Nouveau projet</button>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${state.projects.map((p) => `<div class="flat" style="padding:14px 18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <div class="sg" style="font-weight:600;font-size:14px">${esc(p.title)}</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">
              <span class="inter" style="font-size:11px;color:#6B7280">${esc(p.type)} · ${p.updates?.length || 0} màj</span>
              ${p.hasServer ? `<span class="tag b-server" style="font-size:10px">🌐 Live</span>` : ""}
              ${p.hasDownload ? `<span class="tag b-dl" style="font-size:10px">📦 DL</span>` : ""}
              ${p.hasEmbed ? `<span class="tag b-html" style="font-size:10px">📄 Intégré</span>` : ""}
            </div>
          </div>
          <button class="bd" data-del-project="${p.id}">Supprimer</button>
        </div>`).join("") || `<div class="inter" style="color:#6B7280;font-size:13px">Aucun projet.</div>`}
      </div>`;
  }
  return `<button class="bp" id="btn-add-collab" style="margin-bottom:18px;font-size:13px">+ Nouveau membre</button>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">
      ${state.collabs.map((c) => `<div class="flat" style="padding:16px;position:relative">
        <button class="bd" data-del-collab="${c.id}" style="position:absolute;top:12px;right:12px;font-size:10px;padding:2px 7px">✕</button>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:6px;padding-right:36px">
          ${avatarHTML(c, 40)}
          <div><div class="sg" style="font-weight:600;font-size:14px">${esc(c.name)}</div><div class="inter" style="font-size:11px;color:#A78BFA">${esc(c.role)}</div></div>
        </div>
        ${c.bio ? `<div class="inter" style="font-size:11px;color:#9CA3AF;line-height:1.4">${esc(c.bio)}</div>` : ""}
      </div>`).join("")}
    </div>`;
}

// ─── MODAL: LOGIN ──────────────────────────────────────────────────────────
function openLoginModal() {
  const mr = document.getElementById("modal-root");
  mr.innerHTML = `<div class="overlay" id="overlay"><div class="modal pi" style="max-width:340px">
    <div style="text-align:center;margin-bottom:22px">
      <div style="font-size:30px;margin-bottom:8px">🔐</div>
      <div class="sg" style="font-size:20px;font-weight:700">Espace Modérateurs</div>
      <div class="inter" style="font-size:13px;color:#6B7280;margin-top:4px">Connexion via Firebase Auth</div>
    </div>
    <input class="inp" id="login-email" placeholder="Email" style="margin-bottom:8px">
    <input class="inp" id="login-pw" type="password" placeholder="Mot de passe" style="margin-bottom:8px">
    <div id="login-err" class="inter" style="color:#F87171;font-size:12px;margin-bottom:8px"></div>
    <button class="bp" id="login-submit" style="width:100%">Se connecter</button>
  </div></div>`;
  document.getElementById("overlay").onclick = (e) => { if (e.target.id === "overlay") closeModal(); };
  document.getElementById("login-submit").onclick = async () => {
    const email = document.getElementById("login-email").value;
    const pw = document.getElementById("login-pw").value;
    const btn = document.getElementById("login-submit");
    btn.disabled = true; btn.textContent = "Connexion...";
    try { await loginModerator(email, pw); closeModal(); }
    catch { document.getElementById("login-err").textContent = "Email ou mot de passe incorrect."; btn.disabled = false; btn.textContent = "Se connecter"; }
  };
}
function closeModal() { document.getElementById("modal-root").innerHTML = ""; }

// ─── MODAL: NEWS POPUP ──────────────────────────────────────────────────────
function openNewsPopup() {
  if (!state.news.length) return;
  const item = state.news[0];
  const mr = document.getElementById("modal-root");
  mr.innerHTML = `<div class="overlay" id="overlay"><div class="modal pi" style="max-width:380px;background:linear-gradient(135deg,rgba(124,58,237,.18),rgba(6,182,212,.1));border:1px solid rgba(124,58,237,.35)">
    <div style="display:flex;justify-content:space-between;margin-bottom:14px">
      <div style="display:flex;gap:10px;align-items:center">
        <span class="pulse" style="font-size:22px">🔔</span>
        <div><div class="inter" style="font-size:10px;color:#A78BFA;font-weight:600;letter-spacing:2px;text-transform:uppercase">Nouvelle mise à jour</div>
        <div class="sg" style="font-size:17px;font-weight:700">${esc(item.projectTitle)}</div></div>
      </div>
      <button id="popup-close" style="background:none;border:none;color:#6B7280;cursor:pointer;font-size:18px">✕</button>
    </div>
    <p class="inter" style="color:#D1D5DB;font-size:14px;line-height:1.6;margin:0 0 6px"><span style="color:#A78BFA;font-weight:600">${esc(item.author)}</span> ${esc(item.description)}</p>
    <div class="mono" style="font-size:11px;color:#6B7280;margin-bottom:18px">${fd(item.createdAt)}</div>
    <button class="bp" id="popup-view" style="width:100%;font-size:13px">Voir le projet →</button>
  </div></div>`;
  const closeFn = () => closeModal();
  document.getElementById("overlay").onclick = (e) => { if (e.target.id === "overlay") closeFn(); };
  document.getElementById("popup-close").onclick = closeFn;
  document.getElementById("popup-view").onclick = () => { closeFn(); state.selId = item.projectId; state.view = "project"; projectTab = "desc"; embedCurrentPage = null; render(); };
  setTimeout(() => { if (document.getElementById("overlay")) closeFn(); }, 9000);
}

// ─── MODAL: PUSH UPDATE ─────────────────────────────────────────────────────
function openPushModal(project) {
  const mr = document.getElementById("modal-root");
  mr.innerHTML = `<div class="overlay" id="overlay"><div class="modal pi" style="max-width:440px">
    <div class="sg" style="font-size:18px;font-weight:700;margin-bottom:4px">⚡ Push une mise à jour</div>
    <div class="inter" style="font-size:12px;color:#6B7280;margin-bottom:18px">Projet : <span style="color:#A78BFA">${esc(project.title)}</span></div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><div class="inter" style="font-size:11px;color:#6B7280;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">Auteur</div>
      <select class="sel" id="push-author">${state.collabs.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("")}</select></div>
      <div><div class="inter" style="font-size:11px;color:#6B7280;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">Description *</div>
      <textarea class="ta" id="push-desc" placeholder="Décrivez ce qui a été ajouté ou modifié..." rows="4"></textarea></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:18px">
      <button class="bp" id="push-submit" style="flex:1">Pousser ⚡</button>
      <button class="bg" id="push-cancel">Annuler</button>
    </div>
  </div></div>`;
  document.getElementById("overlay").onclick = (e) => { if (e.target.id === "overlay") closeModal(); };
  document.getElementById("push-cancel").onclick = closeModal;
  document.getElementById("push-submit").onclick = async () => {
    const desc = document.getElementById("push-desc").value.trim();
    const author = document.getElementById("push-author").value;
    if (!desc) return;
    const btn = document.getElementById("push-submit"); btn.disabled = true; btn.textContent = "Envoi...";
    const update = { date: now(), author, description: desc };
    const updates = [update, ...(project.updates || [])];
    await updateProject(project.id, { updates });
    await addNews({ author: update.author, projectId: project.id, projectTitle: project.title, description: update.description });
    closeModal();
  };
}

// ─── MODAL: ADD COLLAB ──────────────────────────────────────────────────────
const COLORS = ["#7C3AED", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6", "#3B82F6", "#F97316"];
function openAddCollabModal() {
  let chosenColor = COLORS[0];
  const mr = document.getElementById("modal-root");
  mr.innerHTML = `<div class="overlay" id="overlay"><div class="modal pi" style="max-width:380px">
    <div class="sg" style="font-size:18px;font-weight:700;margin-bottom:18px">👤 Nouveau collaborateur</div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><div class="inter" style="font-size:11px;color:#6B7280;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">Nom *</div><input class="inp" id="cb-name" placeholder="Prénom"></div>
      <div><div class="inter" style="font-size:11px;color:#6B7280;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">Rôle</div><input class="inp" id="cb-role" placeholder="Dev Frontend, Designer..."></div>
      <div><div class="inter" style="font-size:11px;color:#6B7280;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">Bio</div><textarea class="ta" id="cb-bio" placeholder="Courte présentation..." rows="2"></textarea></div>
      <div><div class="inter" style="font-size:11px;color:#6B7280;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">Couleur d'avatar</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap" id="cb-colors">
          ${COLORS.map((c, i) => `<div data-color="${c}" style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;border:3px solid ${i === 0 ? "white" : "transparent"}"></div>`).join("")}
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:20px">
      <button class="bp" id="cb-submit" style="flex:1">Ajouter</button>
      <button class="bg" id="cb-cancel">Annuler</button>
    </div>
  </div></div>`;
  document.getElementById("overlay").onclick = (e) => { if (e.target.id === "overlay") closeModal(); };
  document.getElementById("cb-cancel").onclick = closeModal;
  document.querySelectorAll("#cb-colors div").forEach((el) => {
    el.onclick = () => { chosenColor = el.dataset.color; document.querySelectorAll("#cb-colors div").forEach((x) => x.style.border = "3px solid transparent"); el.style.border = "3px solid white"; };
  });
  document.getElementById("cb-submit").onclick = async () => {
    const name = document.getElementById("cb-name").value.trim();
    if (!name) return;
    const role = document.getElementById("cb-role").value.trim();
    const bio = document.getElementById("cb-bio").value.trim();
    await addCollab({ name, role, bio, color: chosenColor, initials: name.slice(0, 2).toUpperCase() });
    closeModal();
  };
}

// ─── MODAL: ADD/EDIT PROJECT (avec embed editor) ───────────────────────────
function openProjectModal(initial) {
  const isEdit = !!initial;
  const f = initial ? { ...initial, tags: (initial.tags || []).join(", "), collaborators: [...(initial.collaborators || [])] } : {
    title: "", description: "", type: "solo", collaborators: [], tags: "",
    hasServer: false, serverUrl: "",
    hasDownload: false, downloadUrl: "", zipUrl: "", zipPath: "", zipName: "",
    hasEmbed: false, embed: { mode: "fields", html: "", css: "", js: "", zipName: "" },
  };
  let embedStab = "html";

  const mr = document.getElementById("modal-root");

  function paint() {
    mr.innerHTML = `<div class="overlay" id="overlay"><div class="modal pi" style="max-width:560px">
      <div class="sg" style="font-size:18px;font-weight:700;margin-bottom:20px">${isEdit ? "✏️ Modifier le projet" : "➕ Nouveau projet"}</div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div><label-title>Titre *</label-title><input class="inp" id="pj-title" placeholder="Nom du projet" value="${esc(f.title)}"></div>
        <div><label-title>Description *</label-title><textarea class="ta" id="pj-desc" placeholder="Décrivez votre projet..." rows="3">${esc(f.description)}</textarea></div>
        <div><label-title>Tags (séparés par des virgules)</label-title><input class="inp" id="pj-tags" placeholder="React, C, Python, Firebase..." value="${esc(f.tags)}"></div>

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:140px"><label-title>Type</label-title>
            <select class="sel" id="pj-type"><option value="solo" ${f.type === "solo" ? "selected" : ""}>👤 Solo</option><option value="collab" ${f.type === "collab" ? "selected" : ""}>👥 Collaboratif</option></select></div>
          <div style="flex:2"><label-title>Collaborateurs</label-title>
            <div style="display:flex;flex-wrap:wrap;gap:10px;padding-top:6px" id="pj-collabs">
              ${state.collabs.map((c) => `<label style="display:flex;align-items:center;gap:6px"><input type="checkbox" data-collab-id="${c.id}" ${f.collaborators.includes(c.id) ? "checked" : ""}><span class="inter" style="font-size:13px;color:#D1D5DB">${esc(c.name)}</span></label>`).join("") || `<span class="inter" style="font-size:12px;color:#6B7280">Ajoute d'abord un membre dans Admin → Membres.</span>`}
            </div>
          </div>
        </div>

        <div style="height:1px;background:rgba(255,255,255,.06);margin:4px 0"></div>
        <label-title>Options d'accès</label-title>

        <div>
          <div class="tog-wrap" id="tog-server"><div class="tog${f.hasServer ? " on" : ""}"><div class="tog-dot"></div></div>
            <div><div class="inter" style="font-size:14px">🌐 Ce projet a un site en ligne</div><div class="inter" style="font-size:12px;color:#6B7280">Lien direct vers l'application déployée</div></div></div>
          ${f.hasServer ? `<input class="inp" id="pj-serverurl" placeholder="https://mon-projet.vercel.app" value="${esc(f.serverUrl)}" style="margin-top:10px">` : ""}
        </div>

        <div>
          <div class="tog-wrap" id="tog-embed"><div class="tog${f.hasEmbed ? " on" : ""}"><div class="tog-dot"></div></div>
            <div><div class="inter" style="font-size:14px">📄 Intégrer le projet (sans serveur)</div><div class="inter" style="font-size:12px;color:#6B7280">Colle ton HTML/CSS/JS séparément, ou dépose un .zip</div></div></div>
          ${f.hasEmbed ? `<div id="embed-editor" style="margin-top:10px"></div>` : ""}
        </div>

        <div>
          <div class="tog-wrap" id="tog-download"><div class="tog${f.hasDownload ? " on" : ""}"><div class="tog-dot"></div></div>
            <div><div class="inter" style="font-size:14px">📦 Autoriser le téléchargement</div><div class="inter" style="font-size:12px;color:#6B7280">Lien vers le code (GitHub, Drive, releases...)</div></div></div>
          ${f.hasDownload ? `<input class="inp" id="pj-downloadurl" placeholder="https://github.com/toi/mon-projet" value="${esc(f.downloadUrl)}" style="margin-top:10px">` : ""}
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:22px">
        <button class="bp" id="pj-submit" style="flex:1">${isEdit ? "Sauvegarder" : "Créer le projet"}</button>
        <button class="bg" id="pj-cancel">Annuler</button>
      </div>
    </div></div>`;

    // replace custom <label-title> tags with proper divs (simple inline style helper)
    mr.querySelectorAll("label-title").forEach((el) => {
      const div = document.createElement("div");
      div.className = "inter"; div.style.cssText = "font-size:11px;color:#6B7280;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px";
      div.textContent = el.textContent;
      el.replaceWith(div);
    });

    document.getElementById("overlay").onclick = (e) => { if (e.target.id === "overlay") closeModal(); };
    document.getElementById("pj-cancel").onclick = closeModal;
    document.getElementById("tog-server").onclick = () => { f.hasServer = !f.hasServer; syncFields(); paint(); };
    document.getElementById("tog-embed").onclick = () => { f.hasEmbed = !f.hasEmbed; syncFields(); paint(); };
    document.getElementById("tog-download").onclick = () => { f.hasDownload = !f.hasDownload; syncFields(); paint(); };

    if (f.hasEmbed) paintEmbedEditor();

    document.getElementById("pj-submit").onclick = submit;
  }

  function syncFields() {
    f.title = document.getElementById("pj-title")?.value ?? f.title;
    f.description = document.getElementById("pj-desc")?.value ?? f.description;
    f.tags = document.getElementById("pj-tags")?.value ?? f.tags;
    f.type = document.getElementById("pj-type")?.value ?? f.type;
    f.serverUrl = document.getElementById("pj-serverurl")?.value ?? f.serverUrl;
    f.downloadUrl = document.getElementById("pj-downloadurl")?.value ?? f.downloadUrl;
    document.querySelectorAll("#pj-collabs input[type=checkbox]").forEach((cb) => {
      const id = cb.dataset.collabId;
      if (cb.checked && !f.collaborators.includes(id)) f.collaborators.push(id);
      if (!cb.checked) f.collaborators = f.collaborators.filter((x) => x !== id);
    });
  }

  function paintEmbedEditor() {
    const el = document.getElementById("embed-editor");
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;gap:6px;margin-bottom:12px">
        <button type="button" class="stab${f.embed.mode === "fields" ? " on" : ""}" id="embed-mode-fields">✏️ Coller le code</button>
        <button type="button" class="stab${f.embed.mode === "zip" ? " on" : ""}" id="embed-mode-zip">📦 Déposer un .zip</button>
      </div>
      <div id="embed-body"></div>
    `;
    document.getElementById("embed-mode-fields").onclick = () => { f.embed.mode = "fields"; paintEmbedEditor(); };
    document.getElementById("embed-mode-zip").onclick = () => { f.embed.mode = "zip"; paintEmbedEditor(); };
    const body = document.getElementById("embed-body");
    if (f.embed.mode === "zip") {
      body.innerHTML = `<div class="upzone" id="embed-zip-zone"><input type="file" id="embed-zip-input" accept=".zip" style="display:none">
        <div id="embed-zip-content">${f.embed.pages ? `<div class="inter" style="color:#34D399;font-size:13px">✓ ${esc(f.embed.zipName || "")}</div>` : `<div style="font-size:22px;margin-bottom:6px">📦</div><div class="inter" style="font-size:13px;color:#9CA3AF">Glisser le .zip de votre projet (toutes les pages HTML, CSS, JS, images)</div><div class="inter" style="font-size:11px;color:#6B7280;margin-top:2px">Plusieurs fichiers .html, un dossier d'images, plusieurs niveaux de dossiers : tout est géré automatiquement</div>`}</div>
      </div>
      ${f.embed.pages ? `<div class="inter" style="font-size:11px;color:#34D399;margin-top:8px">✓ ${Object.keys(f.embed.pages).length} page${Object.keys(f.embed.pages).length > 1 ? "s" : ""} détectée${Object.keys(f.embed.pages).length > 1 ? "s" : ""} (${Object.keys(f.embed.pages).join(", ")}) — ${f.embed.totalSizeKB} Ko au total</div>` : ""}
      ${f.embed.totalSizeKB > 3000 ? `<div class="inter" style="font-size:11px;color:#FBB54A;margin-top:6px">⚠️ Projet assez lourd (${f.embed.totalSizeKB} Ko) malgré la compression automatique des images. ${f.embed.totalSizeKB > 8000 ? "Au-delà de 8 Mo, une confirmation te sera demandée avant l'envoi." : "Ça reste raisonnable."}</div>` : ""}`;
      const zone = document.getElementById("embed-zip-zone");
      const input = document.getElementById("embed-zip-input");
      const handleZipFile = async (file) => {
        const progressEl = () => document.getElementById("embed-zip-content");
        if (progressEl()) progressEl().innerHTML = `<div class="inter" style="color:#A78BFA;font-size:13px"><span class="spin">⏳</span> Extraction des fichiers...</div>`;
        try {
          const result = await extractZipToPages(file, (msg) => { if (progressEl()) progressEl().innerHTML = `<div class="inter" style="color:#A78BFA;font-size:13px"><span class="spin">⏳</span> ${esc(msg)}</div>`; });
          f.embed = { mode: "zip", pages: result.pages, defaultPage: result.defaultPage, totalSizeKB: result.totalSizeKB, zipName: file.name };
          paintEmbedEditor();
        } catch (e) {
          alert("Erreur lecture zip : " + e.message);
          paintEmbedEditor();
        }
      };
      zone.onclick = () => input.click();
      zone.ondragover = (e) => { e.preventDefault(); zone.classList.add("drag"); };
      zone.ondragleave = () => zone.classList.remove("drag");
      zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove("drag"); if (e.dataTransfer.files[0]) handleZipFile(e.dataTransfer.files[0]); };
      input.onchange = (e) => { if (e.target.files[0]) handleZipFile(e.target.files[0]); };
    } else {
      body.innerHTML = `
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button type="button" class="stab${embedStab === "html" ? " on" : ""}" id="estab-html">HTML</button>
          <button type="button" class="stab${embedStab === "css" ? " on" : ""}" id="estab-css">CSS</button>
          <button type="button" class="stab${embedStab === "js" ? " on" : ""}" id="estab-js">JavaScript</button>
        </div>
        <textarea class="ta code-ta" id="embed-code" rows="9" placeholder="${embedStab === "html" ? "<div>Mon contenu HTML...</div>" : embedStab === "css" ? "body { ... }" : "console.log('hello');"}">${esc(f.embed[embedStab] || "")}</textarea>
        <div class="inter" style="font-size:11px;color:#6B7280;margin-top:6px">Les 3 sont combinés automatiquement dans un seul aperçu.</div>
      `;
      document.getElementById("embed-code").oninput = (e) => { f.embed[embedStab] = e.target.value; f.embed.mode = "fields"; };
      document.getElementById("estab-html").onclick = () => { f.embed.html = document.getElementById("embed-code").value; embedStab = "html"; paintEmbedEditor(); };
      document.getElementById("estab-css").onclick = () => { if (embedStab === "html") f.embed.html = document.getElementById("embed-code").value; if (embedStab === "css") f.embed.css = document.getElementById("embed-code").value; embedStab = "css"; paintEmbedEditor(); };
      document.getElementById("estab-js").onclick = () => { const cur = document.getElementById("embed-code").value; f.embed[embedStab] = cur; embedStab = "js"; paintEmbedEditor(); };
    }
  }

  async function submit() {
    syncFields();
    if (!f.title.trim() || !f.description.trim()) return;
    if (f.hasEmbed && f.embed.mode === "zip" && f.embed.totalSizeKB > 8000) {
      const ok = confirm(
        `Ce projet intégré fait ${(f.embed.totalSizeKB / 1024).toFixed(1)} Mo même après compression automatique des images — c'est lourd pour la base de données (recommandé : sous 8 Mo).\n\n` +
        `Le site continuera de fonctionner, mais le chargement de la page projet sera plus lent pour les visiteurs.\n\n` +
        `Envoyer quand même ?`
      );
      if (!ok) return;
    }
    const btn = document.getElementById("pj-submit");
    btn.disabled = true; btn.textContent = "Envoi en cours...";
    const tags = f.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const collaborators = f.collaborators.length ? f.collaborators : [state.collabs[0]?.id].filter(Boolean);
    const payload = {
      title: f.title.trim(), description: f.description.trim(), type: f.type, tags, collaborators,
      hasServer: f.hasServer, serverUrl: f.serverUrl || "",
      hasEmbed: f.hasEmbed, embed: f.embed,
      hasDownload: f.hasDownload, downloadUrl: f.downloadUrl || "",
      updates: f.updates || [],
    };
    if (isEdit) {
      try { await updateProject(f.id, payload); }
      catch (e) { alert("Erreur lors de l'enregistrement : " + e.message); btn.disabled = false; btn.textContent = "Sauvegarder"; return; }
    } else {
      try { await addProject(payload); }
      catch (e) { alert("Erreur lors de l'enregistrement : " + e.message); btn.disabled = false; btn.textContent = "Créer le projet"; return; }
    }
    closeModal();
  }

  paint();
}

// ─── EVENT HANDLERS (delegation) ───────────────────────────────────────────
function attachGlobalHandlers() {
  root.querySelectorAll("[data-go]").forEach((el) => el.onclick = () => { state.view = el.dataset.go; if (el.dataset.go === "home") {} render(); });
  const loginBtn = document.getElementById("btn-login"); if (loginBtn) loginBtn.onclick = openLoginModal;
  const logoutBtn = document.getElementById("btn-logout"); if (logoutBtn) logoutBtn.onclick = () => { logoutModerator(); state.view = "home"; render(); };

  root.querySelectorAll("[data-open-project]").forEach((el) => el.onclick = () => { state.selId = el.dataset.openProject; state.view = "project"; projectTab = "desc"; embedCurrentPage = null; render(); });
  root.querySelectorAll("[data-del-project]").forEach((el) => el.onclick = async (e) => {
    e.stopPropagation();
    const p = state.projects.find((x) => x.id === el.dataset.delProject);
    if (!p || !confirm(`Supprimer "${p.title}" ?`)) return;
    await deleteProjectDoc(p.id);
    if (state.selId === p.id) { state.view = "home"; render(); }
  });
  root.querySelectorAll("[data-filter]").forEach((el) => el.onclick = () => { state.filter = el.dataset.filter; render(); });
  const search = document.getElementById("search-input"); if (search) {
    search.oninput = (e) => { state.search = e.target.value; render(); document.getElementById("search-input")?.focus(); };
  }
  const addBtn = document.getElementById("btn-add-project"); if (addBtn) addBtn.onclick = () => openProjectModal(null);
  const addBtnAdmin = document.getElementById("btn-add-project-admin"); if (addBtnAdmin) addBtnAdmin.onclick = () => openProjectModal(null);
  const addCollabBtn = document.getElementById("btn-add-collab"); if (addCollabBtn) addCollabBtn.onclick = openAddCollabModal;
  root.querySelectorAll("[data-del-collab]").forEach((el) => el.onclick = async () => { if (confirm("Supprimer ce membre ?")) await deleteCollabDoc(el.dataset.delCollab); });

  root.querySelectorAll("[data-atab]").forEach((el) => el.onclick = () => { adminTab = el.dataset.atab; document.getElementById("atab-content").innerHTML = renderAdminTabContent(); attachGlobalHandlers(); });

  // Project page
  const editBtn = document.getElementById("btn-edit-project"); if (editBtn) editBtn.onclick = () => openProjectModal({ ...state.projects.find((p) => p.id === state.selId), id: state.selId });
  const pushBtn = document.getElementById("btn-push"); if (pushBtn) pushBtn.onclick = () => openPushModal(state.projects.find((p) => p.id === state.selId));
  root.querySelectorAll("[data-ptab]").forEach((el) => el.onclick = () => { projectTab = el.dataset.ptab; render(); });
  root.querySelectorAll("[data-embed-page]").forEach((el) => el.onclick = () => { embedCurrentPage = el.dataset.embedPage; render(); });
  root.querySelectorAll("[data-del-update]").forEach((el) => el.onclick = async () => {
    const project = state.projects.find((p) => p.id === state.selId);
    const idx = parseInt(el.dataset.delUpdate, 10);
    const updates = (project.updates || []).filter((_, i) => i !== idx);
    await updateProject(project.id, { updates });
  });
  const commentBtn = document.getElementById("btn-comment"); if (commentBtn) commentBtn.onclick = async () => {
    const name = document.getElementById("comment-name").value.trim();
    const text = document.getElementById("comment-text").value.trim();
    if (!name || !text) return;
    await addComment({ projectId: state.selId, author: name, content: text });
  };
}

render();
