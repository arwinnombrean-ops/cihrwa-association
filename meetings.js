/* =============================================================
   MEETINGS & ATTENDANCE
   ============================================================= */
App.pages.meetings = async function (main) {
  const [meetings, att, members] = await Promise.all([
    db(App.sb.from("meetings").select("*").order("meeting_date", { ascending: false })),
    db(App.sb.from("attendance").select("meeting_id,status")),
    loadMembers("active"),
  ]);
  const stats = {};
  for (const a of att) {
    const s = (stats[a.meeting_id] ||= { in: 0, total: 0 });
    s.total++;
    if (a.status === "present" || a.status === "late") s.in++;
  }

  main.innerHTML =
    pageHead(
      "Meetings",
      `Attendance sa matag meeting. ${num(members.length)} ka active members karon.`,
      can("meetings") ? `<button class="btn primary" id="new-meeting">Bag-ong meeting</button>` : ""
    ) +
    `<div class="panel table-wrap"><table>
      <thead><tr><th>Petsa</th><th>Meeting</th><th>Klase</th><th>Venue</th><th class="num">Mitambong</th><th></th></tr></thead>
      <tbody>${
        meetings
          .map((m) => {
            const s = stats[m.id];
            return `<tr class="clickable" data-id="${m.id}">
          <td>${esc(fmtShort(m.meeting_date))}${m.start_time ? `<div class="muted small">${esc(m.start_time.slice(0, 5))}</div>` : ""}</td>
          <td><strong>${esc(m.title)}</strong></td>
          <td>${esc(MEETING_TYPES[m.meeting_type])}</td>
          <td>${esc(m.venue)}</td>
          <td class="num">${s ? `${s.in} / ${s.total}` : '<span class="badge b-gold">Wala pa ma-check</span>'}</td>
          <td><button class="btn small">Attendance</button></td></tr>`;
          })
          .join("") || emptyRow(6, "Wala pay meeting. I-klik ang “Bag-ong meeting”.")
      }</tbody></table></div>`;

  main.querySelector("tbody").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) go("meeting/" + tr.dataset.id);
  });
  main.querySelector("#new-meeting")?.addEventListener("click", () => meetingForm());
};

function meetingForm(m) {
  const isNew = !m;
  m = m || { meeting_date: isoDate(), meeting_type: "regular", title: "Regular monthly meeting" };
  modal({
    title: isNew ? "Bag-ong meeting" : "Usba ang meeting",
    body: `<div class="grid">
        <label>Titulo *<input name="title" required value="${esc(m.title)}"></label>
        <label>Klase<select name="meeting_type">${options(MEETING_TYPES, m.meeting_type)}</select></label>
        <label>Petsa *<input type="date" name="meeting_date" required value="${esc(m.meeting_date)}"></label>
        <label>Oras<input type="time" name="start_time" value="${esc((m.start_time || "").slice(0, 5))}"></label>
        <label>Venue<input name="venue" value="${esc(m.venue || "")}"></label>
      </div>
      <label style="margin-top:.9rem">Agenda<textarea name="agenda">${esc(m.agenda || "")}</textarea></label>
      <label style="margin-top:.9rem">Minutes<textarea name="minutes" style="min-height:140px">${esc(m.minutes || "")}</textarea></label>`,
    onSubmit: async (form) => {
      const o = formToObj(form);
      o.start_time = o.start_time || null;
      if (isNew) {
        const saved = await db(App.sb.from("meetings").insert(o).select().single());
        toast("Na-save. I-check na ang attendance.");
        go("meeting/" + saved.id);
      } else {
        await db(App.sb.from("meetings").update(o).eq("id", m.id));
        toast("Na-save.");
        App.render();
      }
    },
  });
}

App.pages.meeting = async function (main, id) {
  const [mt, att, allMembers] = await Promise.all([
    db(App.sb.from("meetings").select("*").eq("id", id).single()),
    db(App.sb.from("attendance").select("*").eq("meeting_id", id)),
    loadMembers(),
  ]);
  const isOrientation = mt.meeting_type === "orientation";
  const recorded = Object.fromEntries(att.map((a) => [a.member_id, a.status]));
  // Active members nga member na sa petsa sa meeting (o naa nay record); applicants apil kung orientation
  const list = allMembers.filter(
    (m) =>
      recorded[m.id] ||
      (m.status === "active" && (m.membership_date || m.application_date) <= mt.meeting_date) ||
      (isOrientation && m.status === "applicant")
  );
  const editable = can("meetings");

  main.innerHTML = `<p><a href="#meetings">← Meetings</a></p>
    ${pageHead(
      mt.title,
      `${esc(fmtDate(mt.meeting_date))}${mt.start_time ? " · " + esc(mt.start_time.slice(0, 5)) : ""}${mt.venue ? " · " + esc(mt.venue) : ""} · ${esc(MEETING_TYPES[mt.meeting_type])}`,
      `${editable ? `<button class="btn" id="edit">Usba</button>` : ""}
       <button class="btn" id="print-sheet">Print attendance sheet</button>
       ${can("delete") ? `<button class="btn danger" id="del">Papasa</button>` : ""}`
    )}
    ${mt.agenda || mt.minutes ? `<div class="cols">
      ${mt.agenda ? `<div class="panel"><h2>Agenda</h2><p style="white-space:pre-wrap">${esc(mt.agenda)}</p></div>` : ""}
      ${mt.minutes ? `<div class="panel"><h2>Minutes</h2><p style="white-space:pre-wrap">${esc(mt.minutes)}</p></div>` : ""}
    </div>` : ""}
    <div class="panel">
      <div class="page-head" style="margin-bottom:.5rem"><h2 style="margin:0">Attendance</h2>
        <div class="actions" id="att-summary"></div></div>
      ${isOrientation ? `<p class="muted small">Orientation ni: ang applicants nga i-mark nga Present/Late automatic nga ma-check nga nahuman ang orientation.</p>` : ""}
      ${editable ? `<div class="actions" style="margin-bottom:.75rem">
        <button class="btn small" data-all="present">Tanan Present</button>
        <button class="btn small" data-all="absent">Tanan Absent</button></div>` : ""}
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Member</th><th>Status</th></tr></thead>
        <tbody>${
          list
            .map(
              (m, i) => `<tr><td>${i + 1}</td>
          <td>${esc(fullName(m))} <span class="muted small">${esc(m.member_no || "applicant")}</span></td>
          <td><div class="att-opts">${Object.entries(ATT_STATUS)
            .map(
              ([k, v]) => `<label><input type="radio" name="a_${m.id}" value="${k}" ${recorded[m.id] === k ? "checked" : ""} ${
                editable ? "" : "disabled"
              }> ${v}</label>`
            )
            .join("")}</div></td></tr>`
            )
            .join("") || emptyRow(3, "Walay active member niining petsaha.")
        }</tbody></table></div>
      ${editable && list.length ? `<div class="actions" style="margin-top:1rem"><button class="btn primary" id="save-att">I-save ang attendance</button></div>` : ""}
    </div>`;

  const summary = () => {
    const c = { present: 0, late: 0, excused: 0, absent: 0, none: 0 };
    for (const m of list) {
      const r = main.querySelector(`input[name="a_${m.id}"]:checked`);
      c[r ? r.value : "none"]++;
    }
    main.querySelector("#att-summary").innerHTML =
      `<span class="badge b-green">${c.present} present</span><span class="badge b-gold">${c.late} late</span>` +
      `<span class="badge b-blue">${c.excused} excused</span><span class="badge b-red">${c.absent} absent</span>` +
      (c.none ? `<span class="badge b-grey">${c.none} wala pa ma-check</span>` : "");
  };
  summary();
  main.addEventListener("change", (e) => e.target.name?.startsWith("a_") && summary());
  main.querySelectorAll("[data-all]").forEach((b) =>
    b.addEventListener("click", () => {
      list.forEach((m) => {
        const r = main.querySelector(`input[name="a_${m.id}"][value="${b.dataset.all}"]`);
        if (r) r.checked = true;
      });
      summary();
    })
  );

  main.querySelector("#save-att")?.addEventListener("click", async (e) => {
    const rows = list
      .map((m) => {
        const r = main.querySelector(`input[name="a_${m.id}"]:checked`);
        return r ? { meeting_id: id, member_id: m.id, status: r.value } : null;
      })
      .filter(Boolean);
    if (!rows.length) return toast("Walay na-check nga attendance.", true);
    e.target.disabled = true;
    try {
      await db(App.sb.from("attendance").upsert(rows, { onConflict: "meeting_id,member_id" }));
      if (isOrientation) {
        const done = rows.filter((r) => ["present", "late"].includes(r.status)).map((r) => r.member_id);
        const toMark = allMembers.filter((m) => done.includes(m.id) && !m.orientation_completed).map((m) => m.id);
        if (toMark.length)
          await db(App.sb.from("members").update({ orientation_completed: true, orientation_date: mt.meeting_date }).in("id", toMark));
      }
      toast(`Na-save ang attendance (${rows.length}).`);
      App.render();
    } catch (err) {
      toast(errMsg(err), true);
      e.target.disabled = false;
    }
  });

  main.querySelector("#edit")?.addEventListener("click", () => meetingForm(mt));
  main.querySelector("#del")?.addEventListener("click", async () => {
    if (!(await confirmBox("Papason ni nga meeting ug ang attendance niini?", "Papasa"))) return;
    await db(App.sb.from("meetings").delete().eq("id", id));
    toast("Napapas.");
    go("meetings");
  });
  main.querySelector("#print-sheet").addEventListener("click", () => {
    const inner = `<table style="width:100%"><thead><tr><th>#</th><th>Member ID</th><th>Ngalan</th><th>Status</th><th style="width:35%">Pirma</th></tr></thead>
      <tbody>${list
        .map((m, i) => `<tr><td>${i + 1}</td><td>${esc(m.member_no || "")}</td><td>${esc(fullName(m))}</td><td>${esc(ATT_STATUS[recorded[m.id]] || "")}</td><td style="height:9mm"></td></tr>`)
        .join("")}</tbody></table>`;
    printHTML(Cert.report("Attendance sheet", `${mt.title} · ${fmtDate(mt.meeting_date)}${mt.venue ? " · " + mt.venue : ""}`, inner, App.settings));
  });
};
