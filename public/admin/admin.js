// Panel de administración Semilla Lab v2
import { accentStyle, colorAt, TAGS } from "/palette.js";

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

async function api(action, { method = "GET", body } = {}) {
  const res = await fetch(`/api/admin?action=${action}`, {
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
      <div class="tag">[ Panel del evento ]</div>
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

async function refresh() { st.data = await api("summary"); }
const standIdx = (id) => st.data.stands.findIndex((s) => s.id === id);

const TABS = [["resumen", "Resultados"], ["stands", "Stands"], ["qr", "Códigos QR"], ["sorteo", "Sorteo"]];

function render() {
  $root.innerHTML = `
    <div class="wrap admin">
      <nav class="anav" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-t="${k}" aria-selected="${st.tab === k}">${l}</button>`).join("")}</nav>
      <div id="tab"></div>
    </div>`;
  $root.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => { st.tab = b.dataset.t; render(); }));
  clearInterval(st.poll);
  ({ resumen: tabResumen, stands: tabStands, qr: tabQr, sorteo: tabSorteo })[st.tab]();
}

function topTags(tags = {}) {
  return Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, n]) => `<span>${esc(TAG_LABEL[k] || k)} · ${n}</span>`).join("");
}

function rankList(ranking, minVotes) {
  return `<ol class="rank">${ranking.map((r, i) => {
    const ranked = r.count >= minVotes;
    const si = standIdx(r.id);
    return `<li class="${ranked ? "" : "muted"}" style="${accentStyle(si)};--i:${i}">
      <span class="n">${pad(si + 1)}</span>
      <div><h3>${esc(r.name)}</h3><div class="meta tag">#${i + 1} · ${esc(r.team)} · ${r.count} voto${r.count === 1 ? "" : "s"}${ranked ? "" : ` · mín. ${minVotes}`}</div>
        <div class="bar"><i style="width:${(r.avg / 5) * 100}%"></i></div>
        ${r.tags && Object.keys(r.tags).length ? `<div class="tags">${topTags(r.tags)}</div>` : ""}</div>
      <div class="score">${r.avg ? r.avg.toFixed(2) : "–"}<small>promedio</small></div>
    </li>`;
  }).join("")}</ol>`;
}

function statsHtml(d) {
  return `<div class="stats">
    <div class="stat"><span class="tag">Registrados</span><b>${d.stats.registered}</b></div>
    <div class="stat"><span class="tag">Ya votaron</span><b>${d.stats.voters}</b></div>
    <div class="stat"><span class="tag">Votos</span><b>${d.stats.votes}</b></div>
    <div class="stat sun"><span class="tag">En sorteo (≥${d.config.minForRaffle})</span><b>${d.stats.eligible}</b></div>
  </div>`;
}

function tabResumen() {
  const $t = document.getElementById("tab");
  const paint = () => {
    const d = st.data;
    $t.innerHTML = `
      ${statsHtml(d)}
      <div class="toolbar">
        <button class="btn sm ${d.config.votingOpen ? "line" : ""}" id="toggleVote">${d.config.votingOpen ? "Cerrar votación" : "Abrir votación"}</button>
        <button class="btn sm line" id="live">Proyectar</button>
        <button class="btn sm line" id="csv">Exportar CSV</button>
        <span class="tag dim">● ${d.config.votingOpen ? "Abierta" : "Cerrada"} · se actualiza cada 15 s</span>
      </div>
      <div class="sec tag"><span>[ Ranking del público ]</span><span class="dim">Promedio · desempate por votos</span></div>
      ${d.ranking.length ? rankList(d.ranking, d.minVotesToRank) : `<p class="empty tag">Sin stands.</p>`}`;
    document.getElementById("toggleVote").addEventListener("click", async () => {
      const open = !st.data.config.votingOpen;
      if (!confirm(open ? "¿Abrir la votación?" : "¿Cerrar la votación? Nadie podrá votar ni cambiar su voto.")) return;
      await api("config", { method: "POST", body: { votingOpen: open } });
      await refresh(); paint(); toast(open ? "Votación abierta" : "Votación cerrada");
    });
    document.getElementById("csv").addEventListener("click", async () => {
      const blob = await api("export");
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "semilla-lab-votos.csv" });
      a.click(); URL.revokeObjectURL(a.href);
    });
    document.getElementById("live").addEventListener("click", openLive);
  };
  paint();
  st.poll = setInterval(async () => { try { await refresh(); if (st.tab === "resumen" && !document.querySelector(".live")) paint(); } catch {} }, 15000);
}

function openLive() {
  const el = document.createElement("div");
  el.className = "live";
  const paint = () => {
    const d = st.data;
    el.innerHTML = `
      <div class="row-between tag" style="padding-bottom:14px;border-bottom:var(--b)"><span>[ Voto del público ] ● En vivo</span><img src="/assets/camposol-green.png" alt="Camposol" height="24" style="height:24px"></div>
      ${phrase}
      ${statsHtml(d)}
      ${rankList(d.ranking, d.minVotesToRank)}`;
  };
  paint();
  const close = Object.assign(document.createElement("button"), { className: "btn sm line live-close", textContent: "Salir" });
  document.body.append(el, close);
  el.requestFullscreen?.().catch(() => {});
  const iv = setInterval(async () => { try { await refresh(); paint(); } catch {} }, 10000);
  close.addEventListener("click", () => { clearInterval(iv); el.remove(); close.remove(); document.fullscreenElement && document.exitFullscreen(); render(); });
}

function tabStands() {
  let stands = st.data.stands.map((s) => ({ ...s }));
  const $t = document.getElementById("tab");
  const paint = () => {
    $t.innerHTML = `
      <div class="sec tag"><span>[ Stands ]</span><span class="dim">El orden define número y color</span></div>
      <div id="rows">${stands.map((s, i) => `
        <div class="editor-row" data-i="${i}" style="${accentStyle(i)}">
          <span class="n">${pad(i + 1)}</span>
          <div class="fields">
            <input data-k="name" value="${esc(s.name)}" placeholder="Nombre de la idea">
            <input data-k="team" value="${esc(s.team)}" placeholder="Equipo / área">
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

function qrSvg(text) {
  const qr = window.qrcode(0, "M");
  qr.addData(text); qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}

function tabQr() {
  const $t = document.getElementById("tab");
  const base = location.origin;
  $t.innerHTML = `
    <div class="toolbar no-print"><button class="btn sm" id="print">Imprimir QRs</button>
      <span class="tag dim">Cada QR → ${esc(base)}/?stand=… → entrada 3 s → votar</span></div>
    <div class="qr-sheet">
      <div class="qr-card" style="--acc:var(--ink);--acc-fg:#fff">
        <div class="qh"><span class="tag">Ingreso</span><b>SL</b></div>
        <div class="qr">${qrSvg(base + "/")}</div>
        <h3>Semilla Lab</h3><div class="foot tag dim">Registro en la entrada</div>
      </div>
      ${st.data.stands.map((s, i) => `
      <div class="qr-card" style="${accentStyle(i)}">
        <div class="qh"><span class="tag">Stand</span><b>${pad(i + 1)}</b></div>
        <div class="qr">${qrSvg(`${base}/?stand=${encodeURIComponent(s.id)}`)}</div>
        <h3>${esc(s.name)}</h3><div class="foot tag dim">Escanea · vota · cosecha</div>
      </div>`).join("")}
    </div>`;
  document.getElementById("print").addEventListener("click", () => window.print());
}

function tabSorteo() {
  const $t = document.getElementById("tab");
  const paint = () => {
    const d = st.data;
    $t.innerHTML = `
      <div class="cols">
        <div class="stage">
          <div class="stripes" aria-hidden="true"></div>
          <div class="tag">[ Sorteo del público · ${d.stats.eligible} participantes ]</div>
          <div class="raffle-name" id="rName">${d.stats.eligible ? `${d.stats.eligible}<br>en juego` : "Sin<br>participantes"}</div>
          <div class="tag" id="rSub">Participan quienes votaron ${d.config.minForRaffle}+ stands</div>
          <div style="max-width:320px;margin-top:26px"><button class="btn" id="draw" style="--acc:var(--sun)" ${d.stats.eligible ? "" : "disabled"}>${d.raffle.winners.length ? "Sortear otro" : "Sortear"} ${arrow}</button></div>
        </div>
        <div>
          <div class="sec tag" style="margin-top:0"><span>[ Ganadores ]</span></div>
          ${d.raffle.winners.length ? `<ul class="winners">${d.raffle.winners.map((w, i) => `<li class="tag"><span>${pad(i + 1)} ${esc(w.name)}</span><span>${esc(w.phone)}</span></li>`).join("")}</ul>
            <div style="margin-top:14px"><button class="btn sm line" id="reset">Reiniciar sorteo</button></div>` : `<p class="tag dim">Todavía no hay ganadores.</p>`}
          <div class="sec tag"><span>[ Elegibles · ${d.eligible.length} ]</span></div>
          <ul class="winners" style="max-height:340px;overflow:auto">${d.eligible.map((e) => `<li class="tag"><span>${esc(e.name)}</span><span class="dim">${e.count} stands</span></li>`).join("") || `<li class="tag dim">Nadie aún.</li>`}</ul>
        </div>
      </div>`;
    document.getElementById("draw")?.addEventListener("click", draw);
    document.getElementById("reset")?.addEventListener("click", async () => {
      if (!confirm("¿Borrar la lista de ganadores?")) return;
      await api("resetRaffle", { method: "POST" }); await refresh(); paint();
    });
  };

  async function draw(e) {
    const btn = e.currentTarget; btn.disabled = true;
    const $n = document.getElementById("rName"), $s = document.getElementById("rSub");
    $n.classList.remove("final");
    let result;
    try { result = await api("draw", { method: "POST" }); }
    catch (er) { toast(er.message); btn.disabled = false; return; }
    const pool = result.pool.length ? result.pool : [result.winner.name];
    $s.textContent = "Sorteando…";
    let delay = 45, i = 0;
    const spin = () => {
      $n.textContent = pool[i++ % pool.length];
      delay *= 1.09;
      if (delay < 420) setTimeout(spin, delay);
      else {
        setTimeout(async () => {
          await refresh(); paint();
          const n = document.getElementById("rName");
          n.textContent = result.winner.name; n.classList.add("final");
          document.getElementById("rSub").textContent = `Cel ${result.winner.phoneMasked}`;
        }, 300);
      }
    };
    spin();
  }
  paint();
}

(async () => {
  if (!st.pin) return renderLogin();
  try { await refresh(); render(); } catch { sessionStorage.removeItem(SS_PIN); renderLogin(); }
})();
