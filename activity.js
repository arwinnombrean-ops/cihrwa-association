/* =============================================================
   ACTIVITY & REWARDS
   ============================================================= */
App.pages.activity = async function (main) {
  const [act, members, rewards] = await Promise.all([
    db(App.sb.from("v_member_activity").select("*")),
    loadMembers(),
    db(App.sb.from("rewards").select("*").order("award_date", { ascending: false })),
  ]);
  const mm = Object.fromEntries(members.map((m) => [m.id, m]));
  const s = App.settings;
  const year = String(new Date().getFullYear());
  const rows = act.map((a) => ({ ...a, m: mm[a.member_id] })).filter((a) => a.m);
  rows.sort((a, b) => (b.attendance_rate ?? -1) - (a.attendance_rate ?? -1) || fullName(a.m).localeCompare(fullName(b.m)));
  const cats = ["Very Active", "Active", "Less Active", "Inactive", "New"];
  const count = (c) => rows.filter((r) => r.activity_category === c).length;

  const gotThisYear = (id, type) => rewards.some((r) => r.member_id === id && r.award_type === type && r.award_date.startsWith(year));
  const gotEver = (id, type) => rewards.some((r) => r.member_id === id && r.award_type === type);
  const qualified = [];
  for (const r of rows) {
    if (r.m.is_pioneer && !gotEver(r.member_id, "pioneer")) qualified.push({ r, type: "pioneer", why: "Pioneer member" });
    if (r.activity_category === "Very Active" && !gotThisYear(r.member_id, "very_active"))
      qualified.push({ r, type: "very_active", why: `Very Active (${r.attendance_rate}%)` });
    if (r.attendance_rate === 100 && r.meetings_held >= 3 && r.late === 0 && !gotThisYear(r.member_id, "perfect_attendance"))
      qualified.push({ r, type: "perfect_attendance", why: `Perfect attendance (${r.attended} meetings, walay late)` });
  }

  main.innerHTML =
    pageHead(
      "Activity & Rewards",
      `Base sa attendance sukad nahimong member (excused dili maihap). Very Active ≥ ${s.very_active_threshold}% · Active ≥ ${s.active_threshold}% · Less Active ≥ ${s.less_active_threshold}% · ubos ana Inactive.`,
      `<button class="btn" id="print-act">Print listahan</button>`
    ) +
    `<div class="ledger">${cats.map((c) => `<div><div class="fig">${count(c)}</div><div class="cap">${activityBadge(c)}</div></div>`).join("")}
      <div><div class="fig">${rows.filter((r) => r.m.is_pioneer).length}</div><div class="cap"><span class="badge b-gold">Pioneers</span></div></div></div>

    <div class="panel"><h2>Qualified sa reward (${qualified.length})</h2>
      <p class="muted small">Pioneers nga wala pa nahatagi, ug Very Active / Perfect attendance nga wala pa nahatagi karong ${year}.</p>
      <div class="table-wrap"><table><thead><tr><th>Member</th><th>Rason</th><th></th></tr></thead>
      <tbody id="q-rows">${
        qualified
          .map(
            (q, i) => `<tr><td><a href="#member/${q.r.member_id}">${esc(fullName(q.r.m))}</a> <span class="muted small">${esc(q.r.m.member_no)}</span></td>
          <td>${esc(q.why)}</td>
          <td>${can("rewards") ? `<button class="btn small gold" data-q="${i}">Hatagi og reward</button>` : ""}</td></tr>`
          )
          .join("") || emptyRow(3, "Walay qualified karon.")
      }</tbody></table></div>
    </div>

    <div class="panel">
      <div class="filters"><label>Category<select id="f-cat">${options(Object.fromEntries(cats.map((c) => [c, c])), "", "Tanan")}</select></label>
        <label class="check" style="align-self:center"><input type="checkbox" id="f-pioneer"> Pioneers ra</label></div>
      <div class="table-wrap"><table id="act-table">
        <thead><tr><th>Member</th><th class="num">Meetings</th><th class="num">Mitambong</th><th class="num">Late</th><th class="num">Excused</th><th class="num">Absent</th><th class="num">Rate</th><th>Category</th><th class="num">Rewards</th><th></th></tr></thead>
        <tbody id="a-rows"></tbody></table></div>
    </div>

    <div class="panel"><h2>Rewards nga nahatag</h2>
      <div class="table-wrap"><table><thead><tr><th>Petsa</th><th>Member</th><th>Reward</th><th>Klase</th><th class="num">Value</th><th>Gihatag ni</th><th></th></tr></thead>
      <tbody id="r-rows">${
        rewards
          .map(
            (r) => `<tr data-id="${r.id}"><td>${esc(fmtShort(r.award_date))}</td><td>${esc(fullName(mm[r.member_id]))}</td><td>${esc(r.title)}${
              r.description ? `<div class="muted small">${esc(r.description)}</div>` : ""
            }</td><td>${esc(AWARD_TYPES[r.award_type])}</td><td class="num">${r.value ? money(r.value) : "—"}</td><td>${esc(r.given_by)}</td>
            <td>${can("delete") ? `<button class="btn small danger" data-del>Papasa</button>` : ""}</td></tr>`
          )
          .join("") || emptyRow(7, "Wala pay reward nga nahatag.")
      }</tbody></table></div>
    </div>`;

  const state = { cat: "", pioneer: false };
  const draw = () => {
    const list = rows.filter((r) => (!state.cat || r.activity_category === state.cat) && (!state.pioneer || r.m.is_pioneer));
    main.querySelector("#a-rows").innerHTML =
      list
        .map(
          (r) => `<tr data-id="${r.member_id}">
        <td><a href="#member/${r.member_id}">${esc(fullName(r.m))}</a> ${r.m.is_pioneer ? '<span class="badge b-gold">Pioneer</span>' : ""}</td>
        <td class="num">${r.meetings_held}</td><td class="num">${r.attended}</td><td class="num">${r.late}</td>
        <td class="num">${r.excused}</td><td class="num">${r.absences}</td>
        <td class="num"><strong>${r.attendance_rate ?? "—"}${r.attendance_rate != null ? "%" : ""}</strong></td>
        <td>${activityBadge(r.activity_category)}</td>
        <td class="num">${rewards.filter((x) => x.member_id === r.member_id).length}</td>
        <td>${can("rewards") ? `<button class="btn small" data-give>Reward</button>` : ""}</td></tr>`
        )
        .join("") || emptyRow(10, "Walay active member niini nga category.");
  };
  draw();
  main.querySelector("#f-cat").addEventListener("change", (e) => ((state.cat = e.target.value), draw()));
  main.querySelector("#f-pioneer").addEventListener("change", (e) => ((state.pioneer = e.target.checked), draw()));

  main.querySelector("#q-rows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-q]");
    if (!b) return;
    const q = qualified[Number(b.dataset.q)];
    rewardForm(q.r.m, q.type, q.why);
  });
  main.querySelector("#a-rows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-give]");
    if (b) rewardForm(mm[b.closest("tr").dataset.id]);
  });
  main.querySelector("#r-rows").addEventListener("click", async (e) => {
    if (!e.target.closest("[data-del]")) return;
    if (!(await confirmBox("Papason ni nga reward record?", "Papasa"))) return;
    await db(App.sb.from("rewards").delete().eq("id", e.target.closest("tr").dataset.id));
    toast("Napapas.");
    App.render();
  });
  main.querySelector("#print-act").addEventListener("click", () => {
    const t = main.querySelector("#act-table").outerHTML.replace(/<button[^>]*>.*?<\/button>/g, "");
    printHTML(Cert.report("Member activity report", `Hangtod ${fmtDate(new Date())}`, t, App.settings));
  });
};

function rewardForm(m, type = "very_active", why = "") {
  modal({
    title: `Reward para kang ${displayName(m)}`,
    body: `<div class="grid">
        <label>Klase<select name="award_type">${options(AWARD_TYPES, type)}</select></label>
        <label>Titulo *<input name="title" required value="${esc(why ? AWARD_TYPES[type] + " " + new Date().getFullYear() : "")}"></label>
        <label>Petsa<input type="date" name="award_date" value="${isoDate()}"></label>
        <label>Value (₱)<input type="number" step="0.01" min="0" name="value" placeholder="kung naay cash o butang"></label>
        <label>Gihatag ni<input name="given_by" value="${esc(App.settings.president_name || "")}"></label>
      </div>
      <label style="margin-top:.9rem">Detalye<input name="description" value="${esc(why)}" placeholder="e.g. 1 sako feeds, certificate of recognition"></label>
      <p class="muted small">Kung naay gasto ang reward, i-record usab sa Finance ubos sa “Rewards / incentives”.</p>`,
    submitLabel: "I-save ang reward",
    onSubmit: async (form) => {
      const o = formToObj(form);
      await db(App.sb.from("rewards").insert({ ...o, value: o.value || 0, member_id: m.id }));
      toast("Na-save ang reward.");
      App.render();
    },
  });
}
