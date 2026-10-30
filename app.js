// AskBo AI Mode: a full-page Bo chat driven by Ada's headless Embed SDK (embed2.js).
//
// The conversation is opened the moment the page loads, before the customer does anything, so
// the slow part (SDK boot + chatter + welcome) is over by the time they ask. Only sendMessage()
// and getMessages() / ada:message:received are used to talk to Bo.
import { HANDLE, HERO, POPULAR, SERVICES, TOPICS, LINKS } from "./content.js?v=20261030b";

const $ = (s) => document.querySelector(s);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const race = (p, ms, label) => Promise.race([p, delay(ms).then(() => { throw new Error(`${label} timed out`); })]);
const params = new URLSearchParams(location.search);
const DEBUG = params.has("debug");

// Sent once to create the conversation. After a reset() Ada creates the chatter lazily on the first
// send and drops that message, so a throwaway opener has to go first. Its reply is the welcome,
// which is never shown: the thread starts at the customer's own first question.
const OPENER = "Hi";
const WELCOME_QUIET_MS = 2500, WELCOME_MAX_MS = 20000;
const REPLY_QUIET_MS = 4000, REPLY_MAX_MS = 90000;
const MIN_SEND_GAP_MS = 4000;          // Ada rate-limits sends that land ~3s apart

const trace = [];
function log(...a) { trace.push([((performance.now()) / 1000).toFixed(1), ...a]); if (DEBUG) console.log("[askbo]", ...a); }
window.__askbo = { trace, get state() { return state; } };

const state = {
  sdk: false,            // adaReadyCallback fired
  ready: false,          // conversation open and the welcome has settled: safe to send
  live: false,           // the customer's first real question has been sent (or restored)
  seen: new Set(),       // message ids already handled
  pending: [],           // local user bubbles waiting for Ada's copy of the message
  queue: [],             // questions asked before the conversation was ready
  sending: false, lastSendAt: 0,
  awaiting: false, lastBotAt: 0, awaitStart: 0, bodylessNoted: false,
  booting: null,
};

/* ---------------- static content ---------------- */
const ICON_EXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14zM5 5h6v2H5v12h12v-6h2v8H3V5z"/></svg>';
const ICON_CHAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16v12H7l-3 3z"/></svg>';
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

$("#hero-title").textContent = HERO.title;
$("#hero-lead").textContent = HERO.lead;
for (const [id, url] of [["#aa-logo", LINKS.home], ["#nav-home", LINKS.home], ["#nav-cases", LINKS.myCases], ["#lnk-cases", LINKS.myCases], ["#lnk-aa", LINKS.airasia], ["#lnk-terms", LINKS.terms]]) {
  const a = $(id); a.href = url; a.target = "_blank"; a.rel = "noopener";
}

// Popular articles: ask Bo with the title, or open the article.
$("#cards").innerHTML = POPULAR.map((o, i) => `
  <div class="ab-card">
    ${o.ask ? `<button class="go" type="button" data-ask="${i}" data-src="popular">${esc(o.title)}<small>Ask Bo</small></button>`
            : `<a class="go" href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.title)}</a>`}
    <a class="ext" href="${esc(o.url)}" target="_blank" rel="noopener" aria-label="Open the article: ${esc(o.title)}" title="Open the article">${ICON_EXT}</a>
  </div>`).join("");

function tilesHTML() {
  return SERVICES.map((o, i) => o.ask
    ? `<button class="ab-tile ask" type="button" data-ask="${i}" data-src="services" title="Ask Bo about ${esc(o.title)}">
         <span class="badge" aria-hidden="true">${ICON_CHAT}</span>
         <img src="assets/icons/${esc(o.icon)}" alt="">${esc(o.title)}</button>`
    : `<a class="ab-tile link" href="${esc(o.url)}" target="_blank" rel="noopener" title="Open the ${esc(o.title)} page">
         <span class="badge" aria-hidden="true">${ICON_EXT}</span>
         <img src="assets/icons/${esc(o.icon)}" alt="">${esc(o.title)}</a>`).join("");
}
$("#hero-tiles").innerHTML = tilesHTML();
$("#panel-tiles").innerHTML = tilesHTML();
$("#panel-topics").innerHTML = TOPICS.map((o, i) => o.ask
  ? `<button class="ab-chip" type="button" data-ask="${i}" data-src="topics">${esc(o.title)}</button>`
  : `<a class="ab-chip link" href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.title)} ${ICON_EXT}</a>`).join("");
// The header Topics menu follows the same rule: knowledge-backed topics go to Bo, the rest open the page.
$("#topics-menu").innerHTML = TOPICS.map((o, i) => o.ask
  ? `<button type="button" data-ask="${i}" data-src="topics">${esc(o.title)}</button>`
  : `<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.title)} ${ICON_EXT}</a>`).join("");

const SOURCES = { popular: POPULAR, services: SERVICES, topics: TOPICS };
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-ask]");
  if (!b) return;
  const o = SOURCES[b.dataset.src][+b.dataset.ask];
  closePanel();
  topicsMenu.hidden = true; topicsBtn.setAttribute("aria-expanded", "false");
  ask(o.title);
});

/* ---------------- header chrome ---------------- */
const topicsBtn = $("#topics-btn"), topicsMenu = $("#topics-menu");
topicsBtn.addEventListener("click", () => { const open = topicsMenu.hidden; topicsMenu.hidden = !open; topicsBtn.setAttribute("aria-expanded", String(open)); });
document.addEventListener("click", (e) => { if (!e.target.closest(".aa-dd")) { topicsMenu.hidden = true; topicsBtn.setAttribute("aria-expanded", "false"); } });
$("#aa-search").addEventListener("submit", (e) => { e.preventDefault(); const q = $("#aa-q").value.trim(); if (q) window.open(LINKS.search(q), "_blank", "noopener"); });

/* ---------------- panel ---------------- */
function openPanel() { document.body.classList.add("panel-open"); $("#panel").setAttribute("aria-hidden", "false"); $("#close-panel").focus(); }
function closePanel() { document.body.classList.remove("panel-open"); $("#panel").setAttribute("aria-hidden", "true"); }
$("#open-panel").addEventListener("click", openPanel);
$("#close-panel").addEventListener("click", closePanel);
$("#scrim").addEventListener("click", closePanel);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closePanel(); topicsMenu.hidden = true; } });

/* ---------------- status / toast ---------------- */
function setStatus(text, cls) { $("#status").className = "ab-status " + (cls || ""); $("#status-text").textContent = text; }
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2800); }

/* ---------------- thread rendering ---------------- */
const thread = $("#thread"), hero = $("#hero"), scroller = $("#scroll");
function showThread() { if (thread.hidden) { thread.hidden = false; hero.hidden = true; } }
function scrollDown() { requestAnimationFrame(() => { scroller.scrollTop = scroller.scrollHeight; }); }

function inline(s) {
  // s is already HTML-escaped. Links first, then bold / italic.
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,!?;:])/g, (_, p, u) => `${p}<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>");
  return s;
}
// Status words in a table cell become coloured pills (disruption tables: Suspend, Moved, …).
function statusPill(cellHTML) {
  const t = cellHTML.replace(/<[^>]+>/g, "").trim();
  if (/^(suspend|cancel|closed|not operating)/i.test(t)) return `<span class="pill bad">${cellHTML}</span>`;
  if (/^(moved|retime|delay|change|rerout|revised)/i.test(t)) return `<span class="pill warn">${cellHTML}</span>`;
  if (/^(on time|operating|normal|resumed|active)/i.test(t)) return `<span class="pill ok">${cellHTML}</span>`;
  return cellHTML;
}
const cells = (l) => l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
function table(rows) {
  const isSep = (l) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(l);
  const head = isSep(rows[1] || "") ? cells(rows[0]) : null;
  const body = rows.slice(head ? 2 : 0).filter((l) => !isSep(l)).map(cells);
  // data-label feeds the phone layout, where each row becomes a card of "label: value" lines.
  const td = (c, i) => `<td${head?.[i] ? ` data-label="${head[i].replace(/"/g, "&quot;")}"` : ""}${c.length > 40 ? ' class="long"' : ""}>${statusPill(inline(c))}</td>`;
  return `<div class="tbl${head ? " has-head" : ""}"><table>${head ? `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` : ""}<tbody>${
    body.map((r) => `<tr>${r.map(td).join("")}</tr>`).join("")}</tbody></table></div>${body.length > 6 ? `<p class="tbl-note">${body.length} rows</p>` : ""}`;
}
function md(text) {
  const lines = esc(text).replace(/\r/g, "").split("\n");
  let html = "", list = null, para = [], tbl = [];
  const flushPara = () => { if (para.length) { html += `<p>${para.map(inline).join("<br>")}</p>`; para = []; } };
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  const flushTbl = () => { if (tbl.length) { html += table(tbl); tbl = []; } };
  for (const raw of lines) {
    const l = raw.trim();
    let m;
    if (l.startsWith("|") && l.indexOf("|", 1) > 0) { flushPara(); closeList(); tbl.push(l); continue; }
    flushTbl();
    if (!l) { flushPara(); closeList(); continue; }
    if ((m = l.match(/^#{1,6}\s+(.*)$/))) { flushPara(); closeList(); html += `<h4>${inline(m[1])}</h4>`; continue; }
    if ((m = l.match(/^[-•*]\s+(.*)$/))) { flushPara(); if (list !== "ul") { closeList(); html += "<ul>"; list = "ul"; } html += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = l.match(/^\d+[.)]\s+(.*)$/))) { flushPara(); if (list !== "ol") { closeList(); html += "<ol>"; list = "ol"; } html += `<li>${inline(m[1])}</li>`; continue; }
    closeList(); para.push(l);
  }
  flushTbl(); flushPara(); closeList();
  return html;
}

let typingRow = null;
function setTyping(on) {
  if (on && !typingRow) {
    typingRow = document.createElement("div");
    typingRow.className = "row bot";
    typingRow.innerHTML = `<div class="av"><img src="assets/bo.png" alt=""></div><div class="bub" aria-label="Bo is typing"><div class="typing"><i></i><i></i><i></i></div></div>`;
    thread.append(typingRow); scrollDown();
  } else if (!on && typingRow) { typingRow.remove(); typingRow = null; }
}
function appendRow(el, toStart) { if (typingRow) thread.insertBefore(el, typingRow); else thread.append(el); toStart ? scrollToRow(el) : scrollDown(); }
// Long answers: bring the start of a new reply into view rather than its last line.
function scrollToRow(el) {
  requestAnimationFrame(() => { scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12; });
}

let lastBotRow = null;
function renderBot(body, role) {
  showThread();
  const row = document.createElement("div");
  row.className = `row bot${role === "agent" ? " agent" : ""}`;
  const before = typingRow ? typingRow.previousElementSibling : thread.lastElementChild;
  const prevIsBot = !!before && before === lastBotRow;
  row.innerHTML = `<div class="av${prevIsBot ? " ghost" : ""}"><img src="assets/bo.png" alt=""></div><div class="bub">${md(body)}</div>`;
  appendRow(row, true); lastBotRow = row;
  return row.querySelector(".bub");
}
function renderUser(body, pending) {
  showThread();
  const row = document.createElement("div");
  row.className = "row user" + (pending ? " pending" : "");
  const bub = document.createElement("div"); bub.className = "bub"; bub.textContent = body;
  row.append(bub); appendRow(row); lastBotRow = null;
  return row;
}
function renderSys(text, warn) {
  showThread();
  const d = document.createElement("div"); d.className = "sys" + (warn ? " warn" : ""); d.textContent = text;
  appendRow(d); lastBotRow = null;
}

/* ---------------- message intake (events + getMessages share this) ---------------- */
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
const keyOf = (m) => m.id || `${m.role}|${m.createdAt}|${m.body}`;

// Bot bubbles by message id. getMessages() returns a reply while it is still streaming ("I",
// then half an answer, then all of it) under one id, so a known id updates its bubble in place.
const botRows = new Map();

// User messages are drawn by ask(), never from Ada's copy: getMessages() lists a sent message
// first under the client id sendMessage() returned, then under the server id, so it would show twice.
function ingest(m) {
  if (!m) return;
  const role = m.role || "bot";
  if (role === "user") {
    const i = state.pending.findIndex((p) => norm(p.text) === norm(m.body));
    if (i >= 0) { state.pending[i].row.classList.remove("pending"); state.pending.splice(i, 1); }
    return;
  }
  const k = keyOf(m);
  const known = botRows.get(k);
  if (known) {
    if (m.body && m.body !== known.body) { known.body = m.body; known.bub.innerHTML = md(m.body); state.lastBotAt = Date.now(); }
    return;
  }
  if (state.seen.has(k)) return;
  state.seen.add(k);
  if (!state.live) { log("held back (welcome)", m.type, (m.body || "").slice(0, 60)); return; }
  state.lastBotAt = Date.now();
  if (m.body) {
    // The streamed copy and the final message carry different ids. If one text is the start of
    // the other, it is the same reply: keep the longer text in the existing bubble.
    const twin = [...botRows.values()].slice(-3).find((r) => r.at >= state.awaitStart && (r.body.startsWith(m.body) || m.body.startsWith(r.body)));
    if (twin) {
      botRows.set(k, twin);
      if (m.body.length > twin.body.length) { twin.body = m.body; twin.bub.innerHTML = md(m.body); }
      return;
    }
    botRows.set(k, { body: m.body, bub: renderBot(m.body, role), at: Date.now() });
    return;
  }
  // Headless delivers buttons / lists with no content (no prompt, no options).
  log("rich message", m.type, JSON.stringify(m.data || {}).slice(0, 300));
  if (renderRich(m)) return;
  if (!state.bodylessNoted) { state.bodylessNoted = true; renderSys("Bo sent options this page can’t display. Please type your answer instead.", true); }
}

async function fetchMessages() {
  const r = await race(window.adaEmbed.getMessages(), 5000, "getMessages");
  const list = Array.isArray(r) ? r : (r && (r.messages || r.data)) || [];
  return list.filter(Boolean);
}

/* ---------------- Ada SDK ---------------- */
let subscribed = false;
function subscribe() {
  if (subscribed || !window.adaEmbed?.subscribeEvent) return;
  subscribed = true;
  try {
    window.adaEmbed.subscribeEvent("ada:message:received", (d) => { const m = d?.message || d; log("event received", m?.role, m?.type, m?.id); ingest(m); });
  } catch (e) { subscribed = false; log("subscribe failed", e?.message); }
}

window.adaSettings = {
  handle: HANDLE,
  headless: true,
  enableProgrammaticControl: true,      // required for sendMessage / getMessages / message events
  onAdaEmbedLoaded: () => subscribe(),
  adaReadyCallback: () => { log("adaReadyCallback"); state.sdk = true; subscribe(); boot(); },
};
(function loadAda() {
  const s = document.createElement("script");
  s.id = "__ada"; s.async = true;
  s.src = "https://static.ada.support/embed2.js";
  s.setAttribute("data-handle", HANDLE);    // auto-starts the headless SDK on page load
  document.body.append(s);
})();
setTimeout(() => { if (!state.sdk) { setStatus("Bo is unavailable on this page", "err"); log("no adaReadyCallback after 20s (allow list?)"); } }, 20000);

function boot() { if (!state.booting) state.booting = openConversation(params.has("reset")).finally(() => { state.booting = null; }); return state.booting; }

// Open (or resume) the conversation. Runs on page load and on "New chat".
async function openConversation(fresh) {
  state.ready = false;
  setStatus("Connecting to Bo…", "busy");
  const t0 = Date.now();
  if (fresh) {
    try { await race(window.adaEmbed.reset(), 15000, "reset"); log("reset done"); } catch (e) { log("reset failed", e?.message); }
    if (params.has("reset")) history.replaceState(null, "", location.pathname + (DEBUG ? "?debug" : ""));
  }
  // Resume: Ada keeps the chatter across reloads, so an earlier chat can be picked up again.
  let hist = [];
  if (!fresh) {
    for (let i = 0; i < 6; i++) {
      try { hist = await fetchMessages(); break; } catch (e) { log("getMessages not ready", e?.message); await delay(1000); }
    }
  }
  const firstReal = hist.findIndex((m) => m.role === "user" && m.body && norm(m.body) !== norm(OPENER));
  if (firstReal >= 0) {
    hist.slice(0, firstReal).forEach((m) => state.seen.add(keyOf(m)));
    state.live = true;
    let lastUser = null;
    for (const m of hist.slice(firstReal)) {
      if (m.role !== "user") { ingest(m); continue; }
      // Skip the client-id copy of a message that is also listed under its server id.
      if (!m.body || (lastUser && norm(lastUser.body) === norm(m.body) && Math.abs((m.createdAt || 0) - (lastUser.createdAt || 0)) < 10)) continue;
      renderUser(m.body); lastUser = m;
    }
    renderSys("Continuing your earlier chat with Bo");
    log("resumed", hist.length - firstReal, "messages");
  } else if (hist.length) {
    hist.forEach((m) => state.seen.add(keyOf(m)));
    log("conversation already open (welcome only)");
  } else {
    await openerAndSettle();
  }
  state.ready = true;
  state.lastSendAt = Math.max(state.lastSendAt, Date.now() - MIN_SEND_GAP_MS + 1500);
  setStatus("Bo is online", "on");
  log("ready after", ((Date.now() - t0) / 1000).toFixed(1), "s");
  pump();
}

// Send the opener, then wait until the welcome has arrived and gone quiet.
async function openerAndSettle() {
  state.lastSendAt = Date.now();
  race(window.adaEmbed.sendMessage(OPENER), 8000, "opener").then((r) => log("opener sent", r?.id)).catch((e) => log("opener", e?.message));
  const t0 = Date.now();
  let count = 0, changedAt = 0;
  while (Date.now() - t0 < WELCOME_MAX_MS) {
    await delay(400);
    let msgs;
    try { msgs = await fetchMessages(); } catch { continue; }
    msgs.forEach((m) => state.seen.add(keyOf(m)));
    const n = msgs.filter((m) => m.role !== "user").length;
    if (n > count) { count = n; changedAt = Date.now(); }
    if (changedAt && Date.now() - changedAt >= WELCOME_QUIET_MS) { log("welcome settled", count, "bot msgs"); return; }
  }
  log("welcome never settled, continuing");
}

/* ---------------- rich messages (pictures, cards, links, options) ---------------- */
// Messaging rows arrive bodyless with their content in m.data. Field names differ by row type
// and runtime version, so each reader tries the camelCase and snake_case spellings.
const pick = (o, ...ks) => { for (const k of ks) { const v = k.split(".").reduce((a, p) => a?.[p], o); if (v != null && v !== "") return v; } return null; };
const safeUrl = (u) => typeof u === "string" && /^https?:\/\//i.test(u) ? u : null;
const IMG_RE = /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i;
function findUrls(o, out = []) {
  if (typeof o === "string") { if (safeUrl(o)) out.push(o); }
  else if (o && typeof o === "object") Object.values(o).forEach((v) => findUrls(v, out));
  return out;
}
function richRow(html, ghost) {
  showThread();
  const before = typingRow ? typingRow.previousElementSibling : thread.lastElementChild;
  const row = document.createElement("div");
  row.className = "row bot";
  row.innerHTML = `<div class="av${ghost ?? (before && before === lastBotRow) ? " ghost" : ""}"><img src="assets/bo.png" alt=""></div><div class="rich">${html}</div>`;
  appendRow(row, true); lastBotRow = row;
  return row;
}
function linkCard(url, title, sub) {
  return `<a class="linkcard" href="${esc(url)}" target="_blank" rel="noopener"><span><b>${esc(title || url.replace(/^https?:\/\//, "").split("/")[0])}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</span>${ICON_EXT}</a>`;
}
function renderRich(m) {
  const d = m.data || {};
  const qrs = pick(d, "quickReplies", "quick_replies");
  if (Array.isArray(qrs) && qrs.length) { renderQuickReplies(m.id, qrs); return true; }
  switch (m.type) {
    case "picture": case "image": {
      const u = safeUrl(pick(d, "picUrl", "pic_url", "url", "imageUrl", "image.url", "src"));
      if (!u) break;
      const alt = pick(d, "altText", "alt_text", "alt") || "";
      const fig = `<figure class="slide"><a class="pic" href="${esc(u)}" target="_blank" rel="noopener" title="Open full size"><img src="${esc(u)}" alt="${esc(alt)}" loading="lazy"></a>${alt ? `<figcaption class="cap">${esc(alt)}</figcaption>` : ""}</figure>`;
      // Pictures sent back to back (e.g. "page 1/2/3" cards) share one swipeable carousel.
      let rail = lastBotRow?.querySelector(".rail");
      if (rail && lastBotRow === (typingRow ? typingRow.previousElementSibling : thread.lastElementChild)) {
        rail.insertAdjacentHTML("beforeend", fig);
        rail.closest(".rich").classList.add("multi");
        rail.parentElement.querySelector(".rail-count").textContent = `${rail.children.length} images · swipe or scroll`;
      } else {
        rail = richRow(`<div class="rail">${fig}</div><p class="rail-count"></p>`).querySelector(".rail");
      }
      // An image that fails to load becomes a plain link card instead of a broken-image icon.
      const slide = rail.lastElementChild;
      slide.querySelector("img").addEventListener("error", () => { slide.innerHTML = linkCard(u, alt || "View image"); }, { once: true });
      return true;
    }
    case "link": {
      const u = safeUrl(pick(d, "linkUrl", "link_url", "url", "link"));
      if (!u) break;
      const body = pick(d, "body", "text");
      richRow(`${body ? `<div class="bub">${md(body)}</div>` : ""}${linkCard(u, pick(d, "linkText", "link_text", "title"), pick(d, "linkSubtext", "description"))}`);
      return true;
    }
    case "video": case "downloadable": case "file": {
      const u = safeUrl(pick(d, "vidUrl", "vid_url", "url", "fileUrl", "file_url"));
      if (!u) break;
      richRow(linkCard(u, pick(d, "name", "title", "caption") || (m.type === "video" ? "Watch video" : "Download file"), pick(d, "caption")));
      return true;
    }
    case "widget": {
      const u = safeUrl(pick(d, "widgetUrl", "widget_url", "url"));
      if (!u) break;
      richRow(linkCard(u, pick(d, "linkText", "link_text", "widgetName") || "Open", pick(d, "linkSubtext", "link_subtext")));
      return true;
    }
    case "options_message": case "surfaceable_list_selection": {
      const opts = pick(d, "options", "selectables") || [];
      if (!opts.length) break;
      const prompt = pick(d, "prompt", "body", "text");
      if (prompt) renderBot(prompt, m.role);
      // Answered as text: these rows have no selectQuickReply equivalent on the host SDK.
      renderQuickReplies(null, opts.map((o) => typeof o === "string" ? { label: o } : { label: o.label || o.text || o.title || o.value, card: o.description ? { title: o.label || o.text, description: o.description } : null }));
      return true;
    }
  }
  // Unknown or unreadable row: show any links it carries rather than dropping it.
  const urls = [...new Set(findUrls(d))];
  if (urls.length) {
    richRow(urls.map((u) => IMG_RE.test(u) ? `<a class="pic" href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy"></a>` : linkCard(u)).join(""));
    return true;
  }
  return false;
}

/* ---------------- quick replies ---------------- */
// Bo's buttons arrive as a bodyless quick_replies message with data.quickReplies
// [{label, value, buttonType, target}]. They hang under Bo's last bubble; a click answers
// with selectQuickReply(messageId, index), and any new question makes older buttons stale.
function renderQuickReplies(msgId, qrs) {
  showThread();
  const row = document.createElement("div");
  row.className = "row bot";
  row.innerHTML = `<div class="av ghost"><img src="assets/bo.png" alt=""></div><div class="qr" role="group" aria-label="Choose an option"></div>`;
  const box = row.querySelector(".qr");
  const asCards = qrs.some((q) => q.card && (q.card.image || q.card.description));
  if (asCards) box.classList.add("cards");
  else if (qrs.length > 3 || qrs.some((q) => (q.label || "").length > 28)) box.classList.add("stacked");
  qrs.forEach((q, i) => {
    const url = safeUrl(q.target) || safeUrl(q.url) || (/link|url/i.test(q.buttonType || q.button_type || "") ? safeUrl(q.value) : null);
    const el = document.createElement(url ? "a" : "button");
    el.className = "qr-btn" + (url ? " link" : "") + (asCards ? " card" : "");
    const label = q.label || q.value || `Option ${i + 1}`;
    const img = safeUrl(q.card?.image?.url || q.card?.image);
    el.innerHTML = asCards
      ? `${img ? `<img src="${esc(img)}" alt="${esc(q.card?.image?.alt || "")}" loading="lazy">` : ""}<b>${esc(q.card?.title || label)}</b>${q.card?.description ? `<span>${esc(q.card.description)}</span>` : ""}`
      : esc(label) + (url ? ` ${ICON_EXT}` : "");
    if (url) { el.href = url; el.target = "_blank"; el.rel = "noopener"; }
    else {
      el.type = "button";
      el.addEventListener("click", () => {
        if (box.classList.contains("done")) return;
        box.classList.add("done"); el.classList.add("picked");
        box.querySelectorAll("button").forEach((b) => (b.disabled = true));
        ask(label, msgId ? { id: msgId, index: i } : null);
      });
    }
    box.append(el);
  });
  appendRow(row); lastBotRow = row;
}
function retireQuickReplies() {
  thread.querySelectorAll(".qr:not(.done)").forEach((box) => { box.classList.add("done"); box.querySelectorAll("button").forEach((b) => (b.disabled = true)); });
}

/* ---------------- sending ---------------- */
function ask(text, qr) {
  text = String(text || "").trim().slice(0, 500);
  if (!text) return;
  retireQuickReplies();
  const row = renderUser(text, true);
  state.pending.push({ text, row });
  state.queue.push({ text, qr });
  if (!state.ready) renderSys("Bo is getting ready. Your question will be sent in a moment.");
  startAwaiting();
  pump();
}

const isRateLimited = (e) => /rate_?limited/i.test(e?.message || String(e));
const isTransient = (e) => /in flight|did not respond|timed?\s*out|not ready/i.test(e?.message || String(e));

async function pump() {
  if (state.sending || !state.ready || !state.queue.length) return;
  state.sending = true;
  try {
    while (state.ready && state.queue.length) {
      const { text, qr } = state.queue[0];
      const wait = state.lastSendAt + MIN_SEND_GAP_MS - Date.now();
      if (wait > 0) await delay(wait);
      let useQr = !!(qr && window.adaEmbed.selectQuickReply);
      for (let attempt = 1; ; attempt++) {
        try {
          // Everything Bo sent before the first real question is the welcome: hold it back.
          state.live = true;
          state.lastSendAt = Date.now();
          let id;
          if (useQr) {
            try { id = await race(window.adaEmbed.selectQuickReply(qr.id, qr.index), 15000, "selectQuickReply"); log("quick reply", qr.index, text); }
            catch (e) { log("selectQuickReply failed, sending the label", e?.message); useQr = false; throw Object.assign(new Error("retry as text (not ready)"), { cause: e }); }
          } else {
            id = await race(window.adaEmbed.sendMessage(text), 30000, "sendMessage");
          }
          log("sent", id?.id || id, text.slice(0, 60));
          const i = state.pending.findIndex((p) => p.text === text);
          if (i >= 0) { state.pending[i].row.classList.remove("pending"); state.pending.splice(i, 1); }
          break;
        } catch (e) {
          log("send failed", attempt, e?.message);
          if (attempt >= 5 || !(isRateLimited(e) || isTransient(e))) { renderSys("That message didn’t reach Bo. Please try again.", true); break; }
          await delay(isRateLimited(e) ? 6000 : 900 * attempt);
        }
      }
      state.queue.shift();
      state.awaitStart = Date.now();
    }
  } finally { state.sending = false; }
}

// While a reply is due: show typing, and poll getMessages() so nothing is missed if an event is.
let pollTimer = null;
function startAwaiting() {
  state.awaiting = true; state.awaitStart = Date.now(); state.lastBotAt = 0; state.bodylessNoted = false;
  setTyping(true);
  if (!pollTimer) pollTimer = setTimeout(pollTick, 1500);
}
async function pollTick() {
  pollTimer = null;
  if (!state.awaiting) return;
  if (state.ready && !state.sending) {
    try { (await fetchMessages()).forEach(ingest); } catch (e) { log("poll", e?.message); }
  }
  const now = Date.now();
  const sentAndQuiet = !state.queue.length && !state.sending && state.lastBotAt > state.awaitStart && now - state.lastBotAt >= REPLY_QUIET_MS;
  if (sentAndQuiet) { state.awaiting = false; setTyping(false); return; }
  if (state.lastBotAt > state.awaitStart) setTyping(true);
  if (state.ready && !state.queue.length && now - state.awaitStart > REPLY_MAX_MS) {
    state.awaiting = false; setTyping(false);
    renderSys("Bo is taking longer than usual. Try asking again.", true);
    return;
  }
  pollTimer = setTimeout(pollTick, 1500);
}

/* ---------------- composer ---------------- */
const q = $("#q"), sendBtn = $("#sendbtn");
function syncComposer() { sendBtn.classList.toggle("ready", !!q.value.trim()); q.style.height = "auto"; q.style.height = Math.min(q.scrollHeight, 160) + "px"; }
q.addEventListener("input", syncComposer);
q.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("#composer").requestSubmit(); } });
$("#composer").addEventListener("submit", (e) => { e.preventDefault(); const t = q.value; q.value = ""; syncComposer(); ask(t); });

/* ---------------- new chat ---------------- */
$("#new-chat").addEventListener("click", async () => {
  if (!state.sdk) return;
  if (state.booting) { toast("Bo is still connecting…"); return; }
  state.awaiting = false; setTyping(false);
  state.live = false; state.queue = []; state.pending = []; state.seen.clear(); botRows.clear(); lastBotRow = null;
  thread.innerHTML = ""; thread.hidden = true; hero.hidden = false; scroller.scrollTop = 0;
  toast("Starting a new chat with Bo");
  state.booting = openConversation(true).finally(() => { state.booting = null; });
});
