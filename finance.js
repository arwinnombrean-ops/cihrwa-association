/* =============================================================
   FINANCE — kwarta sa association
   ============================================================= */
App.pages.finance = async function (main, tab = "transactions") {
  const [txns, members, dues] = await Promise.all([
    db(App.sb.from("transactions").select("*").order("txn_date", { ascending: false }).order("created_at", { ascending: false })),
    loadMembers(),
    db(App.sb.from("v_dues_status").select("*")),
  ]);
  const mm = Object.fromEntries(members.map((m) => [m.id, m]));
  const ms = monthStart();
  const cash = txns.filter((t) => !t.is_in_kind);
  const sum = (arr) => arr.reduce((s, t) => s + Number(t.amount), 0);
  const balance = sum(cash.filter((t) => t.txn_type === "income")) - sum(cash.filter((t) => t.txn_type === "expense"));
  const incMonth = sum(cash.filter((t) => t.txn_type === "income" && t.txn_date >= ms));
  const expMonth = sum(cash.filter((t) => t.txn_type === "expense" && t.txn_date >= ms));
  const unpaid = dues.reduce((s, d) => s + Number(d.amount_unpaid || 0), 0);
  const unaudited = txns.filter((t) => !t.audited).length;

  main.innerHTML =
    pageHead(
      "Finance",
      `Membership fee: ${money(App.settings.membership_fee)} · Monthly due: ${money(App.settings.monthly_due)}`,
      (can("finance") ? `<button class="btn primary" id="new-txn">Bag-ong transaction</button>` : "") +
        `<button class="btn" id="print-fin">Print</button>`
    ) +
    `<div class="ledger">
      <div><div class="fig ${balance < 0 ? "neg" : ""}">${money(balance)}</div><div class="cap">Cash on hand</div></div>
      <div><div class="fig">${money(incMonth)}</div><div class="cap">Income karong bulana</div></div>
      <div><div class="fig">${money(expMonth)}</div><div class="cap">Gasto karong bulana</div></div>
      <div><div class="fig neg">${money(unpaid)}</div><div class="cap">Wala pa mabayri nga dues</div></div>
      <div><div class="fig">${num(unaudited)}</div><div class="cap">Wala pa ma-audit</div></div>
    </div>
    <div class="tabs" role="tablist">
      <button data-tab="transactions">Transactions</button>
      <button data-tab="dues">Monthly dues</button>
      <button data-tab="support">Sponsors &amp; gov't support</button>
      <button data-tab="summary">Summary</button>
    </div>
    <div id="fin-body"></div>`;

  const body = main.querySelector("#fin-body");
  const views = {
    transactions: () => txnView(body, txns, mm),
    dues: () => duesView(body, dues, mm, txns),
    support: () => supportView(body, txns),
    summary: () => summaryView(body, txns),
  };
  const show = (t) => {
    tab = views[t] ? t : "transactions";
    history.replaceState(null, "", "#finance/" + tab);
    main.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    views[tab]();
  };
  main.querySelector(".tabs").addEventListener("click", (e) => e.target.dataset.tab && show(e.target.dataset.tab));
  main.querySelector("#new-txn")?.addEventListener("click", () => txnForm(null, members));
  main.querySelector("#print-fin").addEventListener("click", () => {
    const inner = [...body.querySelectorAll(".panel")].map((p) => p.outerHTML.replace(/<button[^>]*>.*?<\/button>/g, "")).join("");
    printHTML(Cert.report("Financial records", main.querySelector(".tabs .active").textContent, inner, App.settings));
  });
  show(tab);
};

function txnView(el, txns, mm) {
  const state = { type: "", cat: "", from: "", to: "", audit: "" };
  el.innerHTML = `
    <div class="filters">
      <label>Klase<select id="t-type">${options({ income: "Income", expense: "Expense" }, "", "Tanan")}</select></label>
      <label>Category<select id="t-cat">${options(ALL_CATS, "", "Tanan")}</select></label>
      <label>Gikan<input type="date" id="t-from"></label>
      <label>Hangtod<input type="date" id="t-to"></label>
      <label>Audit<select id="t-audit">${options({ yes: "Audited", no: "Wala pa" }, "", "Tanan")}</select></label>
    </div>
    <div class="panel table-wrap"><table>
      <thead><tr><th>Petsa</th><th>Category</th><th>Member / Gikan / Gibayran</th><th>Detalye</th><th>O.R.</th><th class="num">Amount</th><th>Audit</th><th></th></tr></thead>
      <tbody id="t-rows"></tbody><tfoot id="t-foot"></tfoot>
    </table></div>`;

  const draw = () => {
    const list = txns.filter(
      (t) =>
        (!state.type || t.txn_type === state.type) &&
        (!state.cat || t.category === state.cat) &&
        (!state.from || t.txn_date >= state.from) &&
        (!state.to || t.txn_date <= state.to) &&
        (!state.audit || (state.audit === "yes") === t.audited)
    );
    el.querySelector("#t-rows").innerHTML = list.length
      ? list
          .map((t) => {
            const who = t.member_id ? `<a href="#member/${t.member_id}">${esc(fullName(mm[t.member_id]))}</a>` : esc(t.source_or_payee);
            const sign = t.txn_type === "expense" ? "−" : "";
            const acts = [];
            if (can("audit")) acts.push(`<button class="btn small" data-act="audit">${t.audited ? "Unmark" : "Mark audited"}</button>`);
            if (can("finance") && !t.audited) acts.push(`<button class="btn small" data-act="edit">Usba</button>`, `<button class="btn small danger" data-act="del">Papasa</button>`);
            return `<tr data-id="${t.id}">
              <td>${esc(fmtShort(t.txn_date))}</td>
              <td><span class="badge ${t.txn_type === "income" ? "b-green" : "b-red"}">${esc(ALL_CATS[t.category])}</span></td>
              <td>${who}${t.member_id && t.source_or_payee ? `<div class="muted small">${esc(t.source_or_payee)}</div>` : ""}</td>
              <td>${t.due_month ? "Para sa " + esc(monthLabel(t.due_month)) + ". " : ""}${esc(t.description)}${
              t.is_in_kind ? `<div><span class="badge b-blue">In-kind</span> ${esc(t.in_kind_description)}</div>` : ""
            }</td>
              <td>${esc(t.or_number)}</td>
              <td class="num">${sign}${money(t.amount)}</td>
              <td>${t.audited ? `<span class="badge b-green" title="${esc(t.audited_by)} · ${esc(fmtShort(t.audited_at))}">Audited</span>` : '<span class="badge b-grey">Wala pa</span>'}</td>
              <td><div class="actions">${acts.join("")}</div></td></tr>`;
          })
          .join("")
      : emptyRow(8, txns.length ? "Walay nakit-an." : "Wala pay transaction.");
    const cashList = list.filter((t) => !t.is_in_kind);
    const inc = cashList.filter((t) => t.txn_type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const exp = cashList.filter((t) => t.txn_type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    el.querySelector("#t-foot").innerHTML = `<tr><td colspan="5">Cash income ${money(inc)} · Cash gasto ${money(exp)}</td><td class="num">${money(inc - exp)}</td><td colspan="2"></td></tr>`;
  };
  draw();
  for (const [id, key] of [["#t-type", "type"], ["#t-cat", "cat"], ["#t-from", "from"], ["#t-to", "to"], ["#t-audit", "audit"]]) {
    el.querySelector(id).addEventListener("input", (e) => ((state[key] = e.target.value), draw()));
  }
  el.querySelector("#t-rows").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const t = txns.find((x) => x.id === b.closest("tr").dataset.id);
    try {
      if (b.dataset.act === "audit") {
        if (!t.audited) {
          modal({
            title: "Mark audited",
            body: `<p>${esc(ALL_CATS[t.category])} · ${money(t.amount)} · ${esc(fmtShort(t.txn_date))}</p><label>Audit note<input name="audit_note" placeholder="optional"></label>`,
            submitLabel: "Mark audited",
            onSubmit: async (f) => {
              await db(App.sb.from("transactions").update({ audited: true, audit_note: formToObj(f).audit_note }).eq("id", t.id));
              toast("Na-audit.");
              App.render();
            },
          });
        } else {
          await db(App.sb.from("transactions").update({ audited: false }).eq("id", t.id));
          App.render();
        }
      }
      if (b.dataset.act === "edit") txnForm(t, await loadMembers());
      if (b.dataset.act === "del") {
        if (!(await confirmBox(`Papason ni nga transaction (${money(t.amount)})?`, "Papasa"))) return;
        await db(App.sb.from("transactions").delete().eq("id", t.id));
        toast("Napapas.");
        App.render();
      }
    } catch (err) {
      toast(errMsg(err), true);
    }
  });
}

const MEMBER_CATS = ["membership_fee", "monthly_due", "fines", "assistance_to_members", "rewards"];
const SOURCE_CATS = ["sponsor", "government_support", "donation", "other_income"];

function txnForm(t, members, preset = {}) {
  const isNew = !t;
  t = t || { txn_type: "income", category: "monthly_due", txn_date: isoDate(), ...preset };
  const active = members.filter((m) => ["active", "applicant"].includes(m.status));
  const body = `
    <div class="grid">
      <label>Klase<select name="txn_type">${options({ income: "Income (sulod)", expense: "Expense (gasto)" }, t.txn_type)}</select></label>
      <label>Category<select name="category"></select></label>
      <label>Petsa<input type="date" name="txn_date" value="${esc(t.txn_date)}" required></label>
    </div>
    <div class="grid" style="margin-top:.9rem">
      <label data-show="member">Member<select name="member_id" data-nullable>${memberOptions(active, t.member_id, "—")}</select></label>
      <label data-show="month">Bulan nga gibayran<input type="month" name="due_month" value="${esc((t.due_month || "").slice(0, 7))}"></label>
      <label data-show="source"><span id="src-label">Gikan kang / sa</span><input name="source_or_payee" value="${esc(t.source_or_payee || "")}" placeholder="e.g. DA Region 7, LGU, ngalan sa sponsor"></label>
      <label>Amount (₱) *<input type="number" name="amount" step="0.01" min="0" required value="${esc(t.amount ?? "")}"></label>
      <label>O.R. / Voucher no.<input name="or_number" value="${esc(t.or_number || "")}"></label>
    </div>
    <div class="grid two" style="margin-top:.9rem">
      <label class="check"><input type="checkbox" name="is_in_kind" ${t.is_in_kind ? "checked" : ""}> In-kind (dili cash — e.g. feeds, biik, bakuna)</label>
      <label data-show="inkind">Unsa nga butang ug pila<input name="in_kind_description" value="${esc(t.in_kind_description || "")}" placeholder="e.g. 20 sako feeds"></label>
    </div>
    <label style="margin-top:.9rem">Detalye<input name="description" value="${esc(t.description || "")}"></label>
    <p class="muted small" id="inkind-hint">Ang in-kind nga amount kay gibanabana nga value; dili ni maapil sa cash on hand.</p>`;

  modal({
    title: isNew ? "Bag-ong transaction" : "Usba ang transaction",
    body,
    onOpen: (el) => {
      const f = el.closest("form");
      const fillCats = () => {
        const cats = f.elements.txn_type.value === "income" ? INCOME_CATS : EXPENSE_CATS;
        const cur = f.elements.category.value || t.category;
        f.elements.category.innerHTML = options(cats, cats[cur] ? cur : Object.keys(cats)[0]);
      };
      const toggle = () => {
        const c = f.elements.category.value;
        el.querySelector('[data-show="member"]').hidden = !MEMBER_CATS.includes(c);
        el.querySelector('[data-show="month"]').hidden = c !== "monthly_due";
        el.querySelector("#src-label").textContent = f.elements.txn_type.value === "income" ? "Gikan kang / sa" : "Gibayran kang / sa";
        el.querySelector('[data-show="inkind"]').hidden = !f.elements.is_in_kind.checked;
        el.querySelector("#inkind-hint").hidden = !f.elements.is_in_kind.checked;
        f.elements.member_id.required = ["membership_fee", "monthly_due"].includes(c);
        f.elements.due_month.required = c === "monthly_due";
        if (isNew && !f.elements.amount.dataset.touched) {
          if (c === "monthly_due") f.elements.amount.value = App.settings.monthly_due;
          else if (c === "membership_fee") f.elements.amount.value = App.settings.membership_fee;
        }
      };
      f.elements.amount.addEventListener("input", () => (f.elements.amount.dataset.touched = "1"));
      f.elements.txn_type.addEventListener("change", () => (fillCats(), toggle()));
      f.elements.category.addEventListener("change", toggle);
      f.elements.is_in_kind.addEventListener("change", toggle);
      fillCats();
      toggle();
    },
    onSubmit: async (form) => {
      const o = formToObj(form);
      if (!MEMBER_CATS.includes(o.category)) o.member_id = null;
      if (o.category !== "monthly_due") o.due_month = null;
      if (!o.is_in_kind) o.in_kind_description = "";
      if (isNew) await db(App.sb.from("transactions").insert(o));
      else await db(App.sb.from("transactions").update(o).eq("id", t.id));
      toast("Na-save ang transaction.");
      App.render();
    },
  });
}

function duesView(el, dues, mm, txns) {
  const paid = {};
  for (const t of txns) if (t.category === "monthly_due") (paid[t.member_id] ||= new Set()).add(t.due_month.slice(0, 7));
  const rows = dues
    .map((d) => ({ ...d, m: mm[d.member_id] }))
    .filter((d) => d.m)
    .sort((a, b) => b.months_unpaid - a.months_unpaid || fullName(a.m).localeCompare(fullName(b.m)));

  el.innerHTML = `<div class="panel table-wrap">
    <p class="muted small">Gikan sa bulan nga nahimong member hangtod karong bulana. Monthly due: ${money(App.settings.monthly_due)}.</p>
    <table><thead><tr><th>Member</th><th>Membership fee</th><th class="num">Bayad / kinahanglan</th><th>Huling bayad</th><th class="num">Utang</th><th></th></tr></thead>
    <tbody>${
      rows
        .map(
          (d) => `<tr data-id="${d.member_id}">
        <td><a href="#member/${d.member_id}">${esc(fullName(d.m))}</a> <span class="muted small">${esc(d.m.member_no)}</span></td>
        <td>${d.membership_fee_paid ? '<span class="badge b-green">Bayad</span>' : '<span class="badge b-red">Wala pa</span>'}</td>
        <td class="num">${d.months_paid} / ${d.months_due}</td>
        <td>${d.last_paid_month ? esc(monthLabel(d.last_paid_month)) : "—"}</td>
        <td class="num">${d.months_unpaid > 0 ? `<strong style="color:var(--danger)">${money(d.amount_unpaid)}</strong><div class="muted small">${d.months_unpaid} ka bulan</div>` : "—"}</td>
        <td>${
          can("finance")
            ? `<div class="actions">${d.months_unpaid > 0 ? `<button class="btn small primary" data-act="pay">Bayad dues</button>` : ""}${
                !d.membership_fee_paid ? `<button class="btn small" data-act="fee">Membership fee</button>` : ""
              }</div>`
            : ""
        }</td></tr>`
        )
        .join("") || emptyRow(6, "Walay active member.")
    }</tbody></table></div>`;

  el.querySelector("tbody").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const d = rows.find((x) => x.member_id === b.closest("tr").dataset.id);
    if (b.dataset.act === "fee") return txnForm(null, Object.values(mm), { category: "membership_fee", member_id: d.member_id });

    // lista sa bulan nga wala pa mabayri
    const start = parseDate(d.m.membership_date || d.m.application_date);
    const months = [];
    for (let x = new Date(start.getFullYear(), start.getMonth(), 1); x <= new Date(); x.setMonth(x.getMonth() + 1)) {
      const key = isoDate(x).slice(0, 7);
      if (!paid[d.member_id]?.has(key)) months.push(key);
    }
    modal({
      title: `Bayad sa monthly dues — ${displayName(d.m)}`,
      body: `<p class="muted">Pili-a ang mga bulan nga bayran karon (${money(App.settings.monthly_due)} kada bulan).</p>
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${months
          .map((k) => `<label class="check"><input type="checkbox" name="m_${k}" checked> ${esc(monthLabel(k + "-01"))}</label>`)
          .join("")}</div>
        <div class="grid" style="margin-top:1rem">
          <label>Petsa<input type="date" name="txn_date" value="${isoDate()}" required></label>
          <label>O.R. no.<input name="or_number"></label>
        </div>
        <p id="pay-total" style="margin-top:.8rem;font-weight:700"></p>`,
      submitLabel: "I-save ang bayad",
      onOpen: (bd) => {
        const upd = () => {
          const n = bd.querySelectorAll("input[name^=m_]:checked").length;
          bd.querySelector("#pay-total").textContent = `${n} ka bulan · Total ${money(n * App.settings.monthly_due)}`;
        };
        bd.addEventListener("change", upd);
        upd();
      },
      onSubmit: async (form) => {
        const o = formToObj(form);
        const chosen = Object.keys(o).filter((k) => k.startsWith("m_") && o[k]).map((k) => k.slice(2) + "-01");
        if (!chosen.length) {
          toast("Walay bulan nga napili.", true);
          return false;
        }
        await db(
          App.sb.from("transactions").insert(
            chosen.map((dm) => ({
              txn_type: "income",
              category: "monthly_due",
              member_id: d.member_id,
              due_month: dm,
              amount: App.settings.monthly_due,
              txn_date: o.txn_date,
              or_number: o.or_number,
            }))
          )
        );
        toast(`Na-record ang ${chosen.length} ka bulan nga bayad.`);
        App.render();
      },
    });
  });
}

function supportView(el, txns) {
  const list = txns.filter((t) => ["sponsor", "government_support", "donation"].includes(t.category));
  const by = {};
  for (const t of list) {
    const k = (t.source_or_payee || "(walay ngalan)") + "|" + t.category;
    by[k] ||= { source: t.source_or_payee || "(walay ngalan)", cat: t.category, cash: 0, kind: 0, items: [] };
    if (t.is_in_kind) {
      by[k].kind += Number(t.amount);
      if (t.in_kind_description) by[k].items.push(t.in_kind_description);
    } else by[k].cash += Number(t.amount);
  }
  const groups = Object.values(by).sort((a, b) => b.cash + b.kind - (a.cash + a.kind));
  el.innerHTML = `<div class="panel table-wrap"><h2>Mga sponsor ug suporta sa gobyerno</h2>
    <table><thead><tr><th>Gikan</th><th>Klase</th><th class="num">Cash</th><th class="num">In-kind (value)</th><th>Mga butang</th></tr></thead>
    <tbody>${
      groups
        .map(
          (g) => `<tr><td>${esc(g.source)}</td><td>${esc(ALL_CATS[g.cat])}</td><td class="num">${money(g.cash)}</td>
        <td class="num">${money(g.kind)}</td><td class="small">${esc(g.items.join("; "))}</td></tr>`
        )
        .join("") || emptyRow(5, "Wala pay sponsor o government support nga na-record. Gamita ang “Bag-ong transaction”.")
    }</tbody>
    <tfoot><tr><td colspan="2">Total</td><td class="num">${money(groups.reduce((s, g) => s + g.cash, 0))}</td><td class="num">${money(
    groups.reduce((s, g) => s + g.kind, 0)
  )}</td><td></td></tr></tfoot></table></div>`;
}

function summaryView(el, txns) {
  const years = [...new Set(txns.map((t) => t.txn_date.slice(0, 4)))].sort().reverse();
  const y0 = years[0] || String(new Date().getFullYear());
  el.innerHTML = `<div class="filters"><label>Tuig<select id="s-year">${options(Object.fromEntries((years.length ? years : [y0]).map((y) => [y, y])), y0)}</select></label></div><div id="s-out"></div>`;
  const draw = (y) => {
    const list = txns.filter((t) => t.txn_date.startsWith(y));
    const rowsFor = (cats, type) =>
      Object.entries(cats)
        .map(([k, label]) => {
          const it = list.filter((t) => t.txn_type === type && t.category === k);
          const cash = it.filter((t) => !t.is_in_kind).reduce((s, t) => s + Number(t.amount), 0);
          const kind = it.filter((t) => t.is_in_kind).reduce((s, t) => s + Number(t.amount), 0);
          return { label, cash, kind };
        })
        .filter((r) => r.cash || r.kind);
    const inc = rowsFor(INCOME_CATS, "income");
    const exp = rowsFor(EXPENSE_CATS, "expense");
    const tot = (r, k) => r.reduce((s, x) => s + x[k], 0);
    const tbl = (title, r) => `<div class="panel"><h2>${title}</h2><table>
      <thead><tr><th>Category</th><th class="num">Cash</th><th class="num">In-kind</th></tr></thead>
      <tbody>${r.map((x) => `<tr><td>${esc(x.label)}</td><td class="num">${money(x.cash)}</td><td class="num">${money(x.kind)}</td></tr>`).join("") || emptyRow(3, "Wala")}</tbody>
      <tfoot><tr><td>Total</td><td class="num">${money(tot(r, "cash"))}</td><td class="num">${money(tot(r, "kind"))}</td></tr></tfoot></table></div>`;
    el.querySelector("#s-out").innerHTML = `<div class="cols">${tbl("Income " + y, inc)}${tbl("Gasto " + y, exp)}</div>
      <div class="panel"><strong>Net cash ${y}: ${money(tot(inc, "cash") - tot(exp, "cash"))}</strong></div>`;
  };
  el.querySelector("#s-year").addEventListener("change", (e) => draw(e.target.value));
  draw(y0);
}
