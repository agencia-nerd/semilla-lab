// Semilla Lab v2 · votación del público
import { colorAt, accentStyle, setStands, TAGS, prizeStyle } from "/palette.js";

const $app = document.getElementById("app");
const $top = document.getElementById("topRight");
const $toast = document.getElementById("toast");

const LS_SESSION = "semilla.session";
const LS_PENDING = "semilla.pendingStand";
const SPLASH_MS = 3000;

const VERDICT = ["", "Puede crecer", "Buena semilla", "Va por buen camino", "Muy prometedora", "Lista para cosechar"];

const state = {
  session: load(LS_SESSION),
  stands: null,
  config: { votingOpen: true, minForRaffle: 10 },
  votes: {},
  // Definición de premios (llega del servidor; esta es la de respaldo) y estado de la persona.
  prizes: [
    { key: "canchita", name: "Canchita", at: 3 }, { key: "gaseosa", name: "Gaseosa", at: 5 },
    { key: "helado", name: "Helado", at: 8 }, { key: "pancho", name: "Hot Dog", at: 10 },
  ],
  myPrizes: [],
  authTab: "register",
};

// ---------- utils ----------
function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function save(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} }
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const icon = (id, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const firstName = (n) => esc(String(n || "").split(" ")[0]);
const pad = (n) => String(n).padStart(2, "0");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let toastTimer;
function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove("show"), 2800);
}

// Si la red falla o la plataforma responde con su página de verificación anti-bots
// (HTML en vez de JSON), reintenta con espera creciente antes de mostrar un error.
async function api(path, { method = "GET", body } = {}, attempt = 0) {
  const headers = { "content-type": "application/json" };
  if (state.session) headers.authorization = `Bearer ${state.session.phone}:${state.session.token}`;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    if (attempt < 3) { await sleep([1500, 4000, 9000][attempt]); return api(path, { method, body }, attempt + 1); }
    throw Object.assign(new Error("Sin conexión. Revisa tu señal e inténtalo de nuevo."), { status: 0 });
  }
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  if (!isJson && (res.status === 403 || res.status === 429 || res.status >= 500)) {
    if (attempt === 0) toast("Mucha gente conectada. Reintentando…");
    if (attempt < 3) { await sleep([2000, 5000, 10000][attempt]); return api(path, { method, body }, attempt + 1); }
    throw Object.assign(new Error("La red está saturada. Espera unos segundos y vuelve a intentar."), { status: res.status });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Algo salió mal"), { status: res.status });
  return data;
}

// Gráficos de campaña: colinas, mosaicos de esquina y franja de marca.
const hills = (top = "var(--teal)") => `
  <div class="hills" aria-hidden="true"><svg viewBox="0 0 400 70" preserveAspectRatio="none">
    <rect width="400" height="70" fill="${top}"/>
    <path d="M0 38 C 90 8, 170 10, 250 34 S 360 52, 400 30 V70 H0Z" fill="#62a70f"/>
    <path d="M0 52 C 80 30, 190 36, 270 50 S 370 60, 400 46 V70 H0Z" fill="#1caf58"/>
  </svg></div>`;
const tiles = () => `<div class="tiles" aria-hidden="true"><svg><use href="#i-tile-x"/></svg><svg><use href="#i-tile-leaf"/></svg><span></span><svg><use href="#i-tile-flower"/></svg></div>`;
const brandBand = () => `
  <div class="brand-band"><img class="bb-bulb" src="/assets/semilla-bulb.webp" alt="Semilla Lab" width="48" height="48"><span>Trabajamos el campo<br>para mejorar vidas.</span><img class="bb-camposol" src="/assets/camposol-white.webp" alt="Camposol" width="95" height="16"></div>`;

const phrase = (reveal = true) => `
  <div class="phrase ${reveal ? "reveal" : ""}" aria-label="Cultiva tu idea. Cosecha innovación.">
    <span style="--i:0">Cultiva</span><span style="--i:1">tu idea.</span><span class="out" style="--i:2">Cosecha</span><span style="--i:3">innovación.</span>
  </div>`;

const standIndex = (id) => state.stands?.findIndex((s) => s.id === id) ?? -1;
const votedCount = () => (state.stands || []).filter((s) => state.votes[s.id]).length;
const goal = () => Math.max(...state.prizes.map((p) => p.at));
const nextPrize = (n) => state.prizes.filter((p) => p.at > n).sort((a, b) => a.at - b.at)[0] || null;
const prizeStyleAttr = (key) => { const st = prizeStyle(key); return `--acc:${st.hex};--acc-fg:${st.fg};--acc-ink:${st.ink}`; };
const hhmm = (iso) => { try { return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false }); } catch { return ""; } };

// ---------- data ----------
async function loadStands() {
  if (state.stands) return;
  const data = await api("/api/stands");
  state.stands = data.stands;
  setStands(state.stands);
  state.config = data.config;
  if (data.prizes?.length) state.prizes = data.prizes;
}
async function loadMe() {
  try {
    const data = await api("/api/me");
    state.votes = data.votes;
    state.config = data.config;
    state.myPrizes = data.prizes || [];
    state.session.name = data.user.name;
    save(LS_SESSION, state.session);
  } catch (e) {
    if (e.status === 401) logout(false);
    else throw e;
  }
}

function setSession(user) {
  state.session = { phone: user.phone, token: user.token, name: user.name };
  save(LS_SESSION, state.session);
}
function logout(redirect = true) {
  state.session = null; state.votes = {};
  save(LS_SESSION, null);
  renderTop();
  if (redirect) go("/");
}

// ---------- routing ----------
function go(url, { replace = false, splash = false } = {}) {
  history[replace ? "replaceState" : "pushState"]({}, "", url);
  route({ splash });
}
window.addEventListener("popstate", () => route());

async function route({ splash = false } = {}) {
  window.scrollTo({ top: 0 });
  renderTop();
  const params = new URLSearchParams(location.search);
  const standId = params.get("stand");
  const view = params.get("v");

  if (standId) {
    if (splash) await showSplash(standId);
    if (!state.session) {
      save(LS_PENDING, standId);
      state.authTab = "register";
      return renderAuth(true);
    }
    return renderStand(standId);
  }
  if (view === "vale") {
    if (!state.session) return go("/?v=ingresar", { replace: true });
    return renderVale(params.get("p"));
  }
  if (view === "ingresar") {
    if (state.session) return go("/", { replace: true });
    state.authTab = params.get("r") ? "register" : "login";
    return renderAuth(false);
  }
  if (state.session) return renderHome();
  return renderLanding();
}

function renderTop() {
  $top.innerHTML = state.session
    ? `<span class="user-pill"><i></i>${firstName(state.session.name)}<button type="button" id="logoutBtn">Salir</button></span>`
    : `<img class="camposol-logo" src="/assets/camposol-white.webp" alt="Camposol" width="154" height="26">`;
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    if (confirm("¿Cerrar sesión? Podrás volver a entrar con tu celular.")) logout();
  });
}

// ---------- Entrada QR: 3 s con la frase y el stand ----------
async function showSplash(standId) {
  try { await Promise.race([loadStands(), sleep(1200)]); } catch {}
  const i = standIndex(standId);
  const s = i >= 0 ? state.stands[i] : null;
  const c = colorAt(Math.max(0, i));
  const el = document.createElement("div");
  el.className = "splash";
  el.setAttribute("style", accentStyle(Math.max(0, i)));
  el.innerHTML = `
    ${tiles()}
    <div class="sp-head"><img class="sp-bulb" src="/assets/semilla-bulb.webp" alt="Semilla Lab" width="54" height="54"><img class="sp-camposol" src="/assets/camposol-white.webp" alt="Camposol" width="154" height="26" style="margin-right:72px"></div>
    ${phrase(true)}
    <div class="sp-stand">
      <div class="tag">${s ? "Estás en" : "Bienvenido a"}</div>
      ${s ? `<div class="sp-id"><span>Stand</span><b>${pad(i + 1)}</b></div><span class="sp-chip tag">${esc(c.name)}</span>` : ""}
    </div>
    <div class="sp-bar"><div class="row-between tag"><span>Cargando votación…</span><span id="spT">00:03</span></div><div class="track"><i></i></div></div>
    ${hills("transparent")}`;
  document.body.appendChild(el);
  if (navigator.vibrate) navigator.vibrate(20);
  let left = 3;
  const tick = setInterval(() => { left -= 1; const t = el.querySelector("#spT"); if (t && left >= 0) t.textContent = `00:0${left}`; }, 1000);
  await new Promise((resolve) => {
    const done = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(done, SPLASH_MS);
    el.addEventListener("click", done, { once: true });
  });
  clearInterval(tick);
  el.classList.add("leaving");
  setTimeout(() => el.remove(), 460);
}

// ---------- views ----------
function renderLanding() {
  $app.innerHTML = `
    <section class="view">
      <header class="hero">${tiles()}
        <div class="wrap">
          <span class="eyebrow">Semilla Lab 2026 <svg class="sprout"><use href="#i-sprout"/></svg></span>
          ${phrase(true)}
          <p class="lede">Recorre los stands, vota por las ideas que hacen el cambio y desbloquea premios.</p>
        </div>
        ${hills()}
      </header>
      <div class="wrap cover grow">
        <div class="cover-foot">
          <span class="tag">Premios a los 3, 5, 8 y 10 stands votados.</span>
          <span class="big-num">03</span>
        </div>
        <div class="prize-strip">${state.prizes.map((p, i) => `<div class="ps" style="${prizeStyleAttr(p.key)};--i:${i}"><img src="${prizeStyle(p.key).img}" alt="${esc(p.name)}" loading="lazy"><b>${pad(p.at)}</b></div>`).join("")}</div>
      </div>
      <div class="dock"><div class="dock-inner">
        <button class="btn" data-go="register">Quiero votar ${icon("arrow")}</button>
        <button class="link-btn" data-go="login">Ya me registré →</button>
      </div></div>
      ${brandBand()}
    </section>`;
  $app.querySelectorAll("[data-go]").forEach((b) =>
    b.addEventListener("click", () => go(b.dataset.go === "login" ? "/?v=ingresar" : "/?v=ingresar&r=1")));
  loadStands().catch(() => {});
}

function renderAuth(fromQr) {
  const reg = state.authTab === "register";
  const pending = load(LS_PENDING);
  const pi = pending ? standIndex(pending) : -1;
  $app.innerHTML = `
    <section class="view" ${pi >= 0 ? `style="${accentStyle(pi)}"` : ""}>
      <div class="wrap grow"><form class="form" id="authForm" novalidate>
        ${fromQr ? `<p class="notice acc">${pi >= 0 ? `Stand ${pad(pi + 1)} te espera.` : ""} Regístrate y te llevamos directo a votar.</p>` : ""}
        <div class="tag">${reg ? "Registro" : "Volver a entrar"}</div>
        <h1 class="form-title">${reg ? `Tu nombre<br>y tu cel.<br><em>Y a votar.</em>` : `Solo tu<br>celular.`}</h1>
        <p class="form-error" id="formError"></p>
        ${reg ? `
        <div class="field" id="f-name">
          <label for="name">Nombre y apellido</label>
          <div class="input"><input type="text" id="name" autocomplete="name" placeholder="Rosa Quispe" maxlength="80" required></div>
          <span class="err"></span>
        </div>` : ""}
        <div class="field" id="f-phone">
          <label for="phone">Celular</label>
          <div class="input"><span class="pre">+51</span><input type="tel" id="phone" inputmode="numeric" autocomplete="tel-national" placeholder="9xx xxx xxx" maxlength="11" required></div>
          <span class="err"></span>
        </div>
        ${reg ? `<label class="check"><input type="checkbox" id="consent"> Acepto que Camposol use mi nombre y celular para esta votación y para la entrega de premios.</label>` : ""}
      </form></div>
      <div class="dock"><div class="dock-inner">
        <button class="btn" type="submit" form="authForm" id="authBtn" >${reg ? "Entrar a votar" : "Entrar"} ${icon("arrow")}</button>
        <button class="link-btn" id="swapTab">${reg ? "Ya me registré →" : "Registrarme →"}</button>
      </div></div>
    </section>`;

  document.getElementById("swapTab").addEventListener("click", () => { state.authTab = reg ? "login" : "register"; renderAuth(fromQr); });

  const phone = document.getElementById("phone");
  phone.addEventListener("input", () => {
    const d = phone.value.replace(/\D/g, "").slice(0, 9);
    phone.value = d.replace(/(\d{3})(\d{0,3})(\d{0,3})/, (_, a, b, c) => [a, b, c].filter(Boolean).join(" "));
  });
  (document.getElementById("name") || phone).focus({ preventScroll: true });

  document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const $err = document.getElementById("formError");
    const setFieldErr = (id, msg) => {
      const f = document.getElementById(id); if (!f) return;
      f.classList.toggle("has-error", !!msg); f.querySelector(".err").textContent = msg || "";
    };
    $err.classList.remove("show");
    const digits = phone.value.replace(/\D/g, "");
    const nameVal = document.getElementById("name")?.value.trim() ?? "";
    let bad = false;
    if (reg && (nameVal.length < 3 || !/\s/.test(nameVal))) { setFieldErr("f-name", "× Escribe nombre y apellido."); bad = true; } else setFieldErr("f-name");
    if (!/^9\d{8}$/.test(digits)) { setFieldErr("f-phone", "× 9 dígitos y empieza con 9."); bad = true; } else setFieldErr("f-phone");
    if (reg && !document.getElementById("consent").checked) { $err.textContent = "× Marca la autorización para continuar."; $err.classList.add("show"); bad = true; }
    if (bad) return;

    const btn = document.getElementById("authBtn");
    btn.classList.add("is-loading"); btn.disabled = true;
    btn.querySelector("use").setAttribute("href", "#i-load");
    try {
      const data = reg
        ? await api("/api/register", { method: "POST", body: { name: nameVal, phone: digits, consent: true } })
        : await api("/api/login", { method: "POST", body: { phone: digits } });
      setSession(data.user);
      if (data.existing) toast(`Ya estabas registrado, ${firstName(data.user.name)}.`);
      const p = load(LS_PENDING);
      save(LS_PENDING, null);
      go(p ? `/?stand=${encodeURIComponent(p)}` : "/", { replace: true });
    } catch (err) {
      $err.textContent = `× ${err.message}`;
      if (err.status === 404) $err.innerHTML = `× ${esc(err.message)} <a href="#" id="toReg">Registrarme</a>`;
      $err.classList.add("show");
      document.getElementById("toReg")?.addEventListener("click", (ev) => { ev.preventDefault(); state.authTab = "register"; renderAuth(fromQr); });
      btn.classList.remove("is-loading"); btn.disabled = false;
      btn.querySelector("use").setAttribute("href", "#i-arrow");
    }
  });
}

function counterBlock(n, min, color) {
  const bars = Array.from({ length: min }, (_, k) => `<i class="${k < n ? "on" : ""}" style="--i:${k};${color ? `--bar:${color}` : ""}"></i>`).join("");
  return `<div class="counter"><div class="big">${pad(Math.min(n, 99))}<em>/${pad(min)}</em></div><div class="bars ${min > 8 ? "thin" : ""}">${bars}</div></div>`;
}

// Tarjeta de premio: bloqueado / listo (abre el vale) / canjeado.
function prizeCard(z, i) {
  const st = prizeStyle(z.key);
  const state_ = z.claimed ? "claimed" : z.unlocked ? "ready" : "locked";
  const foot = z.claimed ? `<span class="pz-foot tag">✓ Canjeado ${hhmm(z.claimedAt)}</span>`
    : z.unlocked ? `<span class="pz-foot tag go">Ver vale →</span>`
    : `<span class="pz-foot tag">Faltan ${pad(z.missing)}</span><span class="pz-bar"><i style="width:${Math.round(((z.at - z.missing) / z.at) * 100)}%"></i></span>`;
  return `<button class="prize ${state_}" style="${prizeStyleAttr(z.key)};--i:${i}" data-prize="${z.key}" aria-label="${esc(z.name)}: ${state_ === "ready" ? "listo para canjear" : state_ === "claimed" ? "canjeado" : `faltan ${z.missing} stands`}">
    <span class="pz-top tag"><span>${pad(z.at)} stands</span>${z.claimed ? icon("check", "pz-tick") : ""}</span>
    <img src="${st.img}" alt="" loading="lazy">
    <span class="pz-name">${esc(z.name)}</span>
    ${foot}
  </button>`;
}

function tileHtml(s, i) {
  const v = state.votes[s.id];
  return `<button class="tile ${v ? "voted" : ""}" style="${accentStyle(i)};--i:${i}" data-stand="${esc(s.id)}" aria-label="Stand ${pad(i + 1)}, ${esc(s.name)}${v ? `, votado con ${v.stars}` : ""}">
    <span class="tile-top tag"><span>Stand</span>${v ? `<span class="score">${v.stars}/5</span>` : `<span class="swatch"></span>`}</span>
    <span class="num">${pad(i + 1)}</span>
    <span class="name">${esc(s.name)}</span>
    ${v ? icon("check", "tick") : ""}
  </button>`;
}

async function renderHome() {
  $app.innerHTML = `
    <section class="view"><div class="wrap home home-grid">
      <aside>
        <div class="hello">¡Hola, ${firstName(state.session.name)}! <svg class="sprout"><use href="#i-sprout"/></svg></div>
        <button class="qv" id="scanBtn">${icon("scan")}<span><b>Quiero votar</b><span class="tag">Escanea el QR o toca un stand</span></span></button>
        <div class="harvest" id="harvest"><div class="tag">Tu cosecha</div><div class="skel" style="height:96px;margin-top:10px"></div></div>
      </aside>
      <section>
        <div class="grid-head"><h2>Stands</h2><span class="tag" id="listCount"></span></div>
        <div class="grid" id="grid">${Array.from({ length: 6 }, () => `<div class="skel skel-tile"></div>`).join("")}</div>
      </section>
    </div>${brandBand()}</section>`;
  document.getElementById("scanBtn").addEventListener("click", openScanner);

  try {
    await Promise.all([loadStands(), loadMe()]);
  } catch (e) {
    document.getElementById("grid").innerHTML = `<div class="empty tag">× No pudimos cargar los stands. ${esc(e.message)}<br><br><button class="btn line sm" onclick="location.reload()">Reintentar</button></div>`;
    return;
  }
  if (!state.session) return;

  const n = votedCount();
  const nx = nextPrize(n);
  const ready = state.myPrizes.filter((z) => z.unlocked && !z.claimed).length;
  document.getElementById("harvest").innerHTML = `
    <div class="tag">Tu cosecha</div>
    ${counterBlock(n, goal(), nx ? null : "var(--sun)")}
    <div class="tag" style="margin-top:10px">${nx ? "Vota por los participantes y canjea deliciosos premios" : "Cosecha completa. Todos los premios desbloqueados."}</div>
    ${state.config.votingOpen ? "" : `<div class="closed tag">Votación cerrada. Gracias por participar.</div>`}
    <div class="grid-head prizes-head"><h2>Premios</h2><span class="tag">${ready ? `${pad(ready)} por canjear` : "3 · 5 · 8 · 10 votos"}</span></div>
    <div class="prizes">${state.myPrizes.map(prizeCard).join("")}</div>`;
  document.querySelectorAll("[data-prize]").forEach((el) => el.addEventListener("click", () => {
    const z = state.myPrizes.find((p) => p.key === el.dataset.prize);
    if (z?.unlocked) go(`/?v=vale&p=${z.key}`);
    else toast(`Te faltan ${z.missing} stands para ${z.name}.`);
  }));
  document.getElementById("listCount").textContent = `${pad(n)} / ${pad(state.stands.length)} votados`;

  if (!state.stands.length) {
    document.getElementById("grid").innerHTML = `<div class="empty tag">Aún no hay stands publicados.</div>`;
    return;
  }
  // Agrupados por categoría: un título con el color del grupo antes de sus stands.
  document.getElementById("grid").innerHTML = state.stands.map((s, i) =>
    (s.team && s.team !== state.stands[i - 1]?.team ? `<div class="grid-cat" style="${accentStyle(i)}"><i></i>${esc(s.team)}</div>` : "") + tileHtml(s, i)).join("");
  document.querySelectorAll("[data-stand]").forEach((el) =>
    el.addEventListener("click", () => go(`/?stand=${encodeURIComponent(el.dataset.stand)}`)));
}

async function renderStand(id) {
  $app.innerHTML = `<section class="view"><div class="skel" style="height:46vh"></div><div class="wrap"><div class="skel" style="height:80px;margin-top:24px"></div></div></section>`;
  try {
    await Promise.all([loadStands(), loadMe()]);
  } catch (e) {
    $app.innerHTML = `<section class="view"><div class="wrap empty tag">× ${esc(e.message)}<br><br><button class="btn line sm" onclick="location.reload()">Reintentar</button></div></section>`;
    return;
  }
  if (!state.session) return route();
  const idx = standIndex(id);
  if (idx < 0) {
    toast("Ese QR no corresponde a ningún stand.");
    return go("/", { replace: true });
  }
  const s = state.stands[idx];
  const c = colorAt(idx);
  const prev = state.votes[s.id];
  let grade = prev?.stars || 0;
  let tags = new Set(prev?.tags || []);
  const open = state.config.votingOpen;

  $app.innerHTML = `
    <section class="view" style="${accentStyle(idx)}">
      <header class="st-hero"><div class="wrap">
        <div class="row-between tag"><button class="back tag" id="backBtn">${icon("back")} Mi cosecha</button><span>${esc(c.name)}</span></div>
        <div class="st-huge" aria-hidden="true">${pad(idx + 1)}</div>
        <div class="tag">Stand ${pad(idx + 1)} · ${esc(s.team)}</div>
        <h1 class="st-name">${esc(s.name)}</h1>
        ${s.pitch ? `<p class="st-pitch">${esc(s.pitch)}</p>` : ""}
      </div></header>
      <div class="wrap grow"><div class="vote">
        <div class="vote-h tag"><span>${prev ? "Tu voto" : "Déjanos tu voto"}</span><span class="dim">${prev ? "Puedes cambiarla" : "1 toque"}</span></div>
        <div class="grades" role="radiogroup" aria-label="Tu nota del 1 al 5">
          ${[1, 2, 3, 4, 5].map((n) => `<button class="grade" role="radio" aria-checked="false" data-n="${n}" ${open ? "" : "disabled"}>${n}</button>`).join("")}
        </div>
        <div class="grade-scale tag"><span>1 Puede crecer</span><span>5 Lista para cosechar</span></div>
        <div class="verdict" id="verdict"><b></b><span></span></div>
        <div class="vote-h tag"><span>Lo más fuerte</span><span class="dim">Opcional · máx. 2</span></div>
        <div class="chips">${TAGS.map(([k, l]) => `<button class="chip" data-tag="${k}" aria-pressed="false" ${open ? "" : "disabled"}>${l}</button>`).join("")}</div>
        <label class="comment"><span class="tag">Comentarios (opcional)</span>
          <textarea id="comment" rows="2" maxlength="280" placeholder="¿Qué te gustó o qué mejorarías?" ${open ? "" : "disabled"}>${esc(prev?.comment || "")}</textarea></label>
      </div></div>
      <div class="dock"><div class="dock-inner">
        ${open ? `<button class="btn" id="voteBtn" disabled>${prev ? "Actualizar voto" : "Votar"} ${icon("arrow")}</button>`
               : `<div class="closed tag">La votación está cerrada.</div>`}
      </div></div>
    </section>`;

  document.getElementById("backBtn").addEventListener("click", () => go("/"));
  const grades = [...document.querySelectorAll(".grade")];
  const chips = [...document.querySelectorAll(".chip")];
  const $verdict = document.getElementById("verdict");
  const voteBtn = document.getElementById("voteBtn");
  const $comment = document.getElementById("comment");
  const commentVal = () => $comment.value.replace(/\s+/g, " ").trim();

  const dirty = () => grade && (!prev || prev.stars !== grade || [...tags].sort().join() !== [...(prev.tags || [])].sort().join() || commentVal() !== (prev.comment || ""));
  const paint = () => {
    grades.forEach((b, i) => {
      const n = i + 1;
      b.classList.toggle("sel", n === grade);
      b.classList.toggle("lit", grade && n < grade);
      b.setAttribute("aria-checked", String(n === grade));
    });
    $verdict.classList.toggle("empty", !grade);
    $verdict.querySelector("b").textContent = grade || "";
    $verdict.querySelector("span").textContent = grade ? VERDICT[grade] : "Deja una recomendación";
    chips.forEach((ch) => ch.setAttribute("aria-pressed", String(tags.has(ch.dataset.tag))));
    if (voteBtn) voteBtn.disabled = !dirty();
  };
  paint();

  grades.forEach((b) => b.addEventListener("click", () => {
    grade = Number(b.dataset.n);
    b.classList.remove("sel"); void b.offsetWidth;
    if (navigator.vibrate) navigator.vibrate(12);
    paint();
  }));
  chips.forEach((ch) => ch.addEventListener("click", () => {
    const k = ch.dataset.tag;
    if (tags.has(k)) tags.delete(k);
    else if (tags.size < 2) tags.add(k);
    else { toast("Máximo 2."); return; }
    paint();
  }));
  $comment.addEventListener("input", paint);

  voteBtn?.addEventListener("click", async () => {
    voteBtn.classList.add("is-loading"); voteBtn.disabled = true;
    voteBtn.querySelector("use").setAttribute("href", "#i-load");
    try {
      const before = votedCount();
      const data = await api("/api/vote", { method: "POST", body: { standId: s.id, stars: grade, tags: [...tags], comment: commentVal() } });
      state.votes = data.votes;
      if (data.prizes) state.myPrizes = data.prizes;
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
      renderDone(idx, grade, !!prev, before);
    } catch (e) {
      toast(e.message);
      if (e.status === 401) return logout();
      voteBtn.classList.remove("is-loading"); voteBtn.disabled = false;
      voteBtn.querySelector("use").setAttribute("href", "#i-arrow");
    }
  });
}

function renderDone(idx, grade, wasUpdate, before) {
  window.scrollTo({ top: 0 });
  const n = votedCount();
  // Premios que se desbloquearon con este voto.
  const unlocked = state.myPrizes.filter((z) => z.unlocked && z.at > before && z.at <= n);
  const nx = nextPrize(n);
  const next = state.stands.map((s, i) => [s, i]).find(([s]) => !state.votes[s.id]);
  const main = unlocked[0];
  $app.innerHTML = `
    <section class="view" style="${main ? prizeStyleAttr(main.key) : accentStyle(idx)}">
      <div class="wrap grow"><div class="done ${main ? "unlocked" : ""}">
        <div class="row-between tag"><span>Stand ${pad(idx + 1)}</span><span>Nota ${grade}/5</span></div>
        ${main ? `
          <div class="tag ul-kick">● Nivel ${pad(main.at)} desbloqueado</div>
          <h1 class="done-t ul">Desblo<br>queaste</h1>
          <div class="ul-prizes">${unlocked.map((z) => `<div class="ul-p" style="${prizeStyleAttr(z.key)}"><img src="${prizeStyle(z.key).img}" alt=""><span class="ul-name">${esc(z.name)}</span></div>`).join("")}</div>`
        : `<div class="plus" aria-hidden="true">${wasUpdate ? "↻" : "+1"}</div><h1 class="done-t">${wasUpdate ? "Voto<br>actualizado." : "Voto<br>sembrado."}</h1>`}
        <div style="margin-top:26px">${counterBlock(n, goal(), "var(--acc)")}</div>
        <div class="tag hint">${nx ? `Próximo: ${esc(nx.name)} en ${pad(nx.at - n)} stands` : "Cosecha completa."}</div>
      </div></div>
      <div class="dock"><div class="dock-inner actions">
        ${main ? `<button class="btn" id="goVale" style="${prizeStyleAttr(main.key)}">Ver mi vale ${icon("arrow")}</button>` : ""}
        ${next ? `<button class="btn ${main ? "line" : ""}" id="goNext" style="${accentStyle(next[1])}">Stand ${pad(next[1] + 1)} ${icon("arrow")}</button>` : ""}
        ${main ? "" : `<button class="btn line" id="scanNext">Escanear QR ${icon("scan")}</button>`}
        <button class="link-btn" id="goHome">Ver mi cosecha →</button>
      </div></div>
    </section>`;
  document.getElementById("goVale")?.addEventListener("click", () => go(`/?v=vale&p=${main.key}`));
  document.getElementById("goNext")?.addEventListener("click", () => go(`/?stand=${encodeURIComponent(next[0].id)}`));
  document.getElementById("scanNext")?.addEventListener("click", openScanner);
  document.getElementById("goHome").addEventListener("click", () => go("/"));
}

// ---------- Vale: se muestra en el puesto; el staff lo marca desde /staff ----------
let valeTimer = null;
async function renderVale(key) {
  clearInterval(valeTimer);
  $app.innerHTML = `<section class="view"><div class="skel" style="height:70vh"></div></section>`;
  try { await Promise.all([loadStands(), loadMe()]); } catch (e) { toast(e.message); return; }
  if (!state.session) return route();
  const z = state.myPrizes.find((p) => p.key === key);
  if (!z || !z.unlocked) { toast(z ? `Te faltan ${z.missing} stands para ${z.name}.` : "Ese premio no existe."); return go("/", { replace: true }); }
  const st = prizeStyle(z.key);
  const paintStatus = (claimed, at) => {
    const el = document.getElementById("valeStatus");
    if (!el) return;
    el.className = `vale-status ${claimed ? "done" : ""}`;
    el.innerHTML = claimed
      ? `<b>✓ Canjeado</b><span class="tag">${hhmm(at)} · ¡Disfrútalo!</span>`
      : `<b><i class="blink"></i>Muéstralo en el puesto</b><span class="tag">El staff lo marca como entregado</span>`;
  };
  $app.innerHTML = `
    <section class="view vale" style="${prizeStyleAttr(z.key)}">
      <div class="wrap grow vale-in">
        <div class="row-between tag vale-row"><span>Vale · nivel ${pad(z.at)} stands</span><span>Semilla Lab</span></div>
        <h1 class="vale-name">${esc(z.name)}</h1>
        <img class="vale-img" src="${st.img}" alt="">
        <div class="vale-who"><span class="tag">Para</span><b>${esc(state.session.name)}</b><span class="tag">${esc(st.unit)} · cel ${esc(state.session.phone.slice(-3).padStart(9, "•"))}</span></div>
        <div id="valeStatus"></div>
      </div>
      <div class="dock"><div class="dock-inner"><button class="btn line" id="valeBack">${icon("back")} Mi cosecha</button></div></div>
    </section>`;
  paintStatus(z.claimed, z.claimedAt);
  document.getElementById("valeBack").addEventListener("click", () => { clearInterval(valeTimer); go("/"); });
  if (z.claimed) return;
  // Mientras el vale está abierto, se actualiza solo cuando el staff lo marca.
  valeTimer = setInterval(async () => {
    const p = new URLSearchParams(location.search);
    if (p.get("v") !== "vale" || p.get("p") !== key) return clearInterval(valeTimer);
    try {
      await loadMe();
      const now = state.myPrizes.find((q) => q.key === key);
      if (now?.claimed) {
        clearInterval(valeTimer);
        if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
        paintStatus(true, now.claimedAt);
        document.getElementById("valeStatus")?.classList.add("pop");
      }
    } catch {}
  }, 8000);
}

// ---------- Escáner QR ----------
let scanStream = null;
async function openScanner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Usa la cámara de tu celular para escanear el QR.");
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "scanner";
  overlay.innerHTML = `
    <div class="row-between tag"><span>Escáner QR</span><span>Cámara ● on</span></div>
    <div class="cam"><video playsinline muted></video><i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i><div class="laser"></div></div>
    <div class="scan-t">Apunta<br>al QR.</div>
    <button class="btn line" id="closeScan">Cerrar</button>`;
  document.body.appendChild(overlay);
  const video = overlay.querySelector("video");
  const close = () => {
    scanStream?.getTracks().forEach((t) => t.stop());
    scanStream = null; overlay.remove();
  };
  overlay.querySelector("#closeScan").addEventListener("click", close);

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  } catch {
    close();
    toast("No pudimos abrir la cámara. Toca el stand en la lista.");
    return;
  }
  video.srcObject = scanStream;
  await video.play().catch(() => {});

  const detector = "BarcodeDetector" in window ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const handle = (text) => {
    let id = null;
    try { id = new URL(text, location.origin).searchParams.get("stand"); } catch {}
    if (!id) { toast("Ese QR no es de un stand de Semilla Lab."); return false; }
    if (navigator.vibrate) navigator.vibrate(30);
    close();
    go(`/?stand=${encodeURIComponent(id)}`, { splash: true });
    return true;
  };

  let lastBad = 0;
  const tick = async () => {
    if (!scanStream) return;
    if (video.readyState >= 2) {
      let text = null;
      try {
        if (detector) {
          const codes = await detector.detect(video);
          text = codes[0]?.rawValue || null;
        } else if (window.jsQR) {
          const w = (canvas.width = Math.min(640, video.videoWidth));
          const h = (canvas.height = Math.round((video.videoHeight / video.videoWidth) * w));
          ctx.drawImage(video, 0, 0, w, h);
          text = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data || null;
        }
      } catch {}
      if (text && Date.now() - lastBad > 2000) {
        if (handle(text)) return;
        lastBad = Date.now();
      }
    }
    requestAnimationFrame(tick);
  };
  tick();
}

// Entrar por un link/QR con ?stand= muestra la entrada de 3 s.
route({ splash: new URLSearchParams(location.search).has("stand") });
