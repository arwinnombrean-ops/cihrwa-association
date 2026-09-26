/* =============================================================
   DISPOSAL / SALES
   Proseso: 1) Form  →  2) Certification sa President  →  3) Certification sa D.A.  →  Cleared
   ============================================================= */
App.pages.disposals = async function (main) {
  const [rows, members] = await Promise.all([
    db(App.sb.from("disposals").select("*").order("disposal_date", { ascending: false }).order("created_at", { ascending: false })),
    loadMembers(),
  ]);
  const mm = Object.fromEntries(members.map((m) => [m.id, m]));
  const state = { status: "", q: "", from: "", to: "" };
  const thisMonth = monthStart();

  const cleared = rows.filter((d) => d.status === "cleared" && d.disposal_date >= thisMonth);
  main.innerHTML =
    pageHead(
      "Disposal / Sales",
      "Proseso: i-fill up ang form → certification sa President → certification sa D.A. → Cleared ug ma-print ang certificate.",
      can("disposals") ? `<button class="btn primary" id="new-disp">Bag-ong disposal</button>` : ""
    ) +
    `<div class="ledger">
      <div><div class="fig">${num(rows.filter((d) => d.status === "for_president").length)}</div><div class="cap">Naghulat sa President</div></div>
      <div><div class="fig">${num(rows.filter((d) => d.status === "for_da").length)}</div><div class="cap">Naghulat sa D.A.</div></div>
      <div><div class="fig">${num(cleared.reduce((s, d) => s + d.total_heads, 0))}</div><div class="cap">Ulo nga na-dispose karong bulana</div></div>
      <div><div class="fig">${money(cleared.reduce((s, d) => s + Number(d.total_amount), 0))}</div><div class="cap">Kantidad sa baligya karong bulana</div></div>
    </div>
    <div class="filters">
      <label>Pangita<input type="search" id="f-q" placeholder="Member, buyer, control no…"></label>
      <label>Status<select id="f-status">${options(DISPOSAL_STATUS, "", "Tanan")}</select></label>
      <label>Gikan<input type="date" id="f-from"></label>
      <label>Hangtod<input type="date" id="f-to"></label>
    </div>
    <div class="panel table-wrap"><table>
      <thead><tr><th>Control no.</th><th>Petsa</th><th>Member</th><th>Gi-dispose</th><th>Buyer / Destinasyon</th><th class="num">Kantidad</th><th>Proseso</th><th></th></tr></thead>
      <tbody id="d-rows"></tbody>
    </table></div>`;

  const actionsFor = (d) => {
    const a = [];
    if (d.status === "for_president") {
      if (can("issueCert")) a.push(`<button class="btn small gold" data-act="issue">I-issue ang certification</button>`);
      else a.push(`<span class="muted small">Naghulat sa President</span>`);
    }
    if (d.assoc_cert_no) a.push(`<button class="btn small" data-act="print-assoc">Print cert. sa Assoc.</button>`);
    if (d.status === "for_da" && can("disposals")) a.push(`<button class="btn small primary" data-act="da">I-record ang D.A. cert.</button>`);
    if (d.status === "cleared") a.push(`<button class="btn small gold" data-act="print-disp">Print Certificate of Disposal</button>`);
    if (can("disposals") && ["for_president", "for_da"].includes(d.status)) {
      a.push(`<button class="btn small" data-act="edit">Usba</button>`, `<button class="btn small danger" data-act="cancel">Cancel</button>`);
    }
    return `<div class="actions">${a.join("")}</div>`;
  };

  const draw = () => {
    const q = state.q.toLowerCase();
    const list = rows.filter(
      (d) =>
        (!state.status || d.status === state.status) &&
        (!state.from || d.disposal_date >= state.from) &&
        (!state.to || d.disposal_date <= state.to) &&
        (!q || [d.control_no, d.buyer_name, fullName(mm[d.member_id]), d.destination_name].join(" ").toLowerCase().includes(q))
    );
    document.getElementById("d-rows").innerHTML = list.length
      ? list
          .map(
            (d) => `<tr data-id="${d.id}">
          <td><span class="memno">${esc(d.control_no)}</span></td>
          <td>${esc(fmtShort(d.disposal_date))}</td>
          <td><a href="#member/${d.member_id}">${esc(fullName(mm[d.member_id]))}</a></td>
          <td>${esc(herdSummary(d, "qty_"))}<div class="muted small">${num(d.total_heads)} ulo${d.total_weight_kg ? " · " + num(d.total_weight_kg) + " kg" : ""}</div></td>
          <td>${esc(d.buyer_name)}<div class="muted small">${esc(Cert.destination(d))}</div></td>
          <td class="num">${money(d.total_amount)}</td>
          <td>${disposalSteps(d)}</td>
          <td>${actionsFor(d)}</td></tr>`
          )
          .join("")
      : emptyRow(8, rows.length ? "Walay nakit-an." : "Wala pay disposal nga na-record.");
  };
  draw();

  const bind = (id, key) => main.querySelector(id).addEventListener("input", (e) => ((state[key] = e.target.value), draw()));
  bind("#f-q", "q");
  bind("#f-status", "status");
  bind("#f-from", "from");
  bind("#f-to", "to");
  main.querySelector("#new-disp")?.addEventListener("click", () => disposalForm(null, members));

  main.querySelector("#d-rows").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const d = rows.find((x) => x.id === btn.closest("tr").dataset.id);
    const m = mm[d.member_id];
    const act = btn.dataset.act;
    if (act === "print-assoc") return printHTML(Cert.association(d, m, App.settings));
    if (act === "print-disp") return printHTML(Cert.disposal(d, m, App.settings));
    if (act === "edit") return disposalForm(d, members);
    if (act === "issue") return issueAssocCert(d, m);
    if (act === "da") return recordDA(d, m);
    if (act === "cancel") {
      if (!(await confirmBox(`I-cancel ang disposal <strong>${esc(d.control_no)}</strong>?`, "I-cancel"))) return;
      try {
        await db(App.sb.from("disposals").update({ status: "cancelled" }).eq("id", d.id));
        toast("Na-cancel.");
        App.render();
      } catch (err) {
        toast(errMsg(err), true);
      }
    }
  });
};

/* ---------- The disposal form ---------- */
async function disposalForm(d, members) {
  const isNew = !d;
  const active = members.filter((m) => m.status === "active");
  if (isNew && !active.length) return toast("Walay active member. Ang active members ra ang maka-dispose.", true);
  const herd = await loadCurrentHerd();
  d = d || { disposal_date: isoDate(), destination_type: "slaughterhouse", price_basis: "per_kilo" };

  const body = `
    <fieldset><legend>Member</legend>
      <div class="grid two">
        <label>Member *<select name="member_id" required ${isNew ? "" : "disabled"}>${memberOptions(active, d.member_id)}</select></label>
        <label>Petsa sa disposal<input type="date" name="disposal_date" value="${esc(d.disposal_date)}" required></label>
      </div>
      <p class="muted small" id="member-info"></p>
    </fieldset>
    <fieldset><legend>Update sa herd — pila kabook ang buhi karon</legend>
      ${herdInputs("herd_", d)}
    </fieldset>
    <fieldset><legend>Pila ang i-dispose</legend>
      ${herdInputs("qty_", d)}
      <p class="small" id="qty-check"></p>
    </fieldset>
    <fieldset><legend>Buyer</legend>
      <div class="grid">
        <label>Ngalan sa buyer *<input name="buyer_name" required value="${esc(d.buyer_name || "")}"></label>
        <label>Address sa buyer<input name="buyer_address" value="${esc(d.buyer_address || "")}"></label>
        <label>Contact sa buyer<input name="buyer_contact" value="${esc(d.buyer_contact || "")}"></label>
      </div>
    </fieldset>
    <fieldset><legend>Asa dalhon ang baboy</legend>
      <div class="grid">
        <label>Klase<select name="destination_type">${options(DEST_TYPES, d.destination_type)}</select></label>
        <label>Ngalan (slaughterhouse / tag-iya)<input name="destination_name" value="${esc(d.destination_name || "")}" placeholder="e.g. Lapu-Lapu City Slaughterhouse"></label>
        <label>Address<input name="destination_address" value="${esc(d.destination_address || "")}"></label>
      </div>
    </fieldset>
    <fieldset><legend>Presyo — pila ang kuha sa baboy</legend>
      <div class="grid">
        <label>Basehan<select name="price_basis">${options(PRICE_BASIS, d.price_basis)}</select></label>
        <label>Timbang (kg)<input type="number" step="0.01" min="0" name="total_weight_kg" value="${esc(d.total_weight_kg ?? "")}"></label>
        <label>Presyo kada kilo / ulo<input type="number" step="0.01" min="0" name="unit_price" value="${esc(d.unit_price ?? "")}"></label>
        <label>Total nga kantidad (₱) *<input type="number" step="0.01" min="0" name="total_amount" required value="${esc(d.total_amount ?? "")}"></label>
      </div>
    </fieldset>
    <label>Remarks<input name="remarks" value="${esc(d.remarks || "")}"></label>`;

  modal({
    title: isNew ? "Disposal form" : `Usba ang ${d.control_no}`,
    body,
    submitLabel: isNew ? "I-save ug ipadala sa President" : "I-save",
    onOpen: (el) => {
      const f = el.closest("form");
      const sel = f.elements.member_id;
      const info = el.querySelector("#member-info");
      const setMember = () => {
        const m = members.find((x) => x.id === sel.value);
        const h = herd[sel.value];
        info.textContent = m ? `${m.member_no} · ${memberAddress(m)} · ${m.contact_no || "walay contact"}` : "";
        if (isNew && h) HERD.forEach((x) => (f.elements["herd_" + x.k].value = h[x.k]));
        check();
      };
      const check = () => {
        const over = HERD.filter((x) => Number(f.elements["qty_" + x.k].value) > Number(f.elements["herd_" + x.k].value));
        const total = HERD.reduce((s, x) => s + Number(f.elements["qty_" + x.k].value || 0), 0);
        const out = el.querySelector("#qty-check");
        out.style.color = over.length ? "var(--danger)" : "";
        out.textContent = over.length
          ? "Sobra sa buhi: " + over.map((x) => x.label).join(", ")
          : `Total nga i-dispose: ${total} ulo`;
      };
      const calc = () => {
        const basis = f.elements.price_basis.value;
        const w = Number(f.elements.total_weight_kg.value || 0);
        const p = Number(f.elements.unit_price.value || 0);
        const heads = HERD.reduce((s, x) => s + Number(f.elements["qty_" + x.k].value || 0), 0);
        if (basis === "per_kilo" && w && p) f.elements.total_amount.value = (w * p).toFixed(2);
        if (basis === "per_head" && heads && p) f.elements.total_amount.value = (heads * p).toFixed(2);
      };
      sel.addEventListener("change", setMember);
      el.addEventListener("input", (e) => {
        if (/^(herd_|qty_)/.test(e.target.name)) check();
        if (["total_weight_kg", "unit_price", "price_basis"].includes(e.target.name) || /^qty_/.test(e.target.name)) calc();
      });
      f.elements.price_basis.addEventListener("change", calc);
      if (sel.value) setMember();
    },
    onSubmit: async (form) => {
      const o = formToObj(form);
      if (!isNew) delete o.member_id;
      const total = HERD.reduce((s, x) => s + (o["qty_" + x.k] || 0), 0);
      if (!total) {
        toast("Butangi og ihap kung pila ka baboy ang i-dispose.", true);
        return false;
      }
      if (HERD.some((x) => (o["qty_" + x.k] || 0) > (o["herd_" + x.k] || 0))) {
        toast("Mas daghan ang i-dispose kaysa sa buhi nga baboy.", true);
        return false;
      }
      if (isNew) {
        const saved = await db(App.sb.from("disposals").insert(o).select().single());
        toast(`Na-save: ${saved.control_no}. Sunod: certification sa President.`);
      } else {
        await db(App.sb.from("disposals").update(o).eq("id", d.id));
        toast("Na-save.");
      }
      App.render();
    },
  });
}

/* ---------- Step 1: Association certification (President) ---------- */
function issueAssocCert(d, m) {
  modal({
    title: "Certification sa President",
    body: `<p>I-issue ang Association Certification para kang <strong>${esc(displayName(m))}</strong> (${esc(m.member_no)})?</p>
      <dl class="dl">
        <dt>I-dispose</dt><dd>${esc(herdSummary(d, "qty_"))} (${num(d.total_heads)} ulo)</dd>
        <dt>Buyer</dt><dd>${esc(d.buyer_name)}</dd>
        <dt>Destinasyon</dt><dd>${esc(Cert.destination(d))}</dd>
      </dl>
      <label style="margin-top:1rem">Pirmahan sa (ngalan sa President)
        <input name="assoc_cert_by" value="${esc(App.settings.president_name || App.profile.full_name || "")}" required></label>
      <p class="muted small">Automatic ang certification number. Human niini, i-print ug dad-a sa member ngadto sa D.A.</p>`,
    submitLabel: "I-issue ug i-print",
    onSubmit: async (form) => {
      const o = formToObj(form);
      const saved = await db(
        App.sb.from("disposals").update({ assoc_cert_no: "AUTO", assoc_cert_date: isoDate(), assoc_cert_by: o.assoc_cert_by }).eq("id", d.id).select().single()
      );
      toast(`Na-issue: ${saved.assoc_cert_no}`);
      await App.render();
      printHTML(Cert.association(saved, m, App.settings));
    },
  });
}

/* ---------- Step 2: D.A. certification ---------- */
function recordDA(d, m) {
  modal({
    title: "Certification gikan sa D.A.",
    body: `<p>Isulod ang detalye sa certification nga gi-issue sa ${esc(App.settings.da_office || "D.A.")} para sa ${esc(d.control_no)}.</p>
      <div class="grid">
        <label>D.A. certification no. *<input name="da_cert_no" required></label>
        <label>Petsa *<input type="date" name="da_cert_date" value="${isoDate()}" required></label>
        <label>D.A. officer<input name="da_officer" placeholder="Ngalan sa nag-pirma"></label>
      </div>
      <p class="muted small">Inig save, ma-Cleared ang disposal, automatic nga maminusan ang herd sa member, ug ma-print ang Certificate of Disposal.</p>`,
    submitLabel: "I-save ug i-print",
    onSubmit: async (form) => {
      const o = formToObj(form);
      const saved = await db(App.sb.from("disposals").update(o).eq("id", d.id).select().single());
      toast(`${saved.control_no} — Cleared na.`);
      await App.render();
      printHTML(Cert.disposal(saved, m, App.settings));
    },
  });
}
