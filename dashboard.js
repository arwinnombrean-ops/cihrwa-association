/* =============================================================
   DASHBOARD
   ============================================================= */
App.pages.dashboard = async function (main) {
  const sb = App.sb;
  const [members, herd, disposals, txns, dues, meetings] = await Promise.all([
    loadMembers(),
    db(sb.from("v_current_herd").select("*")),
    db(sb.from("disposals").select("*").neq("status", "cancelled").order("disposal_date", { ascending: false })),
    db(sb.from("transactions").select("txn_type,amount,is_in_kind,audited")),
    db(sb.from("v_dues_status").select("*")),
    db(sb.from("meetings").select("*, attendance(status)").order("meeting_date", { ascending: false }).limit(3)),
  ]);
  const mm = Object.fromEntries(members.map((m) => [m.id, m]));
  const active = members.filter((m) => m.status === "active");
  const applicants = members.filter((m) => m.status === "applicant");
  const herdTot = herd.filter((h) => mm[h.member_id]?.status === "active").reduce((s, h) => s + h.total, 0);
  const cash = txns.filter((t) => !t.is_in_kind).reduce((s, t) => s + (t.txn_type === "income" ? 1 : -1) * Number(t.amount), 0);
  const forPres = disposals.filter((d) => d.status === "for_president");
  const forDA = disposals.filter((d) => d.status === "for_da");
  const behind = dues.filter((d) => d.months_unpaid >= 3);
  const unaudited = txns.filter((t) => !t.audited).length;
  const ready = applicants.filter((m) => m.orientation_completed);

  const todo = [];
  if (ready.length && can("members")) todo.push(`<li><a href="#members">${ready.length} ka applicant</a> nahuman na og orientation — andam na i-approve.</li>`);
  if (applicants.length - ready.length > 0) todo.push(`<li>${applicants.length - ready.length} ka applicant wala pa ma-orientation.</li>`);
  if (forPres.length) todo.push(`<li><a href="#disposals">${forPres.length} ka disposal</a> naghulat sa certification sa President.</li>`);
  if (forDA.length) todo.push(`<li><a href="#disposals">${forDA.length} ka disposal</a> naghulat sa certification sa D.A.</li>`);
  if (behind.length) todo.push(`<li><a href="#finance/dues">${behind.length} ka member</a> naay 3 ka bulan o labaw nga wala mabayri nga dues.</li>`);
  if (unaudited && can("audit")) todo.push(`<li><a href="#finance">${unaudited} ka transaction</a> wala pa ma-audit.</li>`);

  const hr = new Date().getHours();
  const greet = hr < 12 ? "Maayong buntag" : hr < 18 ? "Maayong hapon" : "Maayong gabii";

  main.innerHTML =
    pageHead(`${greet}, ${App.profile.full_name || ROLES[App.profile.role]}`, `${esc(App.settings.association_name)} · ${esc(fmtDate(new Date()))}`) +
    `<div class="ledger">
      <div><div class="fig">${num(active.length)}</div><div class="cap">Active members</div></div>
      <div><div class="fig">${num(applicants.length)}</div><div class="cap">Applicants</div></div>
      <div><div class="fig">${num(herdTot)}</div><div class="cap">Baboy sa tanang members</div></div>
      <div><div class="fig ${cash < 0 ? "neg" : ""}">${money(cash)}</div><div class="cap">Cash on hand</div></div>
    </div>
    <div class="cols">
      <div class="panel"><h2>Buhatonon</h2>${todo.length ? `<ul>${todo.join("")}</ul>` : `<p class="muted">Walay nagpaabot. Limpyo tanan.</p>`}</div>
      <div class="panel"><h2>Bag-ong meetings</h2>
        <table><tbody>${
          meetings
            .map((m) => {
              const inn = m.attendance.filter((a) => ["present", "late"].includes(a.status)).length;
              return `<tr class="clickable" onclick="go('meeting/${m.id}')"><td>${esc(fmtShort(m.meeting_date))}</td><td>${esc(m.title)}</td>
              <td class="num">${m.attendance.length ? `${inn}/${m.attendance.length}` : '<span class="badge b-gold">Wala pa ma-check</span>'}</td></tr>`;
            })
            .join("") || emptyRow(3, `Wala pay meeting. <a href="#meetings">Paghimo og meeting</a>.`)
        }</tbody></table>
      </div>
    </div>
    <div class="panel"><h2>Bag-ong disposals</h2><div class="table-wrap">
      <table><thead><tr><th>Control no.</th><th>Petsa</th><th>Member</th><th class="num">Ulo</th><th>Buyer</th><th class="num">Kantidad</th><th>Status</th></tr></thead>
      <tbody>${
        disposals
          .slice(0, 8)
          .map(
            (d) => `<tr><td class="memno">${esc(d.control_no)}</td><td>${esc(fmtShort(d.disposal_date))}</td><td>${esc(fullName(mm[d.member_id]))}</td>
          <td class="num">${num(d.total_heads)}</td><td>${esc(d.buyer_name)}</td><td class="num">${money(d.total_amount)}</td><td>${disposalBadge(d.status)}</td></tr>`
          )
          .join("") || emptyRow(7, "Wala pay disposal.")
      }</tbody></table></div></div>`;
};
