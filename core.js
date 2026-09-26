/* =============================================================
   CORE — shared helpers used by every page
   ============================================================= */
const App = (window.App = {
  sb: null,
  session: null,
  profile: null,
  settings: null,
  pages: {},
});

/* ---------- Constants ---------- */
const ROLES = {
  president: "President",
  vice_president: "Vice President",
  secretary: "Secretary",
  treasurer: "Treasurer",
  auditor: "Auditor",
  pro: "P.R.O.",
  board_member: "Board Member",
  pending: "Pending (walay access)",
};

const HERD = [
  { k: "sows", label: "Anay", en: "Sow" },
  { k: "gilts", label: "Bigal", en: "Gilt" },
  { k: "boars", label: "Butakal", en: "Boar" },
  { k: "piglets", label: "Biik", en: "Piglets" },
  { k: "fatteners", label: "Fattening", en: "Fatteners" },
];

const INCOME_CATS = {
  membership_fee: "Membership fee",
  monthly_due: "Monthly due",
  sponsor: "Sponsor",
  government_support: "Government support",
  donation: "Donation",
  fines: "Fines / multa",
  other_income: "Other income",
};
const EXPENSE_CATS = {
  meeting_expense: "Meeting expense",
  office_supplies: "Office supplies",
  transportation: "Transportation",
  assistance_to_members: "Assistance to members",
  rewards: "Rewards / incentives",
  other_expense: "Other expense",
};
const ALL_CATS = { ...INCOME_CATS, ...EXPENSE_CATS };

const DEST_TYPES = {
  slaughterhouse: "Slaughterhouse",
  backyard: "Ipa-ihaw (backyard / private)",
  other_farm: "Laing farm (i-alima)",
  other: "Uban pa",
};
const PRICE_BASIS = { per_kilo: "Per kilo", per_head: "Per ulo", lump_sum: "Lump sum" };

const MEETING_TYPES = {
  regular: "Regular meeting",
  special: "Special meeting",
  general_assembly: "General assembly",
  orientation: "Orientation",
};
const ATT_STATUS = { present: "Present", late: "Late", excused: "Excused", absent: "Absent" };
const AWARD_TYPES = {
  pioneer: "Pioneer member",
  perfect_attendance: "Perfect attendance",
  very_active: "Very active member",
  loyalty: "Loyalty award",
  top_raiser: "Top raiser",
  other: "Other",
};
const MEMBER_STATUS = {
  applicant: "Applicant",
  active: "Active",
  inactive: "Inactive",
  resigned: "Resigned",
  deceased: "Deceased",
};
const DISPOSAL_STATUS = {
  for_president: "Para sa President",
  for_da: "Para sa D.A.",
  cleared: "Cleared",
  cancelled: "Cancelled",
};

/* ---------- Permissions ---------- */
const PERMS = {
  members: ["president", "secretary"],
  disposals: ["president", "secretary"],
  issueCert: ["president"],
  finance: ["president", "treasurer"],
  audit: ["president", "auditor"],
  meetings: ["president", "secretary"],
  rewards: ["president", "secretary"],
  settings: ["president", "secretary"],
  officers: ["president"],
  delete: ["president"],
};
function can(perm) {
  return !!(App.profile && PERMS[perm] && PERMS[perm].includes(App.profile.role));
}

/* ---------- Formatting ---------- */
function esc(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function money(n) {
  const v = Number(n || 0);
  return "₱" + v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function num(n) {
  return Number(n || 0).toLocaleString("en-PH");
}
function parseDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  const [y, m, day] = String(d).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day || 1);
}
function fmtDate(d) {
  const x = parseDate(d);
  return x ? x.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";
}
function fmtShort(d) {
  const x = parseDate(d);
  return x ? x.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";
}
function monthLabel(d) {
  const x = parseDate(d);
  return x ? x.toLocaleDateString("en-US", { year: "numeric", month: "long" }) : "";
}
function ordinalDay(d) {
  const x = parseDate(d);
  if (!x) return "";
  const n = x.getDate();
  const s = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${s} day of ${x.toLocaleDateString("en-US", { month: "long" })}, ${x.getFullYear()}`;
}
function isoDate(d = new Date()) {
  const x = d instanceof Date ? d : parseDate(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
function monthStart(d = new Date()) {
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}
function fullName(m) {
  if (!m) return "";
  const mi = m.middle_name ? ` ${m.middle_name.trim()[0]}.` : "";
  return `${m.last_name}, ${m.first_name}${mi}${m.suffix ? " " + m.suffix : ""}`;
}
function displayName(m) {
  if (!m) return "";
  const mi = m.middle_name ? ` ${m.middle_name.trim()[0]}.` : "";
  return `${m.first_name}${mi} ${m.last_name}${m.suffix ? " " + m.suffix : ""}`;
}
function memberAddress(m) {
  if (!m) return "";
  return [m.purok, m.barangay, m.municipality, m.province].filter(Boolean).join(", ");
}
function herdTotal(h, prefix = "") {
  if (!h) return 0;
  return HERD.reduce((s, x) => s + Number(h[prefix + x.k] || 0), 0);
}
function herdSummary(h, prefix = "") {
  if (!h) return "—";
  const parts = HERD.filter((x) => Number(h[prefix + x.k]) > 0).map((x) => `${h[prefix + x.k]} ${x.label}`);
  return parts.length ? parts.join(", ") : "0";
}

/* ---------- Badges ---------- */
function memberBadge(status) {
  const c = { applicant: "b-gold", active: "b-green", inactive: "b-grey", resigned: "b-grey", deceased: "b-grey" }[status];
  return `<span class="badge ${c}">${esc(MEMBER_STATUS[status] || status)}</span>`;
}
function activityBadge(cat) {
  const c = { "Very Active": "b-green", Active: "b-blue", "Less Active": "b-gold", Inactive: "b-red", New: "b-grey" }[cat] || "b-grey";
  return `<span class="badge ${c}">${esc(cat || "—")}</span>`;
}
function disposalBadge(status) {
  const c = { for_president: "b-gold", for_da: "b-blue", cleared: "b-green", cancelled: "b-grey" }[status];
  return `<span class="badge ${c}">${esc(DISPOSAL_STATUS[status] || status)}</span>`;
}
function disposalSteps(d) {
  if (d.status === "cancelled") return disposalBadge("cancelled");
  const s1 = d.assoc_cert_no ? "done" : "now";
  const s2 = d.da_cert_no ? "done" : d.assoc_cert_no ? "now" : "";
  const s3 = d.status === "cleared" ? "done" : "";
  return `<div class="steps"><span class="step ${s1}">1 President</span><span class="step ${s2}">2 D.A.</span><span class="step ${s3}">3 Cleared</span></div>`;
}

/* ---------- Select helpers ---------- */
function options(map, selected, blank) {
  let out = blank !== undefined ? `<option value="">${esc(blank)}</option>` : "";
  for (const [k, v] of Object.entries(map)) {
    out += `<option value="${esc(k)}" ${String(selected) === String(k) ? "selected" : ""}>${esc(v)}</option>`;
  }
  return out;
}
function memberOptions(members, selected, blank = "— Pili og member —") {
  let out = `<option value="">${esc(blank)}</option>`;
  for (const m of members) {
    out += `<option value="${m.id}" ${selected === m.id ? "selected" : ""}>${esc(fullName(m))}${m.member_no ? " · " + esc(m.member_no) : ""}</option>`;
  }
  return out;
}

/* ---------- Database helpers ---------- */
async function db(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
function errMsg(e) {
  const msg = (e && (e.message || e.error_description)) || String(e);
  if (/row-level security|permission denied/i.test(msg)) return "Wala kay permiso sa kini nga aksyon para sa imong position.";
  if (/uq_monthly_due/.test(msg)) return "Nabayran na ang monthly due niini nga member para sa maong bulan.";
  if (/uq_membership_fee/.test(msg)) return "Nabayran na ning member ang iyang membership fee.";
  if (/chk_qty_le_herd/.test(msg)) return "Mas daghan ang i-dispose kaysa sa buhi nga baboy. Susiha ang ihap.";
  if (/chk_has_heads/.test(msg)) return "Butangi og ihap kung pila ka baboy ang i-dispose.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Walay koneksyon sa internet o sa Supabase. Susiha ang internet ug ang config.js.";
  if (/Invalid login credentials/i.test(msg)) return "Sayop ang email o password.";
  return msg;
}

/* ---------- Shared data loaders ---------- */
async function loadSettings() {
  App.settings = await db(App.sb.from("settings").select("*").eq("id", 1).single());
  return App.settings;
}
async function loadMembers(filter) {
  let q = App.sb.from("members").select("*").order("last_name").order("first_name");
  if (filter === "active") q = q.eq("status", "active");
  return db(q);
}
async function loadCurrentHerd() {
  const rows = await db(App.sb.from("v_current_herd").select("*"));
  return Object.fromEntries(rows.map((r) => [r.member_id, r]));
}

/* ---------- UI: toast ---------- */
let toastTimer;
function toast(msg, isErr = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "show" + (isErr ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ""), isErr ? 6000 : 3000);
}

/* ---------- UI: modal ---------- */
let modalSubmit = null;
function modal({ title, body, submitLabel = "Save", onSubmit, onOpen, cancelLabel = "Cancel", extra = "" }) {
  const dlg = document.getElementById("modal");
  document.getElementById("modal-title").textContent = title;
  // bag-ong body matag modal aron dili magdala og daang event listeners
  const oldBody = document.getElementById("modal-body");
  const bodyEl = oldBody.cloneNode(false);
  oldBody.replaceWith(bodyEl);
  bodyEl.innerHTML = body;
  document.getElementById("modal-foot").innerHTML =
    extra +
    `<button type="button" class="btn" data-close>${esc(onSubmit ? cancelLabel : "Close")}</button>` +
    (onSubmit ? `<button type="submit" class="btn primary">${esc(submitLabel)}</button>` : "");
  modalSubmit = onSubmit || null;
  if (!dlg.open) dlg.showModal();
  if (onOpen) onOpen(bodyEl);
  const first = bodyEl.querySelector("input:not([type=hidden]):not([readonly]), select, textarea");
  if (first) first.focus();
  return bodyEl;
}
function closeModal() {
  const dlg = document.getElementById("modal");
  if (dlg.open) dlg.close();
}
function initModal() {
  const form = document.getElementById("modal-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!modalSubmit) return closeModal();
    const btn = form.querySelector("button[type=submit]");
    if (btn) btn.disabled = true;
    try {
      const keepOpen = await modalSubmit(form);
      if (keepOpen !== false) closeModal();
    } catch (err) {
      console.error(err);
      toast(errMsg(err), true);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
  form.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeModal();
  });
  document.getElementById("modal-close").addEventListener("click", closeModal);
}
function confirmBox(message, label = "Oo, padayon") {
  return new Promise((resolve) => {
    let answered = false;
    modal({
      title: "Kumpirmahon",
      body: `<p>${message}</p>`,
      submitLabel: label,
      onSubmit: () => {
        answered = true;
        resolve(true);
      },
    });
    const dlg = document.getElementById("modal");
    dlg.addEventListener("close", () => !answered && resolve(false), { once: true });
  });
}

/* Read a form into a plain object. number → Number|null, date → string|null, checkbox → boolean */
function formToObj(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === "radio") {
      if (el.checked) out[el.name] = el.value;
      continue;
    }
    if (el.type === "checkbox") out[el.name] = el.checked;
    else if (el.type === "number") out[el.name] = el.value === "" ? null : Number(el.value);
    else if (el.type === "date") out[el.name] = el.value || null;
    else if (el.type === "month") out[el.name] = el.value ? el.value + "-01" : null;
    else if (el.tagName === "SELECT" && el.dataset.nullable !== undefined) out[el.name] = el.value || null;
    else out[el.name] = el.value.trim();
  }
  return out;
}

function herdInputs(prefix = "", values = {}, opts = {}) {
  return `<div class="herd-grid">${HERD.map(
    (h) => `<label>${h.label} <span class="hint">${h.en}</span>
      <input type="number" min="0" step="1" name="${prefix}${h.k}" value="${Number(values[prefix + h.k] ?? values[h.k] ?? 0)}" ${opts.readonly ? "readonly" : ""} required></label>`
  ).join("")}</div>`;
}

/* ---------- Printing ---------- */
async function printHTML(html) {
  const area = document.getElementById("print-area");
  area.innerHTML = html;
  document.body.classList.add("printing");
  try {
    await document.fonts.ready;
  } catch (_) {}
  const cleanup = () => {
    document.body.classList.remove("printing");
    area.innerHTML = "";
  };
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  setTimeout(() => {
    if (document.body.classList.contains("printing")) cleanup();
  }, 60000);
}

/* ---------- Page helpers ---------- */
function pageHead(title, sub, actions = "") {
  return `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ""}</div><div class="actions">${actions}</div></div>`;
}
function emptyRow(cols, text) {
  return `<tr><td colspan="${cols}" class="empty">${text}</td></tr>`;
}
function go(hash) {
  if (location.hash === "#" + hash) App.render();
  else location.hash = hash;
}
