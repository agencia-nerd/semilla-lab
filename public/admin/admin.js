// Panel de administración SemillaLab v2
import { accentStyle, colorAt, setStands, TAGS, prizeStyle } from "/palette.js";

const $root = document.getElementById("admin");
const $toast = document.getElementById("toast");
const SS_PIN = "semilla.adminPin";
const TAG_LABEL = Object.fromEntries(TAGS);

const st = { pin: sessionStorage.getItem(SS_PIN) || "", tab: "resumen", data: null, poll: null };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad = (n) => String(n).padStart(2, "0");
let tt;
const toast = (m) => { $toast.textContent = m; $toast.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => $toast.classList.remove("show"), 2600); };
const arrow = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 12h15M13 5l7 7-7 7"/></svg>`;
const phrase = `<div class="phrase"><span>Cultiva</span><span>tu idea.</span><span class="out">Cosecha</span><span>innovación.</span></div>`;

// La página se sirve por la URL de los QR (Netlify, proxy), pero la API va directo a SiteGround:
// así votos, vales y consultas automáticas no pasan por el anti-bots por IP de Netlify ni gastan sus créditos.
const API_BASE = location.hostname === "semilla-lab-camposol.netlify.app" ? "https://alonsom22.sg-host.com" : "";

async function api(action, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}/api/admin?action=${action}`, {
    method, headers: { "content-type": "application/json", "x-admin-pin": st.pin }, body: body ? JSON.stringify(body) : undefined,
  });
  if (action === "export" && res.ok) return res.blob();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Error"), { status: res.status });
  return data;
}

function renderLogin(err = "") {
  $root.innerHTML = `
    <section class="wrap"><form class="form" id="pinForm">
      <div class="tag">Panel del evento</div>
      <h1 class="form-title">PIN de<br>admin.</h1>
      ${err ? `<p class="form-error show">× ${esc(err)}</p>` : ""}
      <div class="field"><label for="pin">PIN</label><div class="input"><input type="password" id="pin" autocomplete="current-password" required></div></div>
      <button class="btn" type="submit">Entrar ${arrow}</button>
    </form></section>`;
  document.getElementById("pin").focus();
  document.getElementById("pinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    st.pin = document.getElementById("pin").value.trim();
    try { await refresh(); sessionStorage.setItem(SS_PIN, st.pin); render(); }
    catch (er) { renderLogin(er.status === 401 ? "PIN incorrecto" : er.message); }
  });
}

async function refresh() { st.data = await api("summary"); setStands(st.data.stands); }
const standIdx = (id) => st.data.stands.findIndex((s) => s.id === id);

const TABS = [["resumen", "Resultados"], ["stands", "Stands"], ["qr", "Códigos QR"], ["hojas", "Hojas de canje"]];

function render() {
  $root.innerHTML = `
    <div class="wrap admin">
      <nav class="anav" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-t="${k}" aria-selected="${st.tab === k}">${l}</button>`).join("")}<a class="anav-link" href="/staff" target="_blank" rel="noopener">Canje premios →</a></nav>
      <div id="tab"></div>
    </div>`;
  $root.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => { st.tab = b.dataset.t; render(); }));
  clearInterval(st.poll);
  ({ resumen: tabResumen, stands: tabStands, qr: tabQr, hojas: tabHojas })[st.tab]();
}

function topTags(tags = {}) {
  return Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, n]) => `<span>${esc(TAG_LABEL[k] || k)} · ${n}</span>`).join("");
}

function rankList(ranking, minVotes, showComments = false) {
  return `<ol class="rank">${ranking.map((r, i) => {
    const ranked = r.count >= minVotes;
    const si = standIdx(r.id);
    return `<li class="${ranked ? "" : "muted"}" style="${accentStyle(si)};--i:${i}">
      <span class="n">${r.logo ? `<img src="${esc(r.logo)}" alt="">` : ""}<em>${pad(si + 1)}</em></span>
      <div><h3>${esc(r.name)}</h3><div class="meta tag">#${r.pos || i + 1}${r.tie ? " · empate" : ""} · ${esc(r.team)} · ${r.count} voto${r.count === 1 ? "" : "s"}${r.fives ? ` · ${r.fives}× nota 5` : ""}${ranked ? "" : ` · mín. ${minVotes}`}</div>
        <div class="bar"><i style="width:${(r.avg / 5) * 100}%"></i></div>
        ${r.tags && Object.keys(r.tags).length ? `<div class="tags">${topTags(r.tags)}</div>` : ""}
        ${showComments && r.comments?.length ? `<details class="cmts"><summary class="tag">${r.comments.length} comentario${r.comments.length === 1 ? "" : "s"}</summary>
          <ul>${r.comments.map((c) => `<li><b>${c.stars}/5</b> ${esc(c.text)}</li>`).join("")}</ul></details>` : ""}</div>
      <div class="score">${r.avg ? r.avg.toFixed(2) : "–"}<small>promedio</small></div>
    </li>`;
  }).join("")}</ol>`;
}

function prizesHtml(d) {
  if (!d.prizeStats?.length) return "";
  return `<div class="sec tag"><span>Premios</span><span class="dim">Canjeados / desbloqueados</span></div>
    <div class="pz-stats">${d.prizeStats.map((p) => {
      const s = prizeStyle(p.key);
      return `<div class="pz-stat" style="--acc:${s.hex}"><img src="${s.img}" alt=""><b>${p.claimed}<em>/${p.unlocked}</em></b><span class="tag">${esc(p.name)} · ${p.at} stands</span>${p.ticketMax ? `<span class="tag dim">Números ${p.tickets}/${p.ticketMax}${p.tickets >= p.ticketMax * 0.9 ? " ⚠ casi agotados" : ""}</span>` : ""}<span class="tag dim">${p.unlocked - p.claimed} pendientes</span></div>`;
    }).join("")}</div>`;
}

function statsHtml(d) {
  return `<div class="stats">
    <div class="stat"><span class="tag">Registrados</span><b>${d.stats.registered}</b></div>
    <div class="stat"><span class="tag">Ya votaron</span><b>${d.stats.voters}</b></div>
    <div class="stat"><span class="tag">Votos</span><b>${d.stats.votes}</b></div>
    <div class="stat sun"><span class="tag">Completaron ${d.goal || 10} (todos los premios)</span><b>${d.stats.eligible}</b></div>
  </div>`;
}

function tabResumen() {
  const $t = document.getElementById("tab");
  const paint = () => {
    const d = st.data;
    $t.innerHTML = `
      ${statsHtml(d)}
      ${prizesHtml(d)}
      <div class="toolbar">
        <button class="btn sm ${d.config.votingOpen ? "" : "line"}" id="toggleVote">${d.config.votingOpen ? "Cierre de votación" : "Reabrir votación"}</button>
        ${d.config.votingOpen ? "" : `<button class="btn sm" id="showWinner">Ver ganador</button>`}
        <button class="btn sm line" id="live">Proyectar</button>
        <button class="btn sm line" id="csv">Exportar CSV</button>
        <span class="tag dim">● ${d.config.votingOpen ? "Abierta" : "Cerrada"} · se actualiza cada 30 s</span>
      </div>
      <div class="sec tag"><span>Favorito del público</span><span class="dim">Ranking en vivo</span></div>
      <div class="rules tag">Reglas: compiten los stands con al menos ${d.minVotesToRank} votos. Gana el <b>mayor promedio</b>; si empatan, <b>más votos totales</b>; luego <b>más votos con nota 5</b>; luego <b>más votos con nota 4</b>. Si siguen iguales en todo, comparten el puesto.</div>
      ${d.ranking.length ? rankList(d.ranking, d.minVotesToRank, true) : `<p class="empty tag">Sin stands.</p>`}`;
    document.getElementById("toggleVote").addEventListener("click", async () => {
      const open = !st.data.config.votingOpen;
      if (!confirm(open ? "¿Reabrir la votación?" : "¿Cerrar la votación? Nadie podrá votar ni cambiar su voto.")) return;
      await api("config", { method: "POST", body: { votingOpen: open } });
      await refresh(); paint(); toast(open ? "Votación abierta" : "Votación cerrada");
      if (!open) winnerModal(st.data);
    });
    document.getElementById("csv").addEventListener("click", async () => {
      const blob = await api("export");
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "semilla-lab-votos.csv" });
      a.click(); URL.revokeObjectURL(a.href);
    });
    document.getElementById("live").addEventListener("click", openLive);
    document.getElementById("showWinner")?.addEventListener("click", async () => { await refresh(); winnerModal(st.data); });
  };
  paint();
  st.poll = setInterval(async () => { try { await refresh(); if (st.tab === "resumen" && !document.querySelector(".live")) paint(); } catch {} }, 30000);
}

// Al cerrar la votación: pantalla con el primer puesto del público (o los empatados en el primer puesto).
function winnerModal(d) {
  const ranked = (d.ranking || []).filter((r) => r.count >= d.minVotesToRank);
  const top = ranked.filter((r) => r.pos === 1);
  const el = document.createElement("div");
  el.className = "winner";
  const card = (r) => {
    const si = standIdx(r.id);
    return `<div class="w-card" style="${accentStyle(si)}">
      ${r.logo ? `<img class="w-logo" src="${esc(r.logo)}" alt="Logo ${esc(r.name)}">` : ""}
      <span class="w-num">Stand ${pad(si + 1)}</span>
      <h2>${esc(r.name)}</h2>
      <div class="tag">${esc(r.team)}</div>
      <div class="w-stats"><b>${r.avg.toFixed(2)}</b><span>promedio</span><b>${r.count}</b><span>votos</span><b>${r.fives}</b><span>notas 5</span></div>
    </div>`;
  };
  el.innerHTML = `<div class="w-box" role="dialog" aria-modal="true" aria-label="Favorito del público">
      <div class="tag w-kick">Votación cerrada · SemillaLab 2026</div>
      <h1>${top.length > 1 ? "Empate en el<br>primer puesto" : "Favorito<br>del público"}</h1>
      ${top.length ? top.map(card).join("") : `<p class="tag">Ningún stand llegó al mínimo de ${d.minVotesToRank} votos.</p>`}
      <button class="btn" id="wClose">Cerrar</button>
    </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.querySelector("#wClose").addEventListener("click", close);
  el.addEventListener("click", (e) => { if (e.target === el) close(); });
}

function openLive() {
  const el = document.createElement("div");
  el.className = "live";
  const paint = () => {
    const d = st.data;
    el.innerHTML = `
      <div class="row-between tag" style="padding-bottom:14px;border-bottom:var(--b)"><span>Voto del público · ● En vivo</span><img src="/assets/camposol-badge.webp" alt="Camposol" height="56" style="height:56px"></div>
      ${phrase}
      ${statsHtml(d)}
      ${rankList(d.ranking, d.minVotesToRank)}`;
  };
  paint();
  const close = Object.assign(document.createElement("button"), { className: "btn sm line live-close", textContent: "Salir" });
  document.body.append(el, close);
  el.requestFullscreen?.().catch(() => {});
  const iv = setInterval(async () => { try { await refresh(); paint(); } catch {} }, 30000);
  close.addEventListener("click", () => { clearInterval(iv); el.remove(); close.remove(); document.fullscreenElement && document.exitFullscreen(); render(); });
}

function tabStands() {
  let stands = st.data.stands.map((s) => ({ ...s }));
  const $t = document.getElementById("tab");
  const paint = () => {
    $t.innerHTML = `
      <div class="sec tag"><span>Stands</span><span class="dim">El orden define número y color</span></div>
      <div id="rows">${stands.map((s, i) => `
        <div class="editor-row" data-i="${i}" style="${accentStyle(i)}">
          <span class="n">${pad(i + 1)}</span>
          <div class="fields">
            <input data-k="name" value="${esc(s.name)}" placeholder="Nombre de la idea">
            <input data-k="team" value="${esc(s.team)}" placeholder="Categoría">
            <textarea data-k="pitch" rows="2" placeholder="La idea en una línea">${esc(s.pitch)}</textarea>
            <span class="tag dim">${esc(colorAt(i).name)}</span>
          </div>
          <div style="display:grid;gap:6px">
            <button class="icon-btn" data-up="${i}" title="Subir">↑</button>
            <button class="icon-btn" data-del="${i}" title="Eliminar">×</button>
          </div>
        </div>`).join("")}</div>
      <div class="toolbar">
        <button class="btn sm line" id="add">Agregar stand</button>
        <button class="btn sm" id="saveStands">Guardar cambios</button>
      </div>`;
    $t.querySelectorAll(".editor-row [data-k]").forEach((inp) => inp.addEventListener("input", () => {
      stands[+inp.closest(".editor-row").dataset.i][inp.dataset.k] = inp.value;
    }));
    $t.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      const s = stands[+b.dataset.del];
      if (confirm(`¿Eliminar "${s.name}"?`)) { stands.splice(+b.dataset.del, 1); paint(); }
    }));
    $t.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", () => {
      const i = +b.dataset.up; if (!i) return;
      [stands[i - 1], stands[i]] = [stands[i], stands[i - 1]]; paint();
    }));
    document.getElementById("add").addEventListener("click", () => { stands.push({ id: "", name: "", team: "", pitch: "" }); paint(); $t.querySelector(".editor-row:last-child input")?.focus(); });
    document.getElementById("saveStands").addEventListener("click", async (e) => {
      e.target.classList.add("is-loading");
      try { await api("stands", { method: "POST", body: { stands } }); await refresh(); stands = st.data.stands.map((s) => ({ ...s })); paint(); toast("Stands guardados"); }
      catch (er) { toast(er.message); e.target.classList.remove("is-loading"); }
    });
  };
  paint();
}

const QR_BASE = "https://semilla-lab-camposol.netlify.app";

function qrSvg(text) {
  const qr = window.qrcode(0, "M");
  qr.addData(text); qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}

function tabQr() {
  const $t = document.getElementById("tab");
  // Los QR impresos apuntan a la URL oficial de Netlify, que redirige al servidor.
  // Se fija aquí para que un QR generado desde otro dominio (p. ej. SiteGround) sea idéntico a los impresos.
  const base = QR_BASE;
  $t.innerHTML = `
    <div class="toolbar no-print"><button class="btn sm" id="print">Imprimir QRs</button>
      <span class="tag dim">Cada QR → ${esc(base)}/?stand=… → entrada 3 s → votar</span></div>
    <p class="dim no-print" style="margin:0 0 16px">⚠ Los QR ya están impresos. Estos siempre usan la URL oficial
      (${esc(base.replace(/^https?:\/\//, ""))}), aunque abras el panel desde otro dominio.
      Para reimprimir, usa preferentemente los archivos de <b>QR-SemillaLab-2026.zip</b>.</p>
    <div class="qr-web">
      <div class="qr" id="webQr">${qrSvg(base + "/")}</div>
      <div class="qr-web-txt">
        <span class="tag">QR de la web</span>
        <h3>SemillaLab</h3>
        <a class="url" href="${esc(base)}/" target="_blank" rel="noopener">${esc(base.replace(/^https?:\/\//, ""))}</a>
        <p class="dim">Para el tótem de registro, afiches y pantallas: abre la app en la portada.</p>
        <button class="btn sm no-print" id="dlWeb">Descargar PNG</button>
      </div>
    </div>
    <div class="qr-sheet">
      ${st.data.stands.map((s, i) => `
      <div class="qr-card" style="${accentStyle(i)}">
        <div class="qh"><span class="tag">Stand</span><b>${pad(i + 1)}</b></div>
        <div class="qr">${qrSvg(`${base}/?stand=${encodeURIComponent(s.id)}`)}</div>
        <h3>${esc(s.name)}</h3><div class="foot tag dim">${esc(s.team || "Escanea · vota · cosecha")}</div>
      </div>`).join("")}
    </div>`;
  document.getElementById("print").addEventListener("click", () => window.print());
  document.getElementById("dlWeb").addEventListener("click", () => downloadQrPng(base + "/", "semilla-lab-qr-web.png"));
}

// PNG de alta resolución (1200 px) para imprimir en grande o enviar por WhatsApp.
function downloadQrPng(text, filename) {
  const qr = window.qrcode(0, "M");
  qr.addData(text); qr.make();
  const n = qr.getModuleCount(), margin = 4, size = 1200, cell = size / (n + margin * 2);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, size, size);
  g.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++)
    if (qr.isDark(r, k)) g.fillRect(Math.floor((k + margin) * cell), Math.floor((r + margin) * cell), Math.ceil(cell), Math.ceil(cell));
  const a = document.createElement("a");
  a.href = c.toDataURL("image/png"); a.download = filename; a.click();
}

// Hojas para cada puesto: los números del 1 al ticketMax en casillas para tachar al entregar,
// 500 por hoja A4 (con 1.000 números, cada premio lleva 2 hojas: 1–500 y 501–1.000).
const PER_SHEET = 500;
function tabHojas() {
  const $t = document.getElementById("tab");
  const prizes = st.data.prizeStats || [];
  const max = prizes[0]?.ticketMax || 500;
  const parts = Math.ceil(max / PER_SHEET);
  const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => `<span>${from + i}</span>`).join("");
  $t.innerHTML = `
    <div class="toolbar no-print">
      <button class="btn sm" id="printAll">Imprimir las ${prizes.length}</button>
      ${prizes.map((p) => `<button class="btn sm line" data-print="${p.key}">Solo ${esc(p.name)}</button>`).join("")}
      <span class="tag dim">${parts > 1 ? `${parts} hojas A4 por puesto` : "Una hoja A4 por puesto"} · casillas del 1 al ${max.toLocaleString("es-PE")}</span>
    </div>
    <p class="tag dim no-print">Cada vale muestra un número al azar, distinto para cada premio. La señora busca ese número en su hoja, lo tacha y entrega. Si ya está tachado, ese vale ya se usó.${parts > 1 ? ` Cada puesto recibe sus ${parts} hojas (del 1 al ${PER_SHEET} y desde el ${PER_SHEET + 1}).` : ""}</p>
    ${prizes.map((p) => {
      const s = prizeStyle(p.key);
      return Array.from({ length: parts }, (_, k) => {
        const from = k * PER_SHEET + 1, to = Math.min(max, (k + 1) * PER_SHEET);
        const label = parts > 1 ? ` <em>· ${from}–${to}</em>` : "";
        return `<section class="sheet" data-sheet="${p.key}" style="--acc:${s.hex}">
        <header class="sheet-h">
          <img src="/assets/semilla-bulb.webp" alt="" width="44" height="44">
          <div><b>Hoja de canje · ${esc(p.name)}${label}</b><span>Busca el número del vale y <u>táchalo</u> al entregar. Si ya está tachado, no entregues.</span></div>
          <img class="sheet-prize" src="${s.img}" alt="">
        </header>
        <div class="sheet-grid">${range(from, to)}</div>
        <footer class="sheet-f">SemillaLab 2026 · Camposol · ${esc(p.name)} (nivel ${p.at} stands)${parts > 1 ? ` · hoja ${k + 1} de ${parts}` : ""}</footer>
      </section>`;
      }).join("");
    }).join("")}`;
  const print = (key) => {
    document.querySelectorAll(".sheet").forEach((el) => el.classList.toggle("skip", !!key && el.dataset.sheet !== key));
    window.print();
    document.querySelectorAll(".sheet.skip").forEach((el) => el.classList.remove("skip"));
  };
  document.getElementById("printAll").addEventListener("click", () => print(null));
  $t.querySelectorAll("[data-print]").forEach((b) => b.addEventListener("click", () => print(b.dataset.print)));
}

(async () => {
  if (!st.pin) return renderLogin();
  try { await refresh(); render(); } catch { sessionStorage.removeItem(SS_PIN); renderLogin(); }
})();
