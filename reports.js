/* =============================================================
   REPORTS
   ============================================================= */
App.pages.reports = async function (main) {
  const y = new Date().getFullYear();
  main.innerHTML =
    pageHead("Reports", "Pili-a ang petsa, dayon i-print para sa meeting, sa D.A., o sa LGU.", `<button class="btn primary" id="print-rep">Print report</button>`) +
    `<div class="filters">
      <label>Gikan<input type="date" id="r-from" value="${y}-01-01"></label>
      <label>Hangtod<input type="date" id="r-to" value="${isoDate()}"></label>
      <label>Shortcut<select id="r-quick">
        <option value="">—</option><option value="month">Karong bulana</option><option value="lastmonth">Miaging bulan</option>
        <option value="quarter">Karong quarter</option><option value="year">Karong tuiga</option></select></label>
    </div>
    <div id="rep"></div>`;

  const from = main.querySelector("#r-from");
  const to = main.querySelector("#r-to");
  const run = async () => {
    const out = main.querySelector("#rep");
    out.innerHTML = `<p class="muted">Nag-load…</p>`;
    try {
      out.innerHTML = await buildReport(from.value, to.value);
    } catch (e) {
      out.innerHTML = `<p class="error">${esc(errMsg(e))}</p>`;
    }
  };
  main.querySelector("#r-quick").addEventListener("change", (e) => {
    const n = new Date();
    const v = e.target.value;
    if (v === "month") (from.value = monthStart(n)), (to.value = isoDate(n));
    if (v === "lastmonth") (from.value = isoDate(new Date(n.getFullYear(), n.getMonth() - 1, 1))), (to.value = isoDate(new Date(n.getFullYear(), n.getMonth(), 0)));
    if (v === "quarter") (from.value = isoDate(new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1))), (to.value = isoDate(n));
    if (v === "year") (from.value = `${n.getFullYear()}-01-01`), (to.value = isoDate(n));
    run();
  });
  from.addEventListener("change", run);
  to.addEventListener("change", run);
  main.querySelector("#print-rep").addEventListener("click", () =>
    printHTML(Cert.report("Association report", `${fmtDate(from.value)} – ${fmtDate(to.value)}`, main.querySelector("#rep").innerHTML, App.settings))
  );
  run();
};

async function buildReport(from, to) {
  const sb = App.sb;
  const [members, herd, disposals, txns, meetings] = await Promise.all([
    loadMembers(),
    db(sb.from("v_current_herd").select("*")),
    db(sb.from("disposals").select("*").eq("status", "cleared").gte("disposal_date", from).lte("disposal_date", to).order("disposal_date")),
    db(sb.from("transactions").select("*").gte("txn_date", from).lte("txn_date", to)),
    db(sb.from("meetings").select("*, attendance(status)").gte("meeting_date", from).lte("meeting_date", to).order("meeting_date")),
  ]);
  const mm = Object.fromEntries(members.map((m) => [m.id, m]));
  const active = members.filter((m) => m.status === "active");
  const newMembers = members.filter((m) => m.membership_date && m.membership_date >= from && m.membership_date <= to);

  // Membership by barangay
  const byBrgy = {};
  for (const m of active) byBrgy[m.barangay || "(walay barangay)"] = (byBrgy[m.barangay || "(walay barangay)"] || 0) + 1;

  // Herd inventory (current)
  const activeHerd = herd.filter((h) => mm[h.member_id]?.status === "active");
  const herdTot = Object.fromEntries(HERD.map((h) => [h.k, activeHerd.reduce((s, x) => s + x[h.k], 0)]));

  // Disposals
  const dispTot = Object.fromEntries(HERD.map((h) => [h.k, disposals.reduce((s, d) => s + d["qty_" + h.k], 0)]));
  const byDest = {};
  for (const d of disposals) {
    const k = DEST_TYPES[d.destination_type];
    byDest[k] ||= { heads: 0, amount: 0, n: 0 };
    byDest[k].heads += d.total_heads;
    byDest[k].amount += Number(d.total_amount);
    byDest[k].n++;
  }
  const salesTotal = disposals.reduce((s, d) => s + Number(d.total_amount), 0);

  // Finance
  const catRows = (type) =>
    Object.entries(type === "income" ? INCOME_CATS : EXPENSE_CATS)
      .map(([k, label]) => {
        const it = txns.filter((t) => t.category === k);
        return { label, cash: it.filter((t) => !t.is_in_kind).reduce((s, t) => s + Number(t.amount), 0), kind: it.filter((t) => t.is_in_kind).reduce((s, t) => s + Number(t.amount), 0) };
      })
      .filter((r) => r.cash || r.kind);
  const inc = catRows("income");
  const exp = catRows("expense");
  const sum = (r, k) => r.reduce((s, x) => s + x[k], 0);

  return `
  <div class="panel"><h2>1. Membership</h2>
    <table><tbody>
      <tr><td>Active members</td><td class="num">${num(active.length)}</td></tr>
      <tr><td>Bag-ong members niini nga panahon</td><td class="num">${num(newMembers.length)}</td></tr>
      <tr><td>Applicants (wala pa ma-approve)</td><td class="num">${num(members.filter((m) => m.status === "applicant").length)}</td></tr>
      <tr><td>Pioneer members (active)</td><td class="num">${num(active.filter((m) => m.is_pioneer).length)}</td></tr>
      <tr><td>Inactive / resigned</td><td class="num">${num(members.filter((m) => ["inactive", "resigned"].includes(m.status)).length)}</td></tr>
    </tbody></table>
    <h3 style="margin-top:1rem">Active members matag barangay</h3>
    <table><tbody>${Object.entries(byBrgy).sort((a, b) => b[1] - a[1]).map(([b, n]) => `<tr><td>${esc(b)}</td><td class="num">${n}</td></tr>`).join("") || emptyRow(2, "Wala")}</tbody></table>
  </div>

  <div class="panel"><h2>2. Swine inventory karon (active members)</h2>
    <table><thead><tr>${HERD.map((h) => `<th class="num">${h.label} (${h.en})</th>`).join("")}<th class="num">Total</th></tr></thead>
    <tbody><tr>${HERD.map((h) => `<td class="num">${num(herdTot[h.k])}</td>`).join("")}<td class="num"><strong>${num(herdTotal(herdTot))}</strong></td></tr></tbody></table>
  </div>

  <div class="panel"><h2>3. Disposal / Sales (cleared)</h2>
    <table><thead><tr>${HERD.map((h) => `<th class="num">${h.label}</th>`).join("")}<th class="num">Total ulo</th><th class="num">Kantidad</th></tr></thead>
    <tbody><tr>${HERD.map((h) => `<td class="num">${num(dispTot[h.k])}</td>`).join("")}<td class="num">${num(herdTotal(dispTot))}</td><td class="num"><strong>${money(salesTotal)}</strong></td></tr></tbody></table>
    <h3 style="margin-top:1rem">Asa gidala</h3>
    <table><thead><tr><th>Destinasyon</th><th class="num">Disposals</th><th class="num">Ulo</th><th class="num">Kantidad</th></tr></thead>
    <tbody>${Object.entries(byDest).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${v.n}</td><td class="num">${v.heads}</td><td class="num">${money(v.amount)}</td></tr>`).join("") || emptyRow(4, "Walay cleared nga disposal.")}</tbody></table>
    <h3 style="margin-top:1rem">Detalye</h3>
    <div class="table-wrap"><table><thead><tr><th>Control no.</th><th>Petsa</th><th>Member</th><th>Gi-dispose</th><th>Buyer</th><th>Destinasyon</th><th>D.A. cert.</th><th class="num">Kantidad</th></tr></thead>
    <tbody>${disposals
      .map(
        (d) => `<tr><td>${esc(d.control_no)}</td><td>${esc(fmtShort(d.disposal_date))}</td><td>${esc(fullName(mm[d.member_id]))}</td>
        <td>${esc(herdSummary(d, "qty_"))}</td><td>${esc(d.buyer_name)}</td><td>${esc(Cert.destination(d))}</td><td>${esc(d.da_cert_no)}</td><td class="num">${money(d.total_amount)}</td></tr>`
      )
      .join("") || emptyRow(8, "Wala")}</tbody></table></div>
  </div>

  <div class="panel"><h2>4. Finance</h2>
    <div class="cols">
      <table><thead><tr><th>Income</th><th class="num">Cash</th><th class="num">In-kind</th></tr></thead>
        <tbody>${inc.map((r) => `<tr><td>${esc(r.label)}</td><td class="num">${money(r.cash)}</td><td class="num">${money(r.kind)}</td></tr>`).join("") || emptyRow(3, "Wala")}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${money(sum(inc, "cash"))}</td><td class="num">${money(sum(inc, "kind"))}</td></tr></tfoot></table>
      <table><thead><tr><th>Gasto</th><th class="num">Cash</th><th class="num">In-kind</th></tr></thead>
        <tbody>${exp.map((r) => `<tr><td>${esc(r.label)}</td><td class="num">${money(r.cash)}</td><td class="num">${money(r.kind)}</td></tr>`).join("") || emptyRow(3, "Wala")}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${money(sum(exp, "cash"))}</td><td class="num">${money(sum(exp, "kind"))}</td></tr></tfoot></table>
    </div>
    <p style="margin-top:.8rem"><strong>Net cash niini nga panahon: ${money(sum(inc, "cash") - sum(exp, "cash"))}</strong></p>
  </div>

  <div class="panel"><h2>5. Meetings ug attendance</h2>
    <table><thead><tr><th>Petsa</th><th>Meeting</th><th class="num">Present</th><th class="num">Late</th><th class="num">Excused</th><th class="num">Absent</th></tr></thead>
    <tbody>${meetings
      .map((m) => {
        const c = (s) => m.attendance.filter((a) => a.status === s).length;
        return `<tr><td>${esc(fmtShort(m.meeting_date))}</td><td>${esc(m.title)}</td><td class="num">${c("present")}</td><td class="num">${c("late")}</td><td class="num">${c("excused")}</td><td class="num">${c("absent")}</td></tr>`;
      })
      .join("") || emptyRow(6, "Walay meeting")}</tbody></table>
  </div>`;
}
