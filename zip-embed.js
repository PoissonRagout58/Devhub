// zip-embed.js — extrait un .zip multi-fichiers (plusieurs pages HTML, CSS, JS, dossier d'images)
// et produit des pages HTML autonomes (tout inliné : CSS en <style>, JS en <script>, images en data URL)
// prêtes à être affichées dans un <iframe srcdoc="..."> sans aucun serveur.

const BINARY_EXT = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", ico: "image/x-icon", bmp: "image/bmp",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
  eot: "application/vnd.ms-fontobject", mp3: "audio/mpeg", mp4: "video/mp4",
  wav: "audio/wav", ogg: "audio/ogg", pdf: "application/pdf",
};
// Formats photo qu'on peut recompresser sans trop perdre en qualité visuelle (pas svg/gif animés/icônes)
const COMPRESSIBLE_IMG = ["png", "jpg", "jpeg", "webp", "bmp"];
const TEXT_EXT = ["html", "htm", "css", "js", "json", "txt", "xml", "svg"];

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Redimensionne (max 1600px de côté) et recompresse une image en JPEG qualité 0.72.
// Réduit énormément la taille des photos issues d'un smartphone (souvent 3-5 Mo → quelques centaines de Ko).
async function compressImage(arrayBuffer, maxDim = 1600, quality = 0.72) {
  try {
    const blob = new Blob([arrayBuffer]);
    const bitmap = await createImageBitmap(blob);
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const outBlob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!outBlob) return null;
    return await blobToDataURL(outBlob);
  } catch {
    return null; // si la compression échoue (format inhabituel...), on retombera sur l'original
  }
}

function extOf(path) {
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

// Trouve le dossier racine commun à tous les fichiers, pour le retirer
// (ex: si tout est dans "Projet Webdev/...", on le strip pour avoir des chemins relatifs propres)
function commonRootPrefix(names) {
  if (!names.length) return "";
  const split = names.map((n) => n.split("/").slice(0, -1));
  let prefix = split[0];
  for (let i = 1; i < split.length; i++) {
    const cur = split[i];
    let j = 0;
    while (j < prefix.length && j < cur.length && prefix[j] === cur[j]) j++;
    prefix = prefix.slice(0, j);
  }
  return prefix.length ? prefix.join("/") + "/" : "";
}

// Résout un chemin relatif (ex: "../image/fish.jpg" depuis "HTML/") vers un chemin normalisé depuis la racine
function resolvePath(baseDir, relPath) {
  if (/^(https?:|data:|mailto:|tel:|#)/i.test(relPath)) return null;
  let rel = relPath.split("?")[0].split("#")[0];
  if (rel.startsWith("/")) rel = rel.slice(1);
  const parts = (baseDir ? baseDir.split("/") : []).concat(rel.split("/"));
  const stack = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function dirOf(path) {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

async function replaceAsync(str, regex, fn) {
  const matches = [...str.matchAll(regex)];
  let out = "", last = 0;
  for (const m of matches) {
    out += str.slice(last, m.index);
    out += await fn(...m);
    last = m.index + m[0].length;
  }
  out += str.slice(last);
  return out;
}

function inlineCssUrls(css, baseDir, filesMap) {
  return css.replace(/url\((['"]?)([^'")]+)\1\)/gi, (full, q, val) => {
    const resolved = resolvePath(baseDir, val);
    if (resolved && filesMap[resolved] && filesMap[resolved].type === "binary") {
      return `url(${filesMap[resolved].dataUrl})`;
    }
    return full;
  });
}

async function inlineHtmlPage(htmlPath, filesMap) {
  let html = filesMap[htmlPath].content;
  const baseDir = dirOf(htmlPath);

  // 1. Inline les <link rel="stylesheet" href="...">
  html = await replaceAsync(html, /<link\s+[^>]*rel=["']?stylesheet["']?[^>]*>/gi, async (tag) => {
    const m = tag.match(/href=["']([^"']+)["']/i);
    if (!m) return tag;
    const resolved = resolvePath(baseDir, m[1]);
    if (!resolved || !filesMap[resolved] || filesMap[resolved].type !== "text") return tag;
    const css = inlineCssUrls(filesMap[resolved].content, dirOf(resolved), filesMap);
    return `<style>${css}</style>`;
  });

  // 2. Inline les <script src="..."></script>
  html = await replaceAsync(html, /<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, async (tag, src) => {
    const resolved = resolvePath(baseDir, src);
    if (!resolved || !filesMap[resolved] || filesMap[resolved].type !== "text") return tag;
    return `<script>${filesMap[resolved].content}<\/script>`;
  });

  // 3. Inline les src="..."/href="..." d'images, icônes, médias en data URL (on laisse les liens vers d'autres pages .html intacts)
  html = html.replace(/\b(src|href)=["']([^"']+)["']/gi, (full, attr, val) => {
    if (/^(https?:|data:|mailto:|tel:|#)/i.test(val)) return full;
    if (attr.toLowerCase() === "href" && /\.html?$/i.test(val.split("?")[0].split("#")[0])) return full;
    const resolved = resolvePath(baseDir, val);
    if (resolved && filesMap[resolved] && filesMap[resolved].type === "binary") {
      return `${attr}="${filesMap[resolved].dataUrl}"`;
    }
    return full;
  });

  // 4. Inline les url(...) dans les <style> qui étaient déjà présents dans le HTML d'origine
  html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (full, css) => `<style>${inlineCssUrls(css, baseDir, filesMap)}</style>`);

  return html;
}

/**
 * Extrait un fichier .zip et retourne :
 * { pages: { "index.html": "<html>...inliné...</html>", "contacts.html": "..." },
 *   defaultPage: "index.html",
 *   totalSizeKB: 1234 }
 * Gère : plusieurs fichiers HTML, CSS/JS séparés, dossier d'images (jpg/png/webp/svg/...),
 * chemins relatifs avec "../", navigation entre pages internes, compression automatique des photos.
 *
 * onProgress(message) optionnel, pour afficher l'avancement pendant la compression des images.
 */
export async function extractZipToPages(file, onProgress) {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((f) => !f.dir);
  if (!entries.length) throw new Error("Le zip est vide.");

  const prefix = commonRootPrefix(entries.map((f) => f.name));

  // 1ère passe : extraction + compression standard (max 1600px, qualité 0.72)
  const buildFilesMap = async (maxDim, quality) => {
    const filesMap = {};
    let i = 0;
    for (const entry of entries) {
      const norm = entry.name.startsWith(prefix) ? entry.name.slice(prefix.length) : entry.name;
      if (!norm) continue;
      const ext = extOf(norm);
      if (BINARY_EXT[ext]) {
        if (COMPRESSIBLE_IMG.includes(ext)) {
          i++;
          if (onProgress) onProgress(`Compression des images (${i})...`);
          const buf = await entry.async("arraybuffer");
          const compressed = await compressImage(buf, maxDim, quality);
          if (compressed) { filesMap[norm] = { type: "binary", dataUrl: compressed }; continue; }
          // échec compression -> on garde l'original tel quel
          const b64 = await entry.async("base64");
          filesMap[norm] = { type: "binary", dataUrl: `data:${BINARY_EXT[ext]};base64,${b64}` };
        } else {
          const b64 = await entry.async("base64");
          filesMap[norm] = { type: "binary", dataUrl: `data:${BINARY_EXT[ext]};base64,${b64}` };
        }
      } else if (TEXT_EXT.includes(ext) || !ext) {
        filesMap[norm] = { type: "text", content: await entry.async("string") };
      }
    }
    return filesMap;
  };

  let filesMap = await buildFilesMap(1600, 0.72);

  const htmlPaths = Object.keys(filesMap).filter((p) => filesMap[p].type === "text" && /\.html?$/i.test(p));
  if (!htmlPaths.length) throw new Error("Aucun fichier .html trouvé dans le zip.");

  const buildPages = (fm) => {
    const basenames = htmlPaths.map((p) => p.split("/").pop());
    const navScript = `<script>(function(){var pages=${JSON.stringify(basenames)};document.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;var href=a.getAttribute('href');if(!href)return;var base=href.split('/').pop().split('?')[0].split('#')[0];if(pages.indexOf(base)>-1){e.preventDefault();parent.postMessage({devhubNav:base},'*');}});})();<\/script>`;
    return htmlPaths.reduce(async (accP, htmlPath) => {
      const acc = await accP;
      let processed = await inlineHtmlPage(htmlPath, fm);
      processed = processed.includes("</body>") ? processed.replace("</body>", navScript + "</body>") : processed + navScript;
      acc[htmlPath.split("/").pop()] = processed;
      return acc;
    }, Promise.resolve({}));
  };

  let pages = await buildPages(filesMap);
  let totalSizeKB = Math.round(JSON.stringify(pages).length / 1024);

  // Si encore trop lourd (> 8 Mo), 2ème passe avec compression plus agressive (max 1000px, qualité 0.55)
  if (totalSizeKB > 8000) {
    if (onProgress) onProgress("Encore trop volumineux, compression renforcée...");
    filesMap = await buildFilesMap(1000, 0.55);
    pages = await buildPages(filesMap);
    totalSizeKB = Math.round(JSON.stringify(pages).length / 1024);
  }

  const defaultPage = pages["index.html"] ? "index.html" : Object.keys(pages)[0];
  return { pages, defaultPage, totalSizeKB };
}
