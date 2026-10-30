// Canje de premios para el staff de los puestos (canchita, gaseosa, helado, pancho).
import { prizeStyle } from "/palette.js";

const $root = document.getElementById("staff");
const $top = document.getElementById("topRight");
const $toast = document.getElementById("toast");
const SS_PIN = "semilla.staffPin";
const LS_BOOTH = "semilla.booth";

const st = {
  pin: sessionStorage.getItem(SS_PIN) || "",
  role: null,
  prizes: [],
  people: [],
  total: 0,
  q: "",
  booth: (() => { try { return localStorage.getItem(LS_BOOTH) || ""; } catch { return ""; } })(),
  modal: false,
  seq: 0,
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad = (n) => String(n).padStart(2, "0");
const hhmm = (iso) => { try { return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false }); } catch { return ""; } };
const sAttr = (key) => { const s = prizeStyle(key); return `--acc:${s.hex};--acc-fg:${s.fg};--acc-ink:${s.ink}`; };
let tt;
const toast = (m) => { $toast.textContent = m; $toast.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => $toast.classList.remove("show"), 2600); };
const arrow = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 12h15M13 5l7 7-7 7"/></svg>`;

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method, headers: { "content-type": "application/json", "x-staff-pin": st.pin }, body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  if (!res) throw Object.assign(new Error("Sin conexión"), { status: 0 });
  if (!(res.headers.get("content-type") || "").includes("application/json") && res.status >= 400)
    throw Object.assign(new Error("Red saturada: espera unos segundos y reintenta"), { status: res.status });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Error"), { status: res.status, data });
  return data;
}

function renderTop() {
  $top.innerHTML = st.role
    ? `<span class="user-pill"><i></i>${st.role === "admin" ? "Admin" : "Staff"}<button type="button" id="out">Salir</button></span>` : "";
  document.getElementById("out")?.addEventListener("click", () => { sessionStorage.removeItem(SS_PIN); location.reload(); });
}

function renderLogin(err = "") {
  $root.innerHTML = `
    <section class="wrap"><form class="form" id="pinForm">
      <div class="tag">Puesto de canje</div>
      <h1 class="form-title">Entrega<br>de premios.</h1>
      ${err ? `<p class="form-error show">× ${esc(err)}</p>` : ""}
      <div class="field"><label for="pin">PIN de staff</label><div class="input"><input type="password" id="pin" autocomplete="current-password" required></div></div>
      <button class="btn" type="submit" >Entrar ${arrow}</button>
    </form></section>`;
  document.getElementById("pin").focus();
  document.getElementById("pinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    st.pin = document.getElementById("pin").value.trim();
    try { await search(); sessionStorage.setItem(SS_PIN, st.pin); renderShell(); paintList(); }
    catch (er) { renderLogin(er.status === 401 ? "PIN incorrecto" : er.message); }
  });
}

async function search() {
  const seq = ++st.seq;
  const p = new URLSearchParams({ action: "search", q: st.q, prize: st.booth });
  const data = await api(`/api/staff?${p}`);
  if (seq !== st.seq) return false; // llegó una búsqueda más nueva
  st.role = data.role; st.prizes = data.prizes; st.people = data.people; st.total = data.total;
  return true;
}

function renderShell() {
  renderTop();
  $root.innerHTML = `
    <section class="wrap staff">
      <div class="tag" style="margin-bottom:8px">Mi puesto</div>
      <div class="booth" id="booth">
        <button data-k="" aria-pressed="${!st.booth}">Todos</button>
        ${st.prizes.map((p) => `<button data-k="${p.key}" style="${sAttr(p.key)}" aria-pressed="${st.booth === p.key}"><img src="${prizeStyle(p.key).img}" alt="">${esc(p.name)}</button>`).join("")}
      </div>
      <div class="search">
        <div class="input"><input id="q" type="search" placeholder="Buscar nombre o últimos dígitos del cel" autocomplete="off" value="${esc(st.q)}"></div>
      </div>
      <div class="meta tag"><span id="metaL"></span><span id="metaR"></span></div>
      <div class="people" id="people"></div>
    </section>`;
  document.querySelectorAll("#booth button").forEach((b) => b.addEventListener("click", async () => {
    st.booth = b.dataset.k;
    try { localStorage.setItem(LS_BOOTH, st.booth); } catch {}
    document.querySelectorAll("#booth button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    await refresh();
  }));
  let deb;
  document.getElementById("q").addEventListener("input", (e) => {
    st.q = e.target.value;
    clearTimeout(deb);
    deb = setTimeout(refresh, 280);
  });
}

async function refresh() {
  try { if (await search()) paintList(); } catch (e) { toast(e.message); }
}

function boothPrize() { return st.prizes.find((p) => p.key === st.booth) || null; }

function personCard(p) {
  const bp = boothPrize();
  const z = bp ? p.prizes.find((x) => x.key === bp.key) : null;
  let primary = "";
  if (z) {
    primary = z.claimed
      ? `<div class="done-msg"><span>✓ Ya recibió ${esc(z.name)}</span><span class="tag">${hhmm(z.claimedAt)}</span></div>`
      : z.unlocked
        ? `<button class="btn" data-claim="${z.key}" style="${sAttr(z.key)}">Entregar ${esc(z.name)} ${arrow}</button>`
        : `<div class="lock-msg tag">Aún no: le faltan ${pad(z.missing)} stands para ${esc(z.name)}</div>`;
  }
  const pills = p.prizes.map((x) => {
    const cls = x.claimed ? "claimed" : x.unlocked ? "ready" : "locked";
    const label = x.claimed ? `✓ ${hhmm(x.claimedAt)}` : x.unlocked ? "Entregar" : `${pad(x.at)}`;
    return `<button class="pill ${cls} ${bp?.key === x.key ? "focus" : ""}" style="${sAttr(x.key)}" data-pill="${x.key}"><img src="${prizeStyle(x.key).img}" alt=""><span>${esc(x.name)}</span><span>${label}</span></button>`;
  }).join("");
  return `<article class="person" data-id="${p.id || p.phone}">
    <h3>${esc(p.name)}</h3>
    <div class="sub tag">Cel ${esc(p.phoneMasked)} · ${pad(p.count)} stands votados</div>
    ${primary ? `<div class="primary">${primary}</div>` : ""}
    <div class="pills">${pills}</div>
  </article>`;
}

function paintList() {
  const $p = document.getElementById("people");
  if (!$p) return;
  const bp = boothPrize();
  document.getElementById("metaL").textContent = st.q ? `${st.people.length} resultado${st.people.length === 1 ? "" : "s"}` : `${st.people.length} por canjear${bp ? ` · ${bp.name}` : ""}`;
  document.getElementById("metaR").textContent = `${st.total} registrados`;
  $p.innerHTML = st.people.length ? st.people.map(personCard).join("")
    : `<div class="empty-s tag">${st.q ? "Nadie con ese nombre o celular." : "Nadie pendiente por ahora. Busca por nombre."}</div>`;
  $p.querySelectorAll(".person").forEach((el) => {
    const person = st.people.find((x) => (x.id || x.phone) === el.dataset.id);
    el.querySelectorAll("[data-claim], .pill").forEach((b) => b.addEventListener("click", () => {
      const key = b.dataset.claim || b.dataset.pill;
      const z = person.prizes.find((x) => x.key === key);
      if (z.claimed) return alreadyModal(person, z);
      if (!z.unlocked) return toast(`${person.name} aún no desbloquea ${z.name}: le faltan ${z.missing} stands.`);
      confirmModal(person, z);
    }));
  });
}

function modal(html, cls = "", style = "") {
  st.modal = true;
  const el = document.createElement("div");
  el.className = "modal";
  el.innerHTML = `<div class="sheet ${cls}" style="${style}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); st.modal = false; };
  el.addEventListener("click", (e) => { if (e.target === el) close(); });
  return { el, close };
}

function confirmModal(person, z) {
  const m = modal(`
    <img src="${prizeStyle(z.key).img}" alt="">
    <div class="tag">Confirmar entrega</div>
    <h2>${esc(z.name)}</h2>
    <p class="tag">Para <b>${esc(person.name)}</b><br>Cel ${esc(person.phoneMasked)}</p>
    <div class="actions">
      <button class="btn" id="ok" style="${sAttr(z.key)}">Sí, entregado ${arrow}</button>
      <button class="btn line" id="no">Cancelar</button>
    </div>`, "", sAttr(z.key));
  m.el.querySelector("#no").addEventListener("click", m.close);
  m.el.querySelector("#ok").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try {
      const r = await api("/api/staff?action=claim", { method: "POST", body: { id: person.id || person.phone, prize: z.key } });
      m.close();
      if (navigator.vibrate) navigator.vibrate(30);
      replacePerson(r.person);
      okModal(r.person, z);
    } catch (er) {
      m.close();
      if (er.data?.alreadyClaimed) { replacePerson(er.data.person); return alreadyModal(er.data.person, { ...z, claimedAt: er.data.claimedAt }); }
      toast(er.message);
    }
  });
}

function okModal(person, z) {
  const m = modal(`
    <img src="${prizeStyle(z.key).img}" alt="">
    <div class="tag">Registrado</div>
    <h2>✓ ${esc(z.name)}<br>entregado</h2>
    <p class="tag">${esc(person.name)} · ${hhmm(new Date().toISOString())}</p>
    <div class="actions"><button class="btn" id="ok" >Listo ${arrow}</button></div>`, "ok", "--acc:var(--cs-green)");
  m.el.querySelector("#ok").addEventListener("click", () => { m.close(); refresh(); });
  setTimeout(() => { if (document.body.contains(m.el)) { m.close(); refresh(); } }, 2500);
}

function alreadyModal(person, z) {
  if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
  const admin = st.role === "admin";
  const m = modal(`
    <img src="${prizeStyle(z.key).img}" alt="" style="filter:grayscale(1);opacity:.5">
    <div class="tag">Atención</div>
    <h2>Ya canjeó<br>${esc(z.name)}</h2>
    <p class="tag"><b>${esc(person.name)}</b> lo recibió a las <b>${hhmm(z.claimedAt)}</b>.<br>Cada premio se entrega una sola vez.</p>
    <div class="actions">
      <button class="btn" id="ok">Entendido ${arrow}</button>
      ${admin ? `<button class="btn line" id="undo">Deshacer canje (admin)</button>` : ""}
    </div>`, "warn");
  m.el.querySelector("#ok").addEventListener("click", m.close);
  m.el.querySelector("#undo")?.addEventListener("click", async () => {
    if (!confirm(`¿Deshacer el canje de ${z.name} de ${person.name}?`)) return;
    try {
      const r = await api("/api/staff?action=unclaim", { method: "POST", body: { id: person.id || person.phone, prize: z.key } });
      replacePerson(r.person); m.close(); toast("Canje deshecho"); paintList();
    } catch (er) { toast(er.message); }
  });
}

function replacePerson(p) {
  if (!p) return;
  const id = p.id || p.phone;
  const i = st.people.findIndex((x) => (x.id || x.phone) === id);
  if (i >= 0) st.people[i] = { ...st.people[i], ...p };
  paintList();
}

// Se actualiza sola cada 30 s (si no hay un diálogo abierto).
setInterval(() => { if (st.role && !st.modal && document.visibilityState === "visible") refresh(); }, 30000);

(async () => {
  if (!st.pin) return renderLogin();
  try { await search(); renderShell(); paintList(); } catch { sessionStorage.removeItem(SS_PIN); renderLogin(); }
})();
