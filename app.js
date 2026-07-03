// app.js — DevHub avec thèmes, rôles et demandes développeur
import {
  watchAuth, loginModerator, logoutModerator,
  watchProjects, addProject, updateProject, deleteProjectDoc,
  watchCollabs, addCollab, deleteCollabDoc,
  watchNews, addNews,
  watchComments, addComment,
  watchUserRole, setUserRole, deleteUserRole, watchAllRoles,
  watchRequests, addRequest, updateRequest,
  watchAllInvitations, addInvitation, updateInvitation,
} from "./firebase-config.js";
import { extractZipToPages } from "./zip-embed.js";

const root = document.getElementById("root");

// ── THÈMES ───────────────────────────────────────────────────
const THEMES = [
  { id:"dark",      name:"Sombre",     c1:"#7C3AED", c2:"#06B6D4" },
  { id:"synthwave", name:"Synthwave",  c1:"#ff00ff", c2:"#00ffff" },
  { id:"glass",     name:"Glass",      c1:"#00e5ff", c2:"#7c3aed" },
  { id:"hud",       name:"HUD",        c1:"#00ff41", c2:"#00cc33" },
  { id:"bento",     name:"Bento",      c1:"#111",    c2:"#666"    },
];
function applyTheme(t) {
  state.theme = t; state.showThemePicker = false;
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("dh-theme", t);
  render();
}

// ── STATE ────────────────────────────────────────────────────
const state = {
  view:"home", selId:null,
  projects:[], collabs:[], news:[], comments:[], requests:[], allRoles:{},
  loggedIn:false, role:null, currentUid:null,  // null | 'developer' | 'admin'
  invitations:[],
  filter:"all", search:"",
  seenFirstNews:false, showPopupQueued:false,
  theme: localStorage.getItem("dh-theme") || "synthwave",
  showThemePicker:false,
};
document.documentElement.setAttribute("data-theme", state.theme);

// ── HELPERS ───────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2,9);
const fd  = d  => { if(!d) return ""; return new Date(d).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"}); };
const now = () => new Date().toISOString().split("T")[0];
const esc = s  => (s||"").toString().replace(/[&<>"']/g, c=>({`&`:"&amp;",`<`:"&lt;",`>`:"&gt;",`"`:"&quot;","'":"&#39;"}[c]));
const avatarHTML = (c, size=32) => `<div class="avatar" style="width:${size}px;height:${size}px;background:${c.color};font-size:${size*.38}px">${esc(c.initials||c.name[0])}</div>`;
const isAdmin = () => state.loggedIn && state.role === "admin";
const isDev   = () => state.loggedIn && (state.role === "developer" || state.role === "admin");

const currentCollab = () => state.collabs.find(c => c.uid === state.currentUid) || null;
const STATUS_MAP = {
  wip:     { label:"En cours 🔧",  cls:"b-wip"     },
  done:    { label:"Terminé ✅",   cls:"b-done"    },
  pause:   { label:"En pause ⏸",  cls:"b-pause"   },
  archive: { label:"Archivé 📦",   cls:"b-archive" },
};

// ── FIREBASE LISTENERS ────────────────────────────────────────
let unsubRole = null;
watchAuth(user => {
  state.loggedIn = !!user;
  state.currentUid = user?.uid || null;
  if(unsubRole) { unsubRole(); unsubRole=null; }
  if(user) {
    unsubRole = watchUserRole(user.uid, role => { state.role = role; render(); });
  } else {
    state.role = null; render();
  }
});
watchProjects(p => { state.projects=p; render(); });
watchCollabs(c  => { state.collabs=c;  render(); });
watchNews(n => {
  state.news=n;
  if(!state.seenFirstNews && n.length){ state.seenFirstNews=true; setTimeout(()=>{ state.showPopupQueued=true; render(); },900); }
  render();
});
watchComments(c => { state.comments=c; render(); });
watchRequests(r => { state.requests=r; render(); });
watchAllInvitations(inv => { state.invitations=inv; render(); });
watchAllRoles(r => { state.allRoles=r; render(); });

// ── RENDER ────────────────────────────────────────────────────
function render() {
  root.innerHTML = `
    ${renderTicker()}
    ${renderNav()}
    <div id="view-content">
      ${state.view==="home"    ? renderHome()    : ""}
      ${state.view==="project" && state.projects.find(p=>p.id===state.selId) ? renderProject() : ""}
      ${state.view==="admin"   && isAdmin()      ? renderAdmin()   : ""}
    </div>
    ${renderFooter()}
    <div id="modal-root"></div>
    ${renderCookieBanner()}`;
  attachHandlers();
  if(state.showPopupQueued){ state.showPopupQueued=false; openNewsPopup(); }
}

// ── TICKER ────────────────────────────────────────────────────
function renderTicker() {
  if(!state.news.length) return "";
  const items=[...state.news,...state.news];
  return `<div style="background:var(--tkbg);border-bottom:1px solid var(--tkbd);padding:7px 0"><div class="tw"><div class="ti">
    ${items.map((n,i)=>`<span class="inter" style="margin-right:90px;font-size:12px;color:var(--tktx);flex-shrink:0">
      <span style="color:var(--tknm);font-weight:600">⚡ ${esc(n.author)}</span> ${esc(n.description)} →
      <span style="color:var(--tkpj)">${esc(n.projectTitle)}</span>
      <span style="color:var(--tx3)">· ${fd(n.createdAt)}</span></span>`).join("")}
  </div></div></div>`;
}

// ── THEME PICKER ──────────────────────────────────────────────
function renderThemePicker() {
  return `<div class="theme-picker">
    ${THEMES.map(t=>`<div class="theme-opt${state.theme===t.id?" active":""}" data-theme-id="${t.id}">
      <div style="display:flex;gap:4px">
        <div style="width:12px;height:12px;border-radius:50%;background:${t.c1}"></div>
        <div style="width:12px;height:12px;border-radius:50%;background:${t.c2}"></div>
      </div>
      <span style="font-size:13px;color:var(--tx)">${t.name}</span>
      ${state.theme===t.id?`<span style="font-size:10px;color:var(--l1);margin-left:auto">✓</span>`:""}
    </div>`).join("")}
  </div>`;
}

// ── NAV ───────────────────────────────────────────────────────
function renderNav() {
  return `<nav>
    <button class="logo-btn" data-go="home"><div class="logo-icon">🚀</div>
      <span class="sg" style="font-size:17px;font-weight:700;color:var(--tx)">DevHub</span>
    </button>
    <div style="display:flex;gap:8px;align-items:center">
      ${(()=>{ const myInv=state.invitations.filter(i=>i.toUid===state.currentUid&&i.status==="pending"); return state.loggedIn?`<div style="position:relative"><button class="bg" id="btn-invitations" style="font-size:15px;padding:8px 12px" title="Invitations">🔔</button>${myInv.length?`<div style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;background:#EF4444;border-radius:50%;font-size:9px;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">${myInv.length}</div>`:"" }</div>`:""; })()}
      <div style="position:relative">
        <button class="bg" id="btn-theme" style="font-size:15px;padding:8px 12px" title="Changer le thème">🎨</button>
        ${state.showThemePicker ? renderThemePicker() : ""}
      </div>
      ${state.loggedIn ? `
        ${isAdmin() ? `<button class="bg" style="font-size:12px" data-go="admin">⚙ Admin</button>` : ""}
        <span class="role-${state.role==="admin"?"admin":"dev"}" style="font-size:11px">${state.role==="admin"?"Admin":"Dev"}</span>
        <button class="bg" id="btn-logout" style="font-size:12px;color:#F87171;border-color:rgba(239,68,68,.25)">Déconnexion</button>
      ` : `<button class="bg" id="btn-login" style="font-size:12px">🔒 Connexion</button>`}
    </div>
  </nav>`;
}

// ── WHY SECTION ───────────────────────────────────────────────
function renderWhySection() {
  return `<section style="padding:0 20px 52px;max-width:1300px;margin:0 auto">
    <div class="why-card">
      <div style="position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:50%;background:var(--sfh);pointer-events:none"></div>
      <div style="max-width:640px;position:relative;z-index:1">
        <div class="inter" style="font-size:11px;color:var(--l1);font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-bottom:12px">Pourquoi DevHub ?</div>
        <h2 class="sg" style="font-size:clamp(22px,4vw,32px);font-weight:700;color:var(--tx);margin-bottom:14px;line-height:1.2">Un espace pour documenter ce qu'on crée</h2>
        <p class="inter" style="font-size:15px;color:var(--tx2);line-height:1.8;margin-bottom:20px">
          DevHub est né d'une idée simple : rassembler au même endroit tout ce qu'on crée en tant qu'étudiants en informatique à l'ISEN Toulon.
          Chaque projet a son histoire, ses défis, ses mises à jour — et mérite d'être partagé.
          Que tu sois curieux, futur recruteur ou étudiant à la recherche d'inspiration, tu es ici chez toi.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${!state.loggedIn ? `<button class="bp" id="btn-join" style="font-size:13px">✋ Rejoindre l'équipe</button>` : ""}
          <a href="https://github.com/PoissonRagout58" target="_blank" rel="noopener noreferrer" class="bg" style="font-size:13px">GitHub →</a>
        </div>
      </div>
    </div>
  </section>`;
}

// ── HOME ──────────────────────────────────────────────────────
function renderHome() {
  const stats = [
    { v:state.projects.length,                                              l:"Projets",       c:"var(--l1)" },
    { v:state.collabs.length,                                               l:"Membres",       c:"var(--l2)" },
    { v:state.projects.reduce((s,p)=>s+(p.updates?.length||0),0),          l:"Mises à jour",  c:"#34D399"   },
    { v:state.projects.filter(p=>p.hasServer).length,                       l:"En ligne",      c:"#FBB54A"   },
  ];
  const filtered = state.projects.filter(p => {
    if(state.filter!=="all" && p.type!==state.filter) return false;
    if(state.search && !p.title?.toLowerCase().includes(state.search.toLowerCase()) && !(p.tags||[]).join(" ").toLowerCase().includes(state.search.toLowerCase())) return false;
    return true;
  });
  return `
  <div>
    <div style="text-align:center;padding:80px 20px 52px;position:relative;overflow:hidden">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:800px;height:500px;background:radial-gradient(ellipse,rgba(124,58,237,.1) 0%,transparent 70%);pointer-events:none"></div>
      <div class="inter" style="font-size:11px;color:var(--l1);font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-bottom:14px">Portfolio Collaboratif · ISEN Toulon</div>
      <h1 class="sg grad" style="font-size:clamp(48px,10vw,90px);font-weight:700;line-height:1.04;margin-bottom:16px">DevHub</h1>
      <p class="inter" style="font-size:15px;color:var(--tx2);max-width:440px;margin:0 auto 36px;line-height:1.7">Tous nos projets, leurs mises à jour et leur code — au même endroit.</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        ${stats.map(s=>`<div style="background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:12px 22px">
          <div class="sg" style="font-size:26px;font-weight:700;color:${s.c}">${s.v}</div>
          <div class="inter" style="font-size:11px;color:var(--tx3)">${s.l}</div></div>`).join("")}
      </div>
    </div>

    ${renderWhySection()}

    <section style="padding:0 20px 56px;max-width:1300px;margin:0 auto">
      <div class="sg" style="font-size:20px;font-weight:700;margin-bottom:18px;color:var(--tx)">👥 L'équipe</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px">
        ${state.collabs.map(c => {
          const n = state.projects.filter(p=>p.collaborators?.includes(c.id)).length;
          return `<div class="card" style="padding:20px">
            <div style="display:flex;gap:14px;align-items:center;margin-bottom:10px">
              ${avatarHTML(c,52)}
              <div><div class="sg" style="font-weight:700;font-size:16px;color:var(--tx)">${esc(c.name)}</div>
              <div class="inter" style="font-size:12px;color:var(--l1)">${esc(c.role)}</div></div>
            </div>
            ${c.bio?`<div class="inter" style="font-size:13px;color:var(--tx2);line-height:1.5;margin-bottom:8px">${esc(c.bio)}</div>`:""}
            <div class="inter" style="font-size:12px;color:var(--tx3)">${n} projet${n!==1?"s":""}</div>
          </div>`;
        }).join("") || `<div class="inter" style="color:var(--tx3);font-size:13px">Aucun membre.${isDev()?" Ajoute-toi via Admin → Membres.":""}</div>`}
      </div>
    </section>

    <section style="padding:0 20px 100px;max-width:1300px;margin:0 auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px">
        <div class="sg" style="font-size:20px;font-weight:700;color:var(--tx)">🚀 Projets</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input class="inp" id="search-input" placeholder="🔍 Rechercher..." value="${esc(state.search)}" style="width:180px;padding:7px 12px;font-size:13px">
          <div style="display:flex;gap:5px">
            ${[["all","Tous"],["solo","Solo"],["collab","Collab"]].map(([v,l])=>`<button class="ft${state.filter===v?" on":""}" data-filter="${v}">${l}</button>`).join("")}
          </div>
          ${isDev() ? `<button class="bp" id="btn-add-project" style="font-size:12px">+ Créer</button>` : ""}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
        ${filtered.map(p=>projectCardHTML(p)).join("") || `<div class="inter" style="color:var(--tx3);font-size:13px;grid-column:1/-1;padding:20px 0">Aucun projet trouvé.</div>`}
      </div>
    </section>
  </div>`;
}

function projectCardHTML(p) {
  const team = state.collabs.filter(c=>p.collaborators?.includes(c.id));
  const isSolo = p.type==="solo";
  const st = STATUS_MAP[p.status||"wip"];
  return `<div class="card" style="padding:22px;cursor:pointer;position:relative" data-open-project="${p.id}">
    ${(isAdmin()||(isDev()&&p.createdByUid===state.currentUid)) ? `<button class="bd" data-del-project="${p.id}" style="position:absolute;top:14px;right:14px;font-size:11px;padding:3px 8px">✕</button>` : ""}
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;padding-right:${isDev()?36:0}px">
      <span class="tag ${isSolo?"b-solo":"b-collab"}" style="font-size:11px">${isSolo?"Solo":"Collab"}</span>
      <span class="tag ${st.cls}" style="font-size:11px">${st.label}</span>
      ${p.hasServer?`<span class="tag b-server" style="font-size:11px">🌐 Live</span>`:""}
      ${p.hasDownload?`<span class="tag b-dl" style="font-size:11px">📦 DL</span>`:""}
      ${p.hasEmbed?`<span class="tag b-html" style="font-size:11px">📄 Intégré</span>`:""}
    </div>
    <div class="sg" style="font-size:17px;font-weight:700;margin-bottom:8px;color:var(--tx)">${esc(p.title)}</div>
    <div class="inter" style="font-size:13px;color:var(--tx2);line-height:1.6;margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(p.description)}</div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px">${(p.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--bd);padding-top:12px">
      <div style="display:flex">${team.map((c,i)=>`<div style="margin-left:${i?-7:0}px" title="${esc(c.name)}">${avatarHTML(c,26)}</div>`).join("")}</div>
      ${p.updates?.[0]?`<div class="mono" style="font-size:11px;color:var(--tx3)">↑ ${fd(p.updates[0].date)}</div>`:""}
    </div>
  </div>`;
}

// ── PROJECT PAGE ──────────────────────────────────────────────
let projectTab = "desc";
let embedCurrentPage = null;

function buildEmbedSrcDoc(embed) {
  if(!embed) return "";
  if(embed.mode==="zip" && embed.pages) {
    const page = embedCurrentPage && embed.pages[embedCurrentPage] ? embedCurrentPage : embed.defaultPage;
    return embed.pages[page] || "";
  }
  if(!embed.html) return "";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${embed.css||""}</style></head><body>${embed.html}<script>${embed.js||""}<\/script></body></html>`;
}
window.addEventListener("message", e => {
  if(e.data?.devhubNav){ embedCurrentPage=e.data.devhubNav; if(state.view==="project"&&projectTab==="preview") render(); }
});

function renderProject() {
  const project = state.projects.find(p=>p.id===state.selId);
  if(!project) return `<div style="padding:40px;text-align:center" class="inter">Projet introuvable.</div>`;
  const team = state.collabs.filter(c=>project.collaborators?.includes(c.id));
  const pc = state.comments.filter(c=>c.projectId===project.id);
  const isSolo = project.type==="solo";
  const embedSrc = project.hasEmbed ? buildEmbedSrcDoc(project.embed) : "";
  const st = STATUS_MAP[project.status||"wip"];
  const tabs = [
    {id:"desc",    label:"📝 Description"},
    ...(project.hasEmbed&&embedSrc?[{id:"preview",label:"👁 Aperçu"}]:[]),
    {id:"history", label:`📋 Historique (${project.updates?.length||0})`},
    {id:"comments",label:`💬 Avis (${pc.length})`},
  ];
  if(!tabs.find(t=>t.id===projectTab)) projectTab="desc";
  return `<div class="fu" style="max-width:920px;margin:0 auto;padding:28px 20px 80px">
    <div style="display:flex;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:8px">
      <button class="bg" style="font-size:12px" data-go="home">← Retour</button>
      ${isDev()?`<div style="display:flex;gap:8px;flex-wrap:wrap">
        ${(isAdmin()||(()=>{const p=state.projects.find(x=>x.id===state.selId);return p?.createdByUid===state.currentUid;})())?`<button class="bg" style="font-size:12px" id="btn-edit-project">✏️ Modifier</button>`:""}
        <button class="bp" style="font-size:12px" id="btn-push">⚡ Push</button>
        ${(()=>{ const p=state.projects.find(x=>x.id===state.selId); const cc=currentCollab(); const alreadyIn=p?.collaborators?.includes(cc?.id); return (cc&&alreadyIn)?`<button class="bg" style="font-size:12px" id="btn-invite">👤 Inviter</button>`:""; })()}
      </div>`:""}
    </div>
    <div style="margin-bottom:28px">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        <span class="tag ${isSolo?"b-solo":"b-collab"}" style="font-size:12px">${isSolo?"👤 Solo":"👥 Collaboratif"}</span>
        <span class="tag ${st.cls}" style="font-size:12px">${st.label}</span>
        ${project.hasServer?`<span class="tag b-server" style="font-size:12px">🌐 Live</span>`:""}
        ${project.hasDownload?`<span class="tag b-dl" style="font-size:12px">📦 Téléchargeable</span>`:""}
        ${project.hasEmbed?`<span class="tag b-html" style="font-size:12px">📄 Intégré</span>`:""}
        ${(project.tags||[]).map(t=>`<span class="tag" style="font-size:12px">${esc(t)}</span>`).join("")}
      </div>
      <h1 class="sg" style="font-size:clamp(28px,5vw,46px);font-weight:700;margin-bottom:12px;color:var(--tx)">${esc(project.title)}</h1>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
        ${team.map(c=>`<div style="display:flex;align-items:center;gap:7px;background:var(--sf);border:1px solid var(--bd);border-radius:100px;padding:5px 12px 5px 6px">
          ${avatarHTML(c,24)}<span class="inter" style="font-size:12px;color:var(--tx2)">${esc(c.name)}</span></div>`).join("")}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${project.hasServer&&project.serverUrl?`<a href="${esc(project.serverUrl)}" target="_blank" rel="noopener noreferrer" class="bp" style="font-size:13px">🌐 Voir en ligne</a>`:""}
        ${project.hasDownload&&project.downloadUrl?`<a href="${esc(project.downloadUrl)}" target="_blank" rel="noopener noreferrer" class="bg" style="font-size:13px">⬇ Code source</a>`:""}
      </div>
    </div>
    <div style="border-bottom:1px solid var(--bd);margin-bottom:28px;overflow-x:auto;display:flex">
      ${tabs.map(t=>`<button class="ptab${projectTab===t.id?" on":""}" data-ptab="${t.id}">${t.label}</button>`).join("")}
    </div>
    <div id="ptab-content">${renderProjectTabContent(project,embedSrc,pc)}</div>
  </div>`;
}

function renderProjectTabContent(project, embedSrc, pc) {
  if(projectTab==="desc") return `<div class="inter" style="font-size:14px;color:var(--tx2);line-height:1.8;white-space:pre-wrap">${esc(project.description)}</div>`;
  if(projectTab==="preview") {
    const isMulti = project.embed?.mode==="zip" && project.embed?.pages && Object.keys(project.embed.pages).length>1;
    const curPage = embedCurrentPage && project.embed?.pages?.[embedCurrentPage] ? embedCurrentPage : project.embed?.defaultPage;
    return `<div>
      ${isMulti?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        ${Object.keys(project.embed.pages).map(p=>`<button class="stab${p===curPage?" on":""}" data-embed-page="${esc(p)}">${esc(p)}</button>`).join("")}
      </div>`:`<div class="inter" style="font-size:12px;color:var(--tx3);margin-bottom:12px">Rendu du projet intégré :</div>`}
      <div style="border:1px solid var(--bd);border-radius:16px;overflow:hidden">
        <iframe srcdoc="${esc(embedSrc)}" title="aperçu" style="width:100%;height:560px;border:none;display:block;background:#fff" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
      </div></div>`;
  }
  if(projectTab==="history") {
    const updates = project.updates||[];
    if(!updates.length) return `<div class="inter" style="color:var(--tx3);font-size:13px">Aucune mise à jour pour l'instant.</div>`;
    return updates.map((u,i)=>`<div style="display:flex;gap:12px">
      <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
        <div style="width:20px;height:20px;border-radius:50%;background:${i===0?"var(--btn)":"var(--sf)"};border:${i===0?"none":"1px solid var(--bda)"};box-shadow:${i===0?"0 0 10px var(--a1)":"none"};display:flex;align-items:center;justify-content:center;font-size:8px;color:#fff;flex-shrink:0">${i===0?"★":"·"}</div>
        ${i<updates.length-1?`<div style="width:1px;flex:1;background:var(--bd);margin-top:3px;min-height:24px"></div>`:""}
      </div>
      <div style="padding-bottom:18px;flex:1">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;flex-wrap:wrap;gap:4px">
          <div><span class="inter" style="font-size:13px;color:var(--l1);font-weight:600">${esc(u.author)}</span><span class="mono" style="font-size:11px;color:var(--tx3);margin-left:8px">${fd(u.date)}</span></div>
          ${isDev()?`<button class="bd" data-del-update="${i}" style="font-size:10px;padding:2px 7px">✕</button>`:""}
        </div>
        <div class="inter" style="color:var(--tx2);font-size:13px;line-height:1.6">${esc(u.description)}</div>
      </div></div>`).join("");
  }
  if(projectTab==="comments") {
    return `<div>
      <div style="background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:16px;margin-bottom:18px">
        <input class="inp" id="comment-name" placeholder="Votre nom" style="margin-bottom:8px;max-width:220px">
        <textarea class="ta" id="comment-text" placeholder="Partagez votre avis..." rows="3" style="margin-bottom:10px"></textarea>
        <button class="bp" id="btn-comment" style="font-size:13px">Publier</button>
      </div>
      ${pc.length===0?`<div class="inter" style="color:var(--tx3);font-size:13px">Aucun avis. Soyez le premier !</div>`:""}
      <div style="display:flex;flex-direction:column;gap:10px">
        ${pc.map(c=>`<div class="flat" style="padding:14px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span class="inter" style="font-weight:600;color:var(--l1);font-size:14px">${esc(c.author)}</span>
            <span class="mono" style="font-size:11px;color:var(--tx3)">${fd(c.createdAt)}</span>
          </div>
          <div class="inter" style="color:var(--tx2);font-size:13px;line-height:1.6">${esc(c.content)}</div>
        </div>`).join("")}
      </div></div>`;
  }
  return "";
}

// ── ADMIN ─────────────────────────────────────────────────────
let adminTab = "projects";
function renderAdmin() {
  const totalUp = state.projects.reduce((s,p)=>s+(p.updates?.length||0),0);
  const pending = state.requests.filter(r=>r.status==="pending").length;
  return `<div class="fu" style="max-width:1000px;margin:0 auto;padding:28px 20px 80px">
    <div style="margin-bottom:28px">
      <div class="sg" style="font-size:26px;font-weight:700;margin-bottom:4px;color:var(--tx)">⚙ Panneau Admin</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
        ${[{v:state.projects.length,l:"Projets",c:"var(--l1)"},{v:state.collabs.length,l:"Membres",c:"var(--l2)"},{v:totalUp,l:"Mises à jour",c:"#34D399"},{v:pending,l:"Demandes",c:"#FBB54A"}].map(s=>`
          <div style="background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:10px 20px">
            <div class="sg" style="font-size:20px;font-weight:700;color:${s.c}">${s.v}</div>
            <div class="inter" style="font-size:11px;color:var(--tx3)">${s.l}</div>
          </div>`).join("")}
      </div>
    </div>
    <div style="display:flex;border-bottom:1px solid var(--bd);margin-bottom:26px;overflow-x:auto">
      ${[["projects","🗂 Projets"],["collabs","👥 Membres"],["requests",`📩 Demandes${pending?` (${pending})`:""}` ],["roles","🛡 Rôles"]].map(([k,l])=>`<button class="ptab${adminTab===k?" on":""}" data-atab="${k}">${l}</button>`).join("")}
    </div>
    <div id="atab-content">${renderAdminTab()}</div>
  </div>`;
}

function renderAdminTab() {
  if(adminTab==="projects") {
    return `<button class="bp" id="btn-add-project-admin" style="margin-bottom:18px;font-size:13px">+ Nouveau projet</button>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${state.projects.map(p=>`<div class="flat" style="padding:14px 18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <div class="sg" style="font-weight:600;font-size:14px;color:var(--tx)">${esc(p.title)}</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">
              <span class="inter" style="font-size:11px;color:var(--tx3)">${esc(p.type)} · ${p.updates?.length||0} màj</span>
              ${p.hasServer?`<span class="tag b-server" style="font-size:10px">🌐</span>`:""}
              ${p.hasDownload?`<span class="tag b-dl" style="font-size:10px">📦</span>`:""}
              ${p.hasEmbed?`<span class="tag b-html" style="font-size:10px">📄</span>`:""}
            </div>
          </div>
          ${(isAdmin()||(isDev()&&p.createdByUid===state.currentUid))?`<button class="bd" data-del-project="${p.id}">Supprimer</button>`:`<span class="inter" style="font-size:11px;color:var(--tx3)">Pas le tien</span>`}
        </div>`).join("") || `<div class="inter" style="color:var(--tx3);font-size:13px">Aucun projet.</div>`}
      </div>`;
  }
  if(adminTab==="collabs") {
    return `<button class="bp" id="btn-add-collab" style="margin-bottom:18px;font-size:13px">+ Nouveau membre</button>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">
        ${state.collabs.map(c=>`<div class="flat" style="padding:16px;position:relative">
          <button class="bd" data-del-collab="${c.id}" style="position:absolute;top:12px;right:12px;font-size:10px;padding:2px 7px">✕</button>
          <div style="display:flex;gap:12px;align-items:center;margin-bottom:6px;padding-right:36px">
            ${avatarHTML(c,40)}
            <div><div class="sg" style="font-weight:600;font-size:14px;color:var(--tx)">${esc(c.name)}</div>
            <div class="inter" style="font-size:11px;color:var(--l1)">${esc(c.role)}</div></div>
          </div>
          ${c.bio?`<div class="inter" style="font-size:11px;color:var(--tx2);line-height:1.4">${esc(c.bio)}</div>`:""}
        </div>`).join("")}
      </div>`;
  }
  if(adminTab==="requests") {
    return `<div>
      <p class="inter" style="font-size:13px;color:var(--tx2);margin-bottom:18px">Demandes de personnes souhaitant devenir développeur sur DevHub.</p>
      ${state.requests.length===0?`<div class="inter" style="color:var(--tx3);font-size:13px">Aucune demande pour l'instant.</div>`:""}
      <div style="display:flex;flex-direction:column;gap:10px">
        ${state.requests.map(r=>`<div class="flat" style="padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:10px">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span class="sg" style="font-size:15px;font-weight:700;color:var(--tx)">${esc(r.name)}</span>
                <span class="req-${r.status}">${r.status==="pending"?"En attente":r.status==="approved"?"Approuvé":"Refusé"}</span>
              </div>
              <div class="mono" style="font-size:12px;color:var(--l1)">${esc(r.email)}</div>
              <div class="mono" style="font-size:11px;color:var(--tx3)">${fd(r.createdAt)}</div>
            </div>
            ${r.status==="pending"?`<div style="display:flex;gap:8px">
              <button class="bp" data-approve-req="${r.id}" style="font-size:12px;padding:6px 14px">✓ Approuver</button>
              <button class="bd" data-reject-req="${r.id}" style="font-size:12px">✕ Refuser</button>
            </div>`:""}
          </div>
          <div style="background:var(--sfh);border-radius:8px;padding:12px">
            <div class="inter" style="font-size:11px;color:var(--tx3);margin-bottom:4px;font-weight:600;letter-spacing:1px;text-transform:uppercase">Motivation</div>
            <div class="inter" style="font-size:13px;color:var(--tx2);line-height:1.6">${esc(r.motivation)}</div>
          </div>
          ${r.status==="approved"?`<div class="inter" style="font-size:12px;color:#34D399;margin-top:10px">✓ Approuvé — Crée maintenant son compte Firebase Auth avec l'email <b>${esc(r.email)}</b>, puis ajoute son rôle dans l'onglet Rôles.</div>`:""}
        </div>`).join("")}
      </div></div>`;
  }
  if(adminTab==="roles") {
    const roleEntries = Object.entries(state.allRoles);
    return `<div>
      <p class="inter" style="font-size:13px;color:var(--tx2);margin-bottom:6px">Attribue un rôle Admin ou Développeur à un utilisateur Firebase Auth.</p>
      <p class="inter" style="font-size:12px;color:var(--tx3);margin-bottom:18px">Tu trouveras l'UID dans Firebase Console → Authentication → Users.</p>
      <button class="bp" id="btn-add-role" style="margin-bottom:18px;font-size:13px">+ Ajouter un rôle</button>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${roleEntries.map(([uid,role])=>`<div class="flat" style="padding:14px 18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <div class="mono" style="font-size:12px;color:var(--l1)">${esc(uid)}</div>
            <span class="role-${role==="admin"?"admin":"dev"}" style="margin-top:4px;display:inline-block">${role==="admin"?"Administrateur":"Développeur"}</span>
          </div>
          <button class="bd" data-del-role="${uid}">Supprimer</button>
        </div>`).join("") || `<div class="inter" style="color:var(--tx3);font-size:13px">Aucun rôle défini. Ajoute le tien en premier.</div>`}
      </div></div>`;
  }
  return "";
}

// ── MODALS ────────────────────────────────────────────────────
const closeModal = () => { document.getElementById("modal-root").innerHTML=""; };

function openLoginModal() {
  const mr = document.getElementById("modal-root");
  mr.innerHTML=`<div class="overlay" id="overlay"><div class="modal pi" style="max-width:340px">
    <div style="text-align:center;margin-bottom:22px">
      <div style="font-size:30px;margin-bottom:8px">🔐</div>
      <div class="sg" style="font-size:20px;font-weight:700;color:var(--tx)">Espace Modérateurs</div>
      <div class="inter" style="font-size:13px;color:var(--tx3);margin-top:4px">Connexion via Firebase Auth</div>
    </div>
    <input class="inp" id="login-email" placeholder="Email" style="margin-bottom:8px">
    <input class="inp" id="login-pw" type="password" placeholder="Mot de passe" style="margin-bottom:8px">
    <div id="login-err" class="inter" style="color:#F87171;font-size:12px;margin-bottom:8px"></div>
    <button class="bp" id="login-submit" style="width:100%">Se connecter</button>
  </div></div>`;
  document.getElementById("overlay").onclick = e=>{ if(e.target.id==="overlay") closeModal(); };
  document.getElementById("login-submit").onclick = async()=>{
    const email=document.getElementById("login-email").value;
    const pw=document.getElementById("login-pw").value;
    const btn=document.getElementById("login-submit");
    btn.disabled=true; btn.textContent="Connexion...";
    try{ await loginModerator(email,pw); closeModal(); }
    catch{ document.getElementById("login-err").textContent="Email ou mot de passe incorrect."; btn.disabled=false; btn.textContent="Se connecter"; }
  };
}

function openNewsPopup() {
  if(!state.news.length) return;
  const item=state.news[0];
  const mr=document.getElementById("modal-root");
  mr.innerHTML=`<div class="overlay" id="overlay"><div class="modal pi" style="max-width:380px;background:var(--sfh);border:1px solid var(--bda)">
    <div style="display:flex;justify-content:space-between;margin-bottom:14px">
      <div style="display:flex;gap:10px;align-items:center">
        <span class="pulse" style="font-size:22px">🔔</span>
        <div><div class="inter" style="font-size:10px;color:var(--l1);font-weight:600;letter-spacing:2px;text-transform:uppercase">Nouvelle mise à jour</div>
        <div class="sg" style="font-size:17px;font-weight:700;color:var(--tx)">${esc(item.projectTitle)}</div></div>
      </div>
      <button id="popup-close" style="background:none;border:none;color:var(--tx3);cursor:pointer;font-size:18px">✕</button>
    </div>
    <p class="inter" style="color:var(--tx2);font-size:14px;line-height:1.6;margin:0 0 6px"><span style="color:var(--l1);font-weight:600">${esc(item.author)}</span> ${esc(item.description)}</p>
    <div class="mono" style="font-size:11px;color:var(--tx3);margin-bottom:18px">${fd(item.createdAt)}</div>
    <button class="bp" id="popup-view" style="width:100%;font-size:13px">Voir le projet →</button>
  </div></div>`;
  const closeFn=()=>closeModal();
  document.getElementById("overlay").onclick=e=>{ if(e.target.id==="overlay") closeFn(); };
  document.getElementById("popup-close").onclick=closeFn;
  document.getElementById("popup-view").onclick=()=>{ closeFn(); const p=state.projects.find(x=>x.id===item.projectId); if(p){state.selId=p.id;state.view="project";projectTab="desc";embedCurrentPage=null;render();} };
  setTimeout(()=>{ if(document.getElementById("overlay")) closeFn(); },9000);
}

function openPushModal(project) {
  const mr=document.getElementById("modal-root");
  mr.innerHTML=`<div class="overlay" id="overlay"><div class="modal pi" style="max-width:440px">
    <div class="sg" style="font-size:18px;font-weight:700;margin-bottom:4px;color:var(--tx)">⚡ Push une mise à jour</div>
    <div class="inter" style="font-size:12px;color:var(--tx3);margin-bottom:18px">Projet : <span style="color:var(--l1)">${esc(project.title)}</span></div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Auteur</div>
        <select class="sel" id="push-author">${state.collabs.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("")}</select></div>
      <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Description *</div>
        <textarea class="ta" id="push-desc" placeholder="Décrivez ce qui a été ajouté ou modifié..." rows="4"></textarea></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:18px">
      <button class="bp" id="push-submit" style="flex:1">Pousser ⚡</button>
      <button class="bg" id="push-cancel">Annuler</button>
    </div>
  </div></div>`;
  document.getElementById("overlay").onclick=e=>{ if(e.target.id==="overlay") closeModal(); };
  document.getElementById("push-cancel").onclick=closeModal;
  document.getElementById("push-submit").onclick=async()=>{
    const desc=document.getElementById("push-desc").value.trim();
    const author=document.getElementById("push-author").value;
    if(!desc) return;
    const btn=document.getElementById("push-submit"); btn.disabled=true; btn.textContent="Envoi...";
    const updates=[{date:now(),author,description:desc},...(project.updates||[])];
    try {
      await updateProject(project.id,{updates});
      await addNews({author,projectId:project.id,projectTitle:project.title,description:desc});
      closeModal();
    } catch(e){ alert("Erreur : "+e.message); btn.disabled=false; btn.textContent="Pousser ⚡"; }
  };
}

const COLORS=["#7C3AED","#06B6D4","#10B981","#F59E0B","#EF4444","#EC4899","#8B5CF6","#3B82F6","#F97316"];
function openAddCollabModal() {
  let chosenColor=COLORS[0];
  const mr=document.getElementById("modal-root");
  mr.innerHTML=`<div class="overlay" id="overlay"><div class="modal pi" style="max-width:380px">
    <div class="sg" style="font-size:18px;font-weight:700;margin-bottom:18px;color:var(--tx)">👤 Nouveau collaborateur</div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Nom *</div><input class="inp" id="cb-name" placeholder="Prénom"></div>
      <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Rôle</div><input class="inp" id="cb-role" placeholder="Dev Frontend, Designer..."></div>
      <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Bio</div><textarea class="ta" id="cb-bio" rows="2"></textarea></div>
      <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Firebase Auth UID <span style="font-weight:400;text-transform:none">(optionnel)</span></div>
        <input class="inp" id="cb-uid" placeholder="UID visible dans Firebase Console → Auth → Users">
        <div class="inter" style="font-size:11px;color:var(--tx3);margin-top:4px">Nécessaire pour lier le compte et utiliser le système d'invitations.</div>
      </div>
      <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Couleur</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap" id="cb-colors">
          ${COLORS.map((c,i)=>`<div data-color="${c}" style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;border:3px solid ${i===0?"white":"transparent"}"></div>`).join("")}
        </div></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:20px">
      <button class="bp" id="cb-submit" style="flex:1">Ajouter</button>
      <button class="bg" id="cb-cancel">Annuler</button>
    </div>
  </div></div>`;
  document.getElementById("overlay").onclick=e=>{ if(e.target.id==="overlay") closeModal(); };
  document.getElementById("cb-cancel").onclick=closeModal;
  document.querySelectorAll("#cb-colors div").forEach(el=>{
    el.onclick=()=>{ chosenColor=el.dataset.color; document.querySelectorAll("#cb-colors div").forEach(x=>x.style.border="3px solid transparent"); el.style.border="3px solid white"; };
  });
  document.getElementById("cb-submit").onclick=async()=>{
    const name=document.getElementById("cb-name").value.trim();
    if(!name) return;
    const uid_cb=document.getElementById("cb-uid").value.trim();
    await addCollab({name,role:document.getElementById("cb-role").value.trim(),bio:document.getElementById("cb-bio").value.trim(),color:chosenColor,initials:name.slice(0,2).toUpperCase(),...(uid_cb?{uid:uid_cb}:{})});
    closeModal();
  };
}

function openJoinModal() {
  const mr=document.getElementById("modal-root");
  mr.innerHTML=`<div class="overlay" id="overlay"><div class="modal pi" style="max-width:440px">
    <div style="text-align:center;margin-bottom:22px">
      <div style="font-size:30px;margin-bottom:8px">✋</div>
      <div class="sg" style="font-size:20px;font-weight:700;color:var(--tx)">Rejoindre l'équipe</div>
      <div class="inter" style="font-size:13px;color:var(--tx3);margin-top:4px">Demande à devenir développeur sur DevHub</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Ton prénom *</div><input class="inp" id="join-name" placeholder="Prénom"></div>
      <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Ton email *</div><input class="inp" id="join-email" placeholder="prenom@exemple.com" type="email"></div>
      <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Pourquoi tu veux rejoindre ? *</div>
        <textarea class="ta" id="join-motivation" placeholder="Présente-toi, explique tes projets, ce que tu veux apporter..." rows="4"></textarea></div>
    </div>
    <div id="join-err" class="inter" style="color:#F87171;font-size:12px;margin-top:8px"></div>
    <div id="join-ok" class="inter" style="color:#34D399;font-size:13px;margin-top:8px;display:none">✓ Demande envoyée ! Un admin te contactera par email.</div>
    <div style="display:flex;gap:8px;margin-top:18px">
      <button class="bp" id="join-submit" style="flex:1">Envoyer ma demande</button>
      <button class="bg" id="join-cancel">Annuler</button>
    </div>
  </div></div>`;
  document.getElementById("overlay").onclick=e=>{ if(e.target.id==="overlay") closeModal(); };
  document.getElementById("join-cancel").onclick=closeModal;
  document.getElementById("join-submit").onclick=async()=>{
    const name=document.getElementById("join-name").value.trim();
    const email=document.getElementById("join-email").value.trim();
    const motivation=document.getElementById("join-motivation").value.trim();
    const err=document.getElementById("join-err");
    if(!name||!email||!motivation){ err.textContent="Tous les champs sont requis."; return; }
    if(!/^[^@]+@[^@]+\.[^@]+$/.test(email)){ err.textContent="Email invalide."; return; }
    const btn=document.getElementById("join-submit"); btn.disabled=true; btn.textContent="Envoi...";
    try {
      await addRequest({name,email,motivation});
      document.getElementById("join-ok").style.display="block";
      btn.style.display="none"; document.getElementById("join-cancel").textContent="Fermer";
    } catch(e){ err.textContent="Erreur : "+e.message; btn.disabled=false; btn.textContent="Envoyer ma demande"; }
  };
}

function openAddRoleModal() {
  const mr=document.getElementById("modal-root");
  mr.innerHTML=`<div class="overlay" id="overlay"><div class="modal pi" style="max-width:400px">
    <div class="sg" style="font-size:18px;font-weight:700;margin-bottom:18px;color:var(--tx)">🛡 Ajouter un rôle</div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">UID Firebase Auth *</div>
        <input class="inp" id="role-uid" placeholder="ABC123xyz...">
        <div class="inter" style="font-size:11px;color:var(--tx3);margin-top:6px">Visible dans Firebase Console → Authentication → Users</div>
      </div>
      <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Rôle *</div>
        <select class="sel" id="role-select">
          <option value="developer">Développeur</option>
          <option value="admin">Administrateur</option>
        </select></div>
    </div>
    <div id="role-err" class="inter" style="color:#F87171;font-size:12px;margin-top:8px"></div>
    <div style="display:flex;gap:8px;margin-top:18px">
      <button class="bp" id="role-submit" style="flex:1">Définir le rôle</button>
      <button class="bg" id="role-cancel">Annuler</button>
    </div>
  </div></div>`;
  document.getElementById("overlay").onclick=e=>{ if(e.target.id==="overlay") closeModal(); };
  document.getElementById("role-cancel").onclick=closeModal;
  document.getElementById("role-submit").onclick=async()=>{
    const uid_val=document.getElementById("role-uid").value.trim();
    const role=document.getElementById("role-select").value;
    if(!uid_val){ document.getElementById("role-err").textContent="UID requis."; return; }
    const btn=document.getElementById("role-submit"); btn.disabled=true; btn.textContent="...";
    try { await setUserRole(uid_val,role); closeModal(); }
    catch(e){ document.getElementById("role-err").textContent="Erreur : "+e.message; btn.disabled=false; btn.textContent="Définir le rôle"; }
  };
}

// ── EMBED EDITOR ───────────────────────────────────────────────
function openProjectModal(initial) {
  const isEdit=!!initial;
  const f=initial?{...initial,tags:(initial.tags||[]).join(", "),collaborators:[...(initial.collaborators||[])]}:{
    title:"",description:"",type:"solo",collaborators:[],tags:"",status:"wip",
    hasServer:false,serverUrl:"",hasDownload:false,downloadUrl:"",
    hasEmbed:false,embed:{mode:"fields",html:"",css:"",js:"",zipName:""},
  };
  let embedStab="html";
  const mr=document.getElementById("modal-root");

  function paint() {
    const tagsStr=typeof f.tags==="string"?f.tags:f.tags.join(", ");
    mr.innerHTML=`<div class="overlay" id="overlay"><div class="modal pi" style="max-width:560px">
      <div class="sg" style="font-size:18px;font-weight:700;margin-bottom:20px;color:var(--tx)">${isEdit?"✏️ Modifier le projet":"➕ Nouveau projet"}</div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Titre *</div><input class="inp" id="pj-title" placeholder="Nom du projet" value="${esc(f.title)}"></div>
        <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Description *</div><textarea class="ta" id="pj-desc" rows="3" placeholder="Décrivez votre projet...">${esc(f.description)}</textarea></div>
        <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Tags (séparés par des virgules)</div><input class="inp" id="pj-tags" placeholder="React, C, Python..." value="${esc(tagsStr)}"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:130px"><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Type</div>
            <select class="sel" id="pj-type"><option value="solo" ${f.type==="solo"?"selected":""}>👤 Solo</option><option value="collab" ${f.type==="collab"?"selected":""}>👥 Collaboratif</option></select></div>
          <div style="flex:1;min-width:130px"><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Statut</div>
            <select class="sel" id="pj-status">
              <option value="wip" ${(f.status||"wip")==="wip"?"selected":""}>En cours 🔧</option>
              <option value="done" ${f.status==="done"?"selected":""}>Terminé ✅</option>
              <option value="pause" ${f.status==="pause"?"selected":""}>En pause ⏸</option>
              <option value="archive" ${f.status==="archive"?"selected":""}>Archivé 📦</option>
            </select></div>
        </div>
        <div><div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Collaborateurs</div>
          ${isAdmin()?`<div style="display:flex;flex-wrap:wrap;gap:10px" id="pj-collabs">
            ${state.collabs.map(c=>`<label style="display:flex;align-items:center;gap:6px"><input type="checkbox" data-collab-id="${c.id}" ${f.collaborators.includes(c.id)?"checked":""}><span class="inter" style="font-size:13px;color:var(--tx2)">${esc(c.name)}</span></label>`).join("") || `<span class="inter" style="font-size:12px;color:var(--tx3)">Ajoute d'abord un membre dans Admin → Membres.</span>`}
          </div>`:`<div style="display:flex;align-items:center;gap:10px;background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:10px 14px">
            ${(()=>{ const cc=currentCollab(); return cc?`${avatarHTML(cc,32)}<div><div class="inter" style="font-size:13px;color:var(--tx);font-weight:600">${esc(cc.name)}</div><div class="inter" style="font-size:11px;color:var(--tx3)">Toi — assigné automatiquement</div></div>`:`<div class="inter" style="font-size:12px;color:var(--tx3)">⚠️ Ton profil collaborateur n'est pas encore lié à ton compte. Demande à l'admin d'ajouter ton UID Firebase dans ton profil.</div>`; })()}
          </div>`}
        </div>
        <div style="height:1px;background:var(--bd);margin:4px 0"></div>
        <div class="inter" style="font-size:11px;color:var(--tx3);font-weight:600;letter-spacing:2px;text-transform:uppercase">Options d'accès</div>
        <div>
          <div class="tog-wrap" id="tog-server"><div class="tog${f.hasServer?" on":""}"><div class="tog-dot"></div></div>
            <div><div class="inter" style="font-size:14px;color:var(--tx)">🌐 Ce projet a un site en ligne</div><div class="inter" style="font-size:12px;color:var(--tx3)">Lien direct vers l'application déployée</div></div></div>
          ${f.hasServer?`<input class="inp" id="pj-serverurl" placeholder="https://..." value="${esc(f.serverUrl)}" style="margin-top:10px">`:""}
        </div>
        <div>
          <div class="tog-wrap" id="tog-embed"><div class="tog${f.hasEmbed?" on":""}"><div class="tog-dot"></div></div>
            <div><div class="inter" style="font-size:14px;color:var(--tx)">📄 Intégrer le projet (HTML/CSS/JS)</div><div class="inter" style="font-size:12px;color:var(--tx3)">Colle le code ou dépose un .zip — rendu en iframe sur la page</div></div></div>
          ${f.hasEmbed?`<div id="embed-editor" style="margin-top:10px"></div>`:""}
        </div>
        <div>
          <div class="tog-wrap" id="tog-download"><div class="tog${f.hasDownload?" on":""}"><div class="tog-dot"></div></div>
            <div><div class="inter" style="font-size:14px;color:var(--tx)">📦 Lien de téléchargement / code source</div><div class="inter" style="font-size:12px;color:var(--tx3)">Lien vers GitHub, Drive, releases...</div></div></div>
          ${f.hasDownload?`<input class="inp" id="pj-downloadurl" placeholder="https://github.com/..." value="${esc(f.downloadUrl)}" style="margin-top:10px">`:""}
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:22px">
        <button class="bp" id="pj-submit" style="flex:1">${isEdit?"Sauvegarder":"Créer le projet"}</button>
        <button class="bg" id="pj-cancel">Annuler</button>
      </div>
    </div></div>`;
    document.getElementById("overlay").onclick=e=>{ if(e.target.id==="overlay") closeModal(); };
    document.getElementById("pj-cancel").onclick=closeModal;
    document.getElementById("tog-server").onclick=()=>{ syncFields(); f.hasServer=!f.hasServer; paint(); };
    document.getElementById("tog-embed").onclick=()=>{ syncFields(); f.hasEmbed=!f.hasEmbed; paint(); };
    document.getElementById("tog-download").onclick=()=>{ syncFields(); f.hasDownload=!f.hasDownload; paint(); };
    if(f.hasEmbed) paintEmbedEditor();
    document.getElementById("pj-submit").onclick=submit;
  }

  function syncFields() {
    f.title=document.getElementById("pj-title")?.value??f.title;
    f.description=document.getElementById("pj-desc")?.value??f.description;
    f.tags=document.getElementById("pj-tags")?.value??f.tags;
    f.type=document.getElementById("pj-type")?.value??f.type;
    f.status=document.getElementById("pj-status")?.value??f.status;
    f.serverUrl=document.getElementById("pj-serverurl")?.value??f.serverUrl;
    f.downloadUrl=document.getElementById("pj-downloadurl")?.value??f.downloadUrl;
    if(!isAdmin()) { const cc=currentCollab(); if(cc&&!f.collaborators.includes(cc.id)) f.collaborators=[cc.id]; }
    document.querySelectorAll("#pj-collabs input[type=checkbox]").forEach(cb=>{
      const id=cb.dataset.collabId;
      if(cb.checked&&!f.collaborators.includes(id)) f.collaborators.push(id);
      if(!cb.checked) f.collaborators=f.collaborators.filter(x=>x!==id);
    });
  }

  function paintEmbedEditor() {
    const el=document.getElementById("embed-editor"); if(!el) return;
    el.innerHTML=`<div style="display:flex;gap:6px;margin-bottom:10px">
      <button type="button" class="stab${f.embed.mode==="fields"?" on":""}" id="embed-mode-fields">✏️ Coller le code</button>
      <button type="button" class="stab${f.embed.mode==="zip"?" on":""}" id="embed-mode-zip">📦 Déposer un .zip</button>
    </div><div id="embed-body"></div>`;
    document.getElementById("embed-mode-fields").onclick=()=>{ f.embed.mode="fields"; paintEmbedEditor(); };
    document.getElementById("embed-mode-zip").onclick=()=>{ f.embed.mode="zip"; paintEmbedEditor(); };
    const body=document.getElementById("embed-body");
    if(f.embed.mode==="zip") {
      body.innerHTML=`<div class="upzone" id="embed-zip-zone"><input type="file" id="embed-zip-input" accept=".zip" style="display:none">
        <div id="embed-zip-content">${f.embed.pages?`<div class="inter" style="color:#34D399;font-size:13px">✓ ${esc(f.embed.zipName||"")} — ${Object.keys(f.embed.pages).length} page(s), ${f.embed.totalSizeKB} Ko</div>`:
        `<div style="font-size:22px;margin-bottom:6px">📦</div><div class="inter" style="font-size:13px;color:var(--tx2)">Glisser le .zip (HTML/CSS/JS/images)</div><div class="inter" style="font-size:11px;color:var(--tx3);margin-top:2px">Multi-pages et dossier d'images gérés automatiquement</div>`}</div>
        ${f.embed.totalSizeKB>3000?`<div class="inter" style="font-size:11px;color:#FBB54A;margin-top:6px">⚠️ ${f.embed.totalSizeKB} Ko après compression${f.embed.totalSizeKB>8000?" — confirmation requise à l'envoi":""}</div>`:""}
      </div>`;
      const zone=document.getElementById("embed-zip-zone");
      const input=document.getElementById("embed-zip-input");
      const handleZip=async file=>{
        document.getElementById("embed-zip-content").innerHTML=`<div class="inter" style="color:var(--l1);font-size:13px"><span class="spin">⏳</span> Extraction...</div>`;
        try {
          const result=await extractZipToPages(file, msg=>{ const el=document.getElementById("embed-zip-content"); if(el) el.innerHTML=`<div class="inter" style="color:var(--l1);font-size:13px"><span class="spin">⏳</span> ${esc(msg)}</div>`; });
          f.embed={mode:"zip",pages:result.pages,defaultPage:result.defaultPage,totalSizeKB:result.totalSizeKB,zipName:file.name};
          paintEmbedEditor();
        } catch(e){ alert("Erreur lecture zip : "+e.message); paintEmbedEditor(); }
      };
      zone.onclick=()=>input.click();
      zone.ondragover=e=>{ e.preventDefault(); zone.classList.add("drag"); };
      zone.ondragleave=()=>zone.classList.remove("drag");
      zone.ondrop=e=>{ e.preventDefault(); zone.classList.remove("drag"); if(e.dataTransfer.files[0]) handleZip(e.dataTransfer.files[0]); };
      input.onchange=e=>{ if(e.target.files[0]) handleZip(e.target.files[0]); };
    } else {
      body.innerHTML=`<div style="display:flex;gap:6px;margin-bottom:8px">
        <button type="button" class="stab${embedStab==="html"?" on":""}" id="estab-html">HTML</button>
        <button type="button" class="stab${embedStab==="css"?" on":""}" id="estab-css">CSS</button>
        <button type="button" class="stab${embedStab==="js"?" on":""}" id="estab-js">JS</button>
      </div>
      <textarea class="ta code-ta" id="embed-code" rows="8" placeholder="${embedStab==="html"?"<div>...</div>":embedStab==="css"?"body { ... }":"console.log(...)"}">${esc(f.embed[embedStab]||"")}</textarea>
      <div class="inter" style="font-size:11px;color:var(--tx3);margin-top:6px">Les 3 sont combinés automatiquement dans l'aperçu.</div>`;
      document.getElementById("embed-code").oninput=e=>{ f.embed[embedStab]=e.target.value; f.embed.mode="fields"; };
      document.getElementById("estab-html").onclick=()=>{ f.embed.html=document.getElementById("embed-code").value; embedStab="html"; paintEmbedEditor(); };
      document.getElementById("estab-css").onclick=()=>{ if(embedStab!=="css") f.embed[embedStab]=document.getElementById("embed-code").value; embedStab="css"; paintEmbedEditor(); };
      document.getElementById("estab-js").onclick=()=>{ if(embedStab!=="js") f.embed[embedStab]=document.getElementById("embed-code").value; embedStab="js"; paintEmbedEditor(); };
    }
  }

  async function submit() {
    syncFields();
    if(!f.title.trim()||!f.description.trim()) return;
    if(f.hasEmbed&&f.embed.mode==="zip"&&f.embed.totalSizeKB>8000) {
      const ok=confirm(`Ce projet intégré fait ${(f.embed.totalSizeKB/1024).toFixed(1)} Mo après compression — c'est lourd.\nEnvoyer quand même ?`);
      if(!ok) return;
    }
    const btn=document.getElementById("pj-submit");
    btn.disabled=true; btn.textContent="Envoi en cours...";
    const tags=typeof f.tags==="string"?f.tags.split(",").map(t=>t.trim()).filter(Boolean):f.tags;
    const collaborators=f.collaborators.length?f.collaborators:[state.collabs[0]?.id].filter(Boolean);
    const payload={
      title:f.title.trim(),description:f.description.trim(),type:f.type,status:f.status||"wip",tags,collaborators,
      hasServer:f.hasServer,serverUrl:f.serverUrl||"",
      hasEmbed:f.hasEmbed,embed:f.embed,
      hasDownload:f.hasDownload,downloadUrl:f.downloadUrl||"",
      updates:f.updates||[],
      createdByUid: isEdit ? (f.createdByUid||state.currentUid) : state.currentUid,
    };
    try {
      if(isEdit) await updateProject(f.id,payload);
      else await addProject(payload);
      closeModal();
    } catch(e){ alert("Erreur : "+e.message); btn.disabled=false; btn.textContent=isEdit?"Sauvegarder":"Créer le projet"; }
  }

  paint();
}

// ── HANDLERS ──────────────────────────────────────────────────
function attachHandlers() {
  root.querySelectorAll("[data-go]").forEach(el=>el.onclick=()=>{ state.view=el.dataset.go; render(); });
  document.getElementById("btn-login")?.addEventListener("click",openLoginModal);
  document.getElementById("btn-logout")?.addEventListener("click",()=>{ logoutModerator(); state.view="home"; render(); });
  document.getElementById("btn-theme")?.addEventListener("click",e=>{ e.stopPropagation(); state.showThemePicker=!state.showThemePicker; render(); });
  root.querySelectorAll("[data-theme-id]").forEach(el=>el.onclick=e=>{ e.stopPropagation(); applyTheme(el.dataset.themeId); });
  if(state.showThemePicker) document.addEventListener("click",()=>{ state.showThemePicker=false; render(); },{once:true});

  root.querySelectorAll("[data-open-project]").forEach(el=>el.onclick=()=>{ state.selId=el.dataset.openProject; state.view="project"; projectTab="desc"; embedCurrentPage=null; render(); });
  root.querySelectorAll("[data-del-project]").forEach(el=>el.onclick=async e=>{ e.stopPropagation(); const p=state.projects.find(x=>x.id===el.dataset.delProject); if(!p) return; if(!isAdmin()&&p.createdByUid!==state.currentUid){ alert("Tu ne peux supprimer que tes propres projets."); return; } if(!confirm(`Supprimer "${p.title}" ?`)) return; await deleteProjectDoc(p.id); if(state.selId===p.id){state.view="home";render();} });
  root.querySelectorAll("[data-filter]").forEach(el=>el.onclick=()=>{ state.filter=el.dataset.filter; render(); });

  const si=document.getElementById("search-input");
  if(si) si.oninput=e=>{ state.search=e.target.value; render(); document.getElementById("search-input")?.focus(); };

  document.getElementById("btn-add-project")?.addEventListener("click",()=>openProjectModal(null));
  document.getElementById("btn-add-project-admin")?.addEventListener("click",()=>openProjectModal(null));
  document.getElementById("btn-add-collab")?.addEventListener("click",openAddCollabModal);
  document.getElementById("btn-join")?.addEventListener("click",openJoinModal);
  document.getElementById("btn-add-role")?.addEventListener("click",openAddRoleModal);

  root.querySelectorAll("[data-del-collab]").forEach(el=>el.onclick=async()=>{ if(confirm("Supprimer ce membre ?")) await deleteCollabDoc(el.dataset.delCollab); });
  root.querySelectorAll("[data-atab]").forEach(el=>el.onclick=()=>{ adminTab=el.dataset.atab; render(); });
  root.querySelectorAll("[data-ptab]").forEach(el=>el.onclick=()=>{ projectTab=el.dataset.ptab; render(); });
  root.querySelectorAll("[data-embed-page]").forEach(el=>el.onclick=()=>{ embedCurrentPage=el.dataset.embedPage; render(); });

  document.getElementById("btn-edit-project")?.addEventListener("click",()=>{ const p=state.projects.find(x=>x.id===state.selId); if(p) openProjectModal({...p,id:state.selId}); });
  document.getElementById("btn-push")?.addEventListener("click",()=>{ const p=state.projects.find(x=>x.id===state.selId); if(p) openPushModal(p); });

  root.querySelectorAll("[data-del-update]").forEach(el=>el.onclick=async()=>{
    const p=state.projects.find(x=>x.id===state.selId);
    const updates=(p.updates||[]).filter((_,i)=>i!==parseInt(el.dataset.delUpdate,10));
    await updateProject(p.id,{updates});
  });

  document.getElementById("btn-invitations")?.addEventListener("click", openInvitationsModal);
  document.getElementById("btn-invite")?.addEventListener("click",()=>{ const p=state.projects.find(x=>x.id===state.selId); if(p) openInviteModal(p); });
  document.getElementById("btn-comment")?.addEventListener("click",async()=>{
    const name=document.getElementById("comment-name").value.trim();
    const text=document.getElementById("comment-text").value.trim();
    if(!name||!text) return;
    await addComment({projectId:state.selId,author:name,content:text});
  });

  root.querySelectorAll("[data-approve-req]").forEach(el=>el.onclick=async()=>{ await updateRequest(el.dataset.approveReq,{status:"approved"}); });
  root.querySelectorAll("[data-reject-req]").forEach(el=>el.onclick=async()=>{ if(confirm("Refuser cette demande ?")) await updateRequest(el.dataset.rejectReq,{status:"rejected"}); });
  root.querySelectorAll("[data-del-role]").forEach(el=>el.onclick=async()=>{ if(confirm("Supprimer ce rôle ?")) await deleteUserRole(el.dataset.delRole); });

  // Cookie + Legal
  document.getElementById("cookie-accept")?.addEventListener("click",()=>{ localStorage.setItem("dh-cookies","accepted"); document.getElementById("cookie-banner")?.remove(); });
  document.getElementById("cookie-refuse")?.addEventListener("click",()=>{ localStorage.setItem("dh-cookies","refused"); document.getElementById("cookie-banner")?.remove(); });
  document.querySelectorAll("#open-privacy").forEach(el=>el.onclick=()=>openLegalModal("privacy"));
  document.getElementById("open-cgu")?.addEventListener("click",()=>openLegalModal("cgu"));
  document.getElementById("open-legal")?.addEventListener("click",()=>openLegalModal("legal"));
}


// ── INVITATIONS ───────────────────────────────────────────────
function openInviteModal(project) {
  const existing = project.collaborators || [];
  const available = state.collabs.filter(c => !existing.includes(c.id) && c.uid && c.uid !== state.currentUid);
  const mr = document.getElementById("modal-root");
  mr.innerHTML = `<div class="overlay" id="overlay"><div class="modal pi" style="max-width:440px">
    <div class="sg" style="font-size:18px;font-weight:700;margin-bottom:6px;color:var(--tx)">👤 Inviter un développeur</div>
    <div class="inter" style="font-size:12px;color:var(--tx3);margin-bottom:20px">Projet : <span style="color:var(--l1)">${esc(project.title)}</span></div>
    ${available.length===0?`<div class="inter" style="color:var(--tx3);font-size:13px;margin-bottom:16px">
      Aucun développeur disponible à inviter. Les développeurs doivent d'abord avoir leur UID Firebase lié dans Admin → Membres.
    </div>`:`<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px">
      ${available.map(c=>`<label style="display:flex;align-items:center;gap:10px;background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:12px 14px;cursor:pointer">
        <input type="radio" name="invite-collab" value="${c.id}" data-uid="${c.uid}" style="accent-color:var(--a1)">
        ${avatarHTML(c,36)}
        <div><div class="inter" style="font-size:14px;font-weight:600;color:var(--tx)">${esc(c.name)}</div>
        <div class="inter" style="font-size:11px;color:var(--tx3)">${esc(c.role)}</div></div>
      </label>`).join("")}
    </div>`}
    <div id="invite-err" class="inter" style="color:#F87171;font-size:12px;margin-bottom:8px"></div>
    <div id="invite-ok" class="inter" style="color:#34D399;font-size:13px;margin-bottom:8px;display:none">✓ Invitation envoyée !</div>
    <div style="display:flex;gap:8px">
      ${available.length?`<button class="bp" id="invite-submit" style="flex:1">Envoyer l'invitation</button>`:""}
      <button class="bg" id="invite-cancel" style="flex:1">Fermer</button>
    </div>
  </div></div>`;
  document.getElementById("overlay").onclick = e=>{ if(e.target.id==="overlay") closeModal(); };
  document.getElementById("invite-cancel").onclick = closeModal;
  document.getElementById("invite-submit")?.addEventListener("click", async()=>{
    const sel = document.querySelector("input[name='invite-collab']:checked");
    if(!sel){ document.getElementById("invite-err").textContent="Sélectionne un développeur."; return; }
    const btn=document.getElementById("invite-submit"); btn.disabled=true; btn.textContent="Envoi...";
    const cc=currentCollab();
    try {
      await addInvitation({
        projectId: project.id, projectTitle: project.title,
        fromUid: state.currentUid, fromName: cc?.name || "Inconnu",
        toUid: sel.dataset.uid, toCollabId: sel.value,
      });
      document.getElementById("invite-ok").style.display="block";
      document.getElementById("invite-err").textContent="";
      btn.style.display="none";
    } catch(e){ document.getElementById("invite-err").textContent="Erreur : "+e.message; btn.disabled=false; btn.textContent="Envoyer l'invitation"; }
  });
}

function openInvitationsModal() {
  const myInvites = state.invitations.filter(inv => inv.toUid === state.currentUid);
  const mr = document.getElementById("modal-root");
  mr.innerHTML = `<div class="overlay" id="overlay"><div class="modal pi" style="max-width:500px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div class="sg" style="font-size:18px;font-weight:700;color:var(--tx)">🔔 Mes invitations</div>
      <button id="inv-close" style="background:none;border:none;color:var(--tx3);cursor:pointer;font-size:18px">✕</button>
    </div>
    ${myInvites.length===0?`<div class="inter" style="color:var(--tx3);font-size:13px">Aucune invitation pour l'instant.</div>`:""}
    <div style="display:flex;flex-direction:column;gap:10px">
      ${myInvites.map(inv=>{
        const fromCollab = state.collabs.find(c=>c.uid===inv.fromUid);
        return `<div class="flat" style="padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
            <div>
              <div class="sg" style="font-size:15px;font-weight:700;color:var(--tx);margin-bottom:2px">${esc(inv.projectTitle)}</div>
              <div class="inter" style="font-size:12px;color:var(--tx2)">Invité par <span style="color:var(--l1);font-weight:600">${esc(fromCollab?.name||inv.fromName)}</span></div>
              <div class="mono" style="font-size:11px;color:var(--tx3)">${fd(inv.createdAt)}</div>
            </div>
            ${inv.status==="pending"?`<div style="display:flex;gap:6px">
              <button class="bp" data-accept-inv="${inv.id}" data-project-id="${inv.projectId}" data-collab-id="${inv.toCollabId}" style="font-size:12px;padding:6px 14px">✓ Accepter</button>
              <button class="bd" data-refuse-inv="${inv.id}" style="font-size:12px">✕</button>
            </div>`:inv.status==="accepted"?`<span class="req-approved">Acceptée</span>`:`<span class="req-rejected">Refusée</span>`}
          </div>
        </div>`;
      }).join("")}
    </div>
  </div></div>`;
  document.getElementById("overlay").onclick = e=>{ if(e.target.id==="overlay") closeModal(); };
  document.getElementById("inv-close").onclick = closeModal;
  document.querySelectorAll("[data-accept-inv]").forEach(el=>el.onclick=async()=>{
    const project = state.projects.find(p=>p.id===el.dataset.projectId);
    if(project){
      const newCollabs=[...(project.collaborators||[])];
      if(!newCollabs.includes(el.dataset.collabId)) newCollabs.push(el.dataset.collabId);
      await updateProject(project.id,{collaborators:newCollabs});
    }
    await updateInvitation(el.dataset.acceptInv,{status:"accepted"});
    closeModal(); openInvitationsModal();
  });
  document.querySelectorAll("[data-refuse-inv]").forEach(el=>el.onclick=async()=>{
    await updateInvitation(el.dataset.refuseInv,{status:"refused"});
    closeModal(); openInvitationsModal();
  });
}


// ── COOKIE BANNER & LEGAL ─────────────────────────────────────
function renderCookieBanner() {
  if(localStorage.getItem("dh-cookies")) return "";
  return `<div id="cookie-banner" style="position:fixed;bottom:0;left:0;right:0;z-index:500;background:var(--bg);border-top:1px solid var(--bd);padding:16px 20px;backdrop-filter:blur(12px)">
    <div style="max-width:900px;margin:0 auto;display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div style="flex:1;min-width:260px">
        <div class="inter" style="font-size:13px;color:var(--tx);font-weight:600;margin-bottom:4px">🍪 Ce site utilise des cookies</div>
        <div class="inter" style="font-size:12px;color:var(--tx2);line-height:1.6">
          DevHub utilise Firebase (Google) pour l'authentification et la base de données. Des cookies techniques nécessaires au fonctionnement sont déposés.
          Aucun cookie publicitaire ou de traçage n'est utilisé.
          <button id="open-privacy" style="background:none;border:none;color:var(--l1);cursor:pointer;font-size:12px;text-decoration:underline;padding:0">En savoir plus →</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
        <button class="bd" id="cookie-refuse" style="font-size:12px;padding:8px 16px">Refuser le non-essentiel</button>
        <button class="bp" id="cookie-accept" style="font-size:12px;padding:8px 16px">Accepter</button>
      </div>
    </div>
  </div>`;
}

function renderFooter() {
  return `<footer style="border-top:1px solid var(--bd);padding:28px 20px;margin-top:40px">
    <div style="max-width:1300px;margin:0 auto">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:26px;height:26px;background:var(--btn);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:13px">🚀</div>
          <span class="sg" style="font-size:15px;font-weight:700;color:var(--tx)">DevHub</span>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <button id="open-cgu" style="background:none;border:none;color:var(--tx3);cursor:pointer;font-size:12px;font-family:var(--fb)">Conditions d'utilisation</button>
          <button id="open-privacy" style="background:none;border:none;color:var(--tx3);cursor:pointer;font-size:12px;font-family:var(--fb)">Politique de confidentialité</button>
          <button id="open-legal" style="background:none;border:none;color:var(--tx3);cursor:pointer;font-size:12px;font-family:var(--fb)">Mentions légales</button>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;border-top:1px solid var(--bd);padding-top:16px">
        <div class="inter" style="font-size:11px;color:var(--tx3)">
          Projet étudiant — ISEN Toulon · Développé avec l'aide de l'IA · ${new Date().getFullYear()}
        </div>
        <div class="inter" style="font-size:11px;color:var(--tx3)">
          Données hébergées par <a href="https://firebase.google.com" target="_blank" rel="noopener" style="color:var(--l1);text-decoration:none">Firebase (Google)</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noopener" style="color:var(--l1);text-decoration:none">Politique Google</a>
        </div>
      </div>
    </div>
  </footer>`;
}

function openLegalModal(type) {
  const content = {
    cgu: {
      title: "Conditions d'utilisation",
      body: `<div class="inter" style="font-size:13px;color:var(--tx2);line-height:1.9;display:flex;flex-direction:column;gap:18px">
        <div style="background:var(--sfh);border-radius:10px;padding:14px">
          <div class="inter" style="font-size:11px;color:var(--l1);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">Projet étudiant</div>
          <p>DevHub est un projet réalisé dans le cadre d'une formation en informatique à l'ISEN Toulon (Institut Supérieur de l'Électronique et du Numérique). Il est développé et maintenu par des étudiants à titre personnel et pédagogique.</p>
        </div>
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">1. Accès et utilisation</div>
          <p>L'accès à DevHub est libre et gratuit pour tous les visiteurs. La consultation des projets, des mises à jour et des profils ne nécessite aucune inscription. La création de contenu (projets, mises à jour) est réservée aux membres de l'équipe ayant un accès modérateur.</p>
        </div>
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">2. Contenu et propriété intellectuelle</div>
          <p>Les projets présentés sur DevHub sont la propriété de leurs auteurs respectifs. Le code source, les textes, les images et les démonstrations restent la propriété de leurs créateurs. Toute reproduction sans autorisation explicite est interdite.</p>
        </div>
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">3. Utilisation de l'intelligence artificielle</div>
          <div style="background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.2);border-radius:8px;padding:12px;margin-bottom:8px">
            <div class="inter" style="font-size:12px;color:var(--l1);font-weight:600;margin-bottom:4px">🤖 Transparence IA</div>
            <p>Le développement de DevHub a été réalisé avec l'assistance de modèles d'intelligence artificielle (Claude d'Anthropic). Certains projets présentés sur cette plateforme ont également été conçus avec l'aide d'outils IA. Cette utilisation est mentionnée dans les descriptions lorsque c'est pertinent.</p>
          </div>
        </div>
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">4. Commentaires et avis</div>
          <p>Les visiteurs peuvent laisser des avis sur les projets. Ces commentaires sont publics et accessibles à tous. Les auteurs se réservent le droit de supprimer tout commentaire inapproprié, diffamatoire ou hors sujet. En publiant un commentaire, vous acceptez qu'il soit stocké sur nos serveurs Firebase.</p>
        </div>
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">5. Disponibilité</div>
          <p>DevHub étant un projet étudiant, nous ne garantissons pas une disponibilité continue du service. Des interruptions ponctuelles peuvent survenir sans préavis.</p>
        </div>
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">6. Modification des CGU</div>
          <p>Ces conditions peuvent être modifiées à tout moment. Les utilisateurs seront informés des changements majeurs via le bandeau d'actualités du site.</p>
        </div>
      </div>`
    },
    privacy: {
      title: "Politique de confidentialité",
      body: `<div class="inter" style="font-size:13px;color:var(--tx2);line-height:1.9;display:flex;flex-direction:column;gap:18px">
        <div style="background:var(--sfh);border-radius:10px;padding:14px">
          <div class="inter" style="font-size:11px;color:var(--l1);font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">Conformité RGPD</div>
          <p>DevHub respecte le Règlement Général sur la Protection des Données (RGPD - UE 2016/679). En tant que projet étudiant, nous nous engageons à traiter vos données avec transparence et responsabilité.</p>
        </div>
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">1. Données collectées</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div style="background:var(--sf);border-radius:8px;padding:10px 14px;border:1px solid var(--bd)">
              <div class="inter" style="font-size:12px;color:var(--l1);font-weight:600;margin-bottom:2px">Commentaires publics</div>
              <p>Nom (ou pseudo) et contenu du commentaire. Ces données sont publiques et visibles par tous les visiteurs.</p>
            </div>
            <div style="background:var(--sf);border-radius:8px;padding:10px 14px;border:1px solid var(--bd)">
              <div class="inter" style="font-size:12px;color:var(--l1);font-weight:600;margin-bottom:2px">Demandes de rejoindre l'équipe</div>
              <p>Nom, adresse email et message de motivation. Ces données ne sont visibles que par les administrateurs et ne sont pas partagées avec des tiers.</p>
            </div>
            <div style="background:var(--sf);border-radius:8px;padding:10px 14px;border:1px solid var(--bd)">
              <div class="inter" style="font-size:12px;color:var(--l1);font-weight:600;margin-bottom:2px">Comptes modérateurs</div>
              <p>Adresse email et mot de passe (chiffré par Firebase) pour les membres de l'équipe. Aucun mot de passe n'est stocké en clair.</p>
            </div>
            <div style="background:var(--sf);border-radius:8px;padding:10px 14px;border:1px solid var(--bd)">
              <div class="inter" style="font-size:12px;color:var(--l1);font-weight:600;margin-bottom:2px">Préférences locales</div>
              <p>Votre thème visuel choisi est sauvegardé dans le localStorage de votre navigateur. Cette donnée ne quitte jamais votre appareil.</p>
            </div>
          </div>
        </div>
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">2. Cookies utilisés</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--sf);border-radius:6px;border:1px solid var(--bd)">
              <div><div class="mono" style="font-size:11px;color:var(--l1)">Firebase Auth</div><div style="font-size:11px;color:var(--tx3)">Session d'authentification des modérateurs</div></div>
              <span style="font-size:10px;background:rgba(16,185,129,.15);color:#34D399;padding:2px 8px;border-radius:20px;white-space:nowrap">Nécessaire</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--sf);border-radius:6px;border:1px solid var(--bd)">
              <div><div class="mono" style="font-size:11px;color:var(--l1)">dh-cookies</div><div style="font-size:11px;color:var(--tx3)">Mémorisation du consentement aux cookies</div></div>
              <span style="font-size:10px;background:rgba(16,185,129,.15);color:#34D399;padding:2px 8px;border-radius:20px;white-space:nowrap">Nécessaire</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--sf);border-radius:6px;border:1px solid var(--bd)">
              <div><div class="mono" style="font-size:11px;color:var(--l1)">dh-theme</div><div style="font-size:11px;color:var(--tx3)">Préférence de thème visuel (localStorage)</div></div>
              <span style="font-size:10px;background:rgba(16,185,129,.15);color:#34D399;padding:2px 8px;border-radius:20px;white-space:nowrap">Fonctionnel</span>
            </div>
          </div>
          <p style="margin-top:10px;font-size:12px;color:var(--tx3)">Aucun cookie publicitaire ou de traçage tiers n'est utilisé sur ce site.</p>
        </div>
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">3. Hébergement des données</div>
          <p>Les données sont hébergées sur <strong style="color:var(--tx)">Firebase Realtime Database</strong> (Google LLC), serveurs localisés en Europe de l'Ouest (europe-west1). Google est soumis aux clauses contractuelles types approuvées par la Commission européenne.</p>
        </div>
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">4. Vos droits (RGPD)</div>
          <p>Conformément au RGPD, vous disposez des droits suivants : <strong style="color:var(--tx)">accès, rectification, suppression, portabilité et opposition</strong> au traitement de vos données. Pour exercer ces droits, contactez-nous via le formulaire "Rejoindre l'équipe" en mentionnant votre demande, ou directement sur notre GitHub.</p>
        </div>
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">5. Durée de conservation</div>
          <p>Les commentaires sont conservés indéfiniment sauf demande de suppression. Les demandes de rejoindre l'équipe sont conservées 6 mois. Les comptes modérateurs sont supprimés à la fin du projet.</p>
        </div>
      </div>`
    },
    legal: {
      title: "Mentions légales",
      body: `<div class="inter" style="font-size:13px;color:var(--tx2);line-height:1.9;display:flex;flex-direction:column;gap:18px">
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">Éditeur du site</div>
          <p>DevHub est un projet étudiant réalisé à l'<strong style="color:var(--tx)">ISEN Toulon</strong> (Institut Supérieur de l'Électronique et du Numérique).<br>
          Ce site est publié à titre personnel et pédagogique par des étudiants en 1ère année d'informatique.</p>
        </div>
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">Hébergement</div>
          <div style="background:var(--sf);border-radius:8px;padding:14px;border:1px solid var(--bd)">
            <div class="inter" style="font-size:12px;color:var(--l1);font-weight:600;margin-bottom:6px">GitHub Pages</div>
            <p>GitHub, Inc. — 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis<br>
            <a href="https://pages.github.com" target="_blank" rel="noopener" style="color:var(--l1)">pages.github.com</a></p>
            <div class="inter" style="font-size:12px;color:var(--l1);font-weight:600;margin-top:10px;margin-bottom:6px">Firebase (Google)</div>
            <p>Google LLC — 1600 Amphitheatre Parkway, Mountain View, CA 94043, États-Unis<br>
            Données hébergées en Europe (europe-west1)<br>
            <a href="https://firebase.google.com" target="_blank" rel="noopener" style="color:var(--l1)">firebase.google.com</a></p>
          </div>
        </div>
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">Utilisation de l'intelligence artificielle</div>
          <div style="background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.2);border-radius:8px;padding:12px">
            <p>Ce site a été développé avec l'assistance de <strong style="color:var(--l1)">Claude (Anthropic)</strong>, un assistant IA. Certaines portions du code, des textes et de la structure ont été générées ou améliorées grâce à cet outil. Cette mention est faite dans un souci de transparence conformément aux bonnes pratiques de l'IA responsable.</p>
          </div>
        </div>
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">Responsabilité</div>
          <p>Ce site est un projet étudiant à vocation pédagogique. Les auteurs ne peuvent être tenus responsables des inexactitudes ou omissions dans le contenu. Les projets présentés sont des travaux d'apprentissage et n'engagent pas l'établissement ISEN Toulon.</p>
        </div>
        <div>
          <div class="sg" style="font-size:15px;font-weight:600;color:var(--tx);margin-bottom:8px">Contact</div>
          <p>Pour toute question ou demande relative à ce site, vous pouvez nous contacter via notre page GitHub : <a href="https://github.com/PoissonRagout58" target="_blank" rel="noopener" style="color:var(--l1)">github.com/PoissonRagout58</a></p>
        </div>
      </div>`
    }
  };
  const c = content[type];
  if(!c) return;
  const mr = document.getElementById("modal-root");
  mr.innerHTML = `<div class="overlay" id="overlay"><div class="modal pi" style="max-width:600px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px">
      <div class="sg" style="font-size:20px;font-weight:700;color:var(--tx)">${c.title}</div>
      <button id="legal-close" style="background:none;border:none;color:var(--tx3);cursor:pointer;font-size:20px;line-height:1">✕</button>
    </div>
    ${c.body}
  </div></div>`;
  document.getElementById("overlay").onclick = e => { if(e.target.id==="overlay") closeModal(); };
  document.getElementById("legal-close").onclick = closeModal;
}

render();
