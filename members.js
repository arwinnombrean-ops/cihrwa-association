/* =============================================================
   MEMBERS
   ============================================================= */
App.pages.members = async function (main) {
  const [members, herd] = await Promise.all([loadMembers(), loadCurrentHerd()]);
  const state = { q: "", status: "" };

  main.innerHTML =
    pageHead(
      "Members",
      "Listahan sa tanang members ug applicants.",
      (can("members") ? `<button class="btn primary" id="new-member">Bag-ong member</button>` : "") +
        `<button class="btn" id="print-ids">Print ID cards</button>`
    ) +
    `<div class="filters">
      <label>Pangita<input type="search" id="f-q" placeholder="Ngalan, Member ID, barangay…"></label>
      <label>Status<select id="f-status">${options(MEMBER_STATUS, "", "Tanan")}</select></label>
    </div>
    <div class="panel table-wrap"><table>
      <thead><tr><th>Member ID</th><th>Ngalan</th><th>Address</th><th>Contact</th><th class="num">Baboy</th><th>Status</th></tr></thead>
      <tbody id="m-rows"></tbody>
    </table></div>`;

  const draw = () => {
    const q = state.q.toLowerCase();
    const rows = members.filter(
      (m) =>
        (!state.status || m.status === state.status) &&
        (!q || [fullName(m), m.member_no, memberAddress(m), m.contact_no].join(" ").toLowerCase().includes(q))
    );
    document.getElementById("m-rows").innerHTML = rows.length
      ? rows
          .map(
            (m) => `<tr class="clickable" data-id="${m.id}" tabindex="0">
          <td><span class="memno">${esc(m.member_no || "—")}</span></td>
          <td>${esc(fullName(m))} ${m.is_pioneer ? '<span class="badge b-gold">Pioneer</span>' : ""}</td>
          <td>${esc(memberAddress(m))}</td>
          <td>${esc(m.contact_no)}</td>
          <td class="num">${herd[m.id] ? num(herd[m.id].total) : "—"}</td>
          <td>${memberBadge(m.status)}</td></tr>`
          )
          .join("")
      : emptyRow(6, members.length ? "Walay nakit-an." : "Wala pay member. I-klik ang “Bag-ong member” aron magsugod.");
  };
  draw();

  main.querySelector("#f-q").addEventListener("input", (e) => ((state.q = e.target.value), draw()));
  main.querySelector("#f-status").addEventListener("change", (e) => ((state.status = e.target.value), draw()));
  main.querySelector("#m-rows").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) go("member/" + tr.dataset.id);
  });
  main.querySelector("#m-rows").addEventListener("keydown", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr && e.key === "Enter") go("member/" + tr.dataset.id);
  });
  main.querySelector("#new-member")?.addEventListener("click", () => memberForm());
  main.querySelector("#print-ids").addEventListener("click", () => {
    const act = members.filter((m) => m.status === "active");
    if (!act.length) return toast("Walay active member nga ma-print.", true);
    printHTML(`<div class="idcards">${act.map((m) => Cert.idCard(m, App.settings)).join("")}</div>`);
  });
};

/* ---------- Application / edit form ---------- */
function memberForm(m) {
  const isNew = !m;
  m = m || { orientation_completed: false, application_date: isoDate(), province: "", municipality: "" };
  const body = `
    <fieldset><legend>1. Orientation</legend>
      <p class="muted small">Kinahanglan mahuman una ang orientation mahitungod sa Association sa dili pa ma-approve isip member.</p>
      <div class="grid">
        <label class="check"><input type="checkbox" name="orientation_completed" ${m.orientation_completed ? "checked" : ""}> Nahuman na ang orientation</label>
        <label>Petsa sa orientation<input type="date" name="orientation_date" value="${esc(m.orientation_date || "")}"></label>
        <label>Gi-orient ni<input name="orientation_by" value="${esc(m.orientation_by || "")}" placeholder="Ngalan sa officer"></label>
      </div>
    </fieldset>
    <fieldset><legend>2. Personal nga detalye</legend>
      <div class="grid">
        <label>Apelyido *<input name="last_name" required value="${esc(m.last_name || "")}"></label>
        <label>Pangalan *<input name="first_name" required value="${esc(m.first_name || "")}"></label>
        <label>Middle name<input name="middle_name" value="${esc(m.middle_name || "")}"></label>
        <label>Suffix<input name="suffix" value="${esc(m.suffix || "")}" placeholder="Jr., Sr., III"></label>
        <label>Sex<select name="sex" data-nullable>${options({ Male: "Male", Female: "Female" }, m.sex, "—")}</select></label>
        <label>Birthdate<input type="date" name="birthdate" value="${esc(m.birthdate || "")}"></label>
        <label>Civil status<select name="civil_status" data-nullable>${options(
          { Single: "Single", Married: "Married", Widowed: "Widowed", Separated: "Separated" },
          m.civil_status,
          "—"
        )}</select></label>
        <label>Contact number<input name="contact_no" value="${esc(m.contact_no || "")}" inputmode="tel"></label>
        <label>Purok / Sitio<input name="purok" value="${esc(m.purok || "")}"></label>
        <label>Barangay<input name="barangay" value="${esc(m.barangay || "")}"></label>
        <label>Municipality / City<input name="municipality" value="${esc(m.municipality || "")}"></label>
        <label>Province<input name="province" value="${esc(m.province || "")}"></label>
        <label>Trabaho<input name="occupation" value="${esc(m.occupation || "")}"></label>
        <label>Emergency contact<input name="emergency_contact" value="${esc(m.emergency_contact || "")}" placeholder="Ngalan ug numero"></label>
        <label>Petsa sa aplikasyon<input type="date" name="application_date" value="${esc(m.application_date || isoDate())}"></label>
      </div>
    </fieldset>
    ${
      isNew
        ? `<fieldset><legend>3. Buhi nga baboy karon (pila kabook)</legend>${herdInputs("h_", {})}</fieldset>`
        : ""
    }
    <fieldset><legend>${isNew ? "4" : "3"}. Uban pa</legend>
      <div class="grid two">
        <label class="check"><input type="checkbox" name="is_pioneer" ${m.is_pioneer ? "checked" : ""}> Pioneer member (founding member)</label>
        <label>Remarks<input name="remarks" value="${esc(m.remarks || "")}"></label>
      </div>
    </fieldset>`;

  modal({
    title: isNew ? "Membership application form" : "Usba ang detalye sa member",
    body,
    submitLabel: isNew ? "I-save ang application" : "I-save",
    onSubmit: async (form) => {
      const o = formToObj(form);
      const herdRow = {};
      for (const h of HERD) {
        herdRow[h.k] = o["h_" + h.k] || 0;
        delete o["h_" + h.k];
      }
      if (o.orientation_completed && !o.orientation_date) o.orientation_date = isoDate();
      if (isNew) {
        const saved = await db(App.sb.from("members").insert({ ...o, status: "applicant" }).select().single());
        await db(App.sb.from("herd_updates").insert({ member_id: saved.id, ...herdRow, source: "application", notes: "Gikan sa application form" }));
        toast("Na-save ang application. I-approve kung andam na.");
        go("member/" + saved.id);
      } else {
        await db(App.sb.from("members").update(o).eq("id", m.id));
        toast("Na-save.");
        App.render();
      }
    },
  });
}

function herdForm(member, current) {
  modal({
    title: `Update sa herd — ${displayName(member)}`,
    body: `<p class="muted">Isulod ang tinuod nga ihap sa buhi nga baboy karon.</p>
      <label style="max-width:220px">Petsa<input type="date" name="record_date" value="${isoDate()}" required></label><br>
      ${herdInputs("", current || {})}
      <label style="margin-top:.8rem">Notes<input name="notes" placeholder="e.g. nanganak ang anay, 10 ka biik"></label>`,
    submitLabel: "I-save ang herd",
    onSubmit: async (form) => {
      const o = formToObj(form);
      await db(App.sb.from("herd_updates").insert({ member_id: member.id, ...o, source: "manual" }));
      toast("Na-update ang herd.");
      App.render();
    },
  });
}

/* ---------- Member profile ---------- */
App.pages.member = async function (main, id) {
  const sb = App.sb;
  const [m, herdRows, dues, activity, txns, att, rewards, disposals] = await Promise.all([
    db(sb.from("members").select("*").eq("id", id).single()),
    db(sb.from("herd_updates").select("*").eq("member_id", id).order("record_date", { ascending: false }).order("created_at", { ascending: false })),
    db(sb.from("v_dues_status").select("*").eq("member_id", id).maybeSingle()),
    db(sb.from("v_member_activity").select("*").eq("member_id", id).maybeSingle()),
    db(sb.from("transactions").select("*").eq("member_id", id).order("txn_date", { ascending: false })),
    db(sb.from("attendance").select("status, meetings(title, meeting_date)").eq("member_id", id)),
    db(sb.from("rewards").select("*").eq("member_id", id).order("award_date", { ascending: false })),
    db(sb.from("disposals").select("*").eq("member_id", id).order("disposal_date", { ascending: false })),
  ]);
  const cur = herdRows[0];
  att.sort((a, b) => (b.meetings?.meeting_date || "").localeCompare(a.meetings?.meeting_date || ""));

  const canEdit = can("members");
  const actions = [];
  if (canEdit) actions.push(`<button class="btn" id="edit">Usba</button>`, `<button class="btn" id="herd">Update herd</button>`);
  if (canEdit && m.status === "applicant") actions.push(`<button class="btn primary" id="approve">I-approve isip member</button>`);
  if (m.status === "active") {
    actions.push(`<button class="btn gold" id="print-cert">Print certificate</button>`, `<button class="btn" id="print-id">Print ID</button>`);
    if (canEdit) actions.push(`<button class="btn" id="deactivate">Usba ang status</button>`);
  }
  if (canEdit && ["inactive", "resigned"].includes(m.status)) actions.push(`<button class="btn" id="reactivate">I-activate balik</button>`);
  if (can("delete")) actions.push(`<button class="btn danger" id="del">Papasa</button>`);

  const checklist =
    m.status === "applicant"
      ? `<div class="panel" style="border-color:var(--gold)">
        <h2>Requirements sa dili pa ma-member</h2>
        <ul>
          <li>${m.orientation_completed ? "✅" : "⬜"} Nahuman ang orientation ${m.orientation_completed && m.orientation_date ? "(" + esc(fmtShort(m.orientation_date)) + ")" : ""}</li>
          <li>✅ Na-fill up ang personal details</li>
          <li>${cur ? "✅" : "⬜"} Naay record kung pila kabook ang buhi</li>
        </ul>
        <p class="muted small">Inig ka-approve, automatic nga mahatagan og Member ID number ug ma-print ang certificate.</p>
      </div>`
      : "";

  main.innerHTML = `
    <p><a href="#members">← Members</a></p>
    ${pageHead(displayName(m), `${m.member_no ? `<span class="memno">${esc(m.member_no)}</span> · ` : ""}${memberBadge(m.status)} ${
      m.is_pioneer ? '<span class="badge b-gold">Pioneer</span>' : ""
    } ${activity ? activityBadge(activity.activity_category) : ""}`, actions.join(""))}
    ${checklist}
    <div class="cols">
      <div class="panel"><h2>Detalye</h2>
        <dl class="dl">
          <dt>Address</dt><dd>${esc(memberAddress(m)) || "—"}</dd>
          <dt>Contact</dt><dd>${esc(m.contact_no) || "—"}</dd>
          <dt>Sex / Birthdate</dt><dd>${esc(m.sex || "—")} · ${esc(fmtShort(m.birthdate) || "—")}</dd>
          <dt>Civil status</dt><dd>${esc(m.civil_status || "—")}</dd>
          <dt>Trabaho</dt><dd>${esc(m.occupation || "—")}</dd>
          <dt>Emergency</dt><dd>${esc(m.emergency_contact || "—")}</dd>
          <dt>Orientation</dt><dd>${m.orientation_completed ? `Nahuman ${esc(fmtShort(m.orientation_date))}${m.orientation_by ? " · " + esc(m.orientation_by) : ""}` : '<span class="badge b-red">Wala pa</span>'}</dd>
          <dt>Nag-apply</dt><dd>${esc(fmtShort(m.application_date))}</dd>
          <dt>Member sukad</dt><dd>${esc(fmtShort(m.membership_date) || "—")}</dd>
          ${m.remarks ? `<dt>Remarks</dt><dd>${esc(m.remarks)}</dd>` : ""}
        </dl>
      </div>
      <div class="panel"><h2>Buhi nga baboy karon</h2>
        ${
          cur
            ? `<div class="ledger">${HERD.map((h) => `<div><div class="fig">${num(cur[h.k])}</div><div class="cap">${h.label}</div></div>`).join("")}</div>
               <p class="muted small">Total ${num(herdTotal(cur))} · huling update ${esc(fmtShort(cur.record_date))}</p>`
            : `<p class="muted">Wala pay herd record.</p>`
        }
        <details><summary>History sa herd (${herdRows.length})</summary>
          <div class="table-wrap"><table><thead><tr><th>Petsa</th>${HERD.map((h) => `<th class="num">${h.label}</th>`).join("")}<th>Gikan</th></tr></thead>
          <tbody>${herdRows
            .map(
              (r) => `<tr><td>${esc(fmtShort(r.record_date))}</td>${HERD.map((h) => `<td class="num">${num(r[h.k])}</td>`).join("")}
              <td class="small">${esc({ application: "Application", manual: "Manual", disposal: "Disposal" }[r.source])}${r.notes ? " · " + esc(r.notes) : ""}</td></tr>`
            )
            .join("")}</tbody></table></div>
        </details>
      </div>
    </div>
    <div class="cols">
      <div class="panel"><h2>Bayronon</h2>
        ${
          dues
            ? `<dl class="dl">
            <dt>Membership fee</dt><dd>${dues.membership_fee_paid ? '<span class="badge b-green">Bayad na</span>' : '<span class="badge b-red">Wala pa</span>'}</dd>
            <dt>Monthly dues</dt><dd>${num(dues.months_paid)} sa ${num(dues.months_due)} ka bulan bayad</dd>
            <dt>Utang nga dues</dt><dd>${dues.months_unpaid > 0 ? `<strong style="color:var(--danger)">${money(dues.amount_unpaid)}</strong> (${dues.months_unpaid} ka bulan)` : "Wala"}</dd>
          </dl>`
            : `<p class="muted">Makita ra ang dues status kung active na ang member.</p>`
        }
        <details><summary>Mga bayad (${txns.length})</summary>
          <table><tbody>${txns
            .map((t) => `<tr><td>${esc(fmtShort(t.txn_date))}</td><td>${esc(ALL_CATS[t.category])}${t.due_month ? " · " + esc(monthLabel(t.due_month)) : ""}</td><td class="num">${money(t.amount)}</td></tr>`)
            .join("") || emptyRow(3, "Wala pay bayad.")}</tbody></table>
        </details>
      </div>
      <div class="panel"><h2>Attendance sa meeting</h2>
        ${
          activity
            ? `<dl class="dl">
            <dt>Rate</dt><dd><strong>${activity.attendance_rate ?? "—"}${activity.attendance_rate != null ? "%" : ""}</strong> ${activityBadge(activity.activity_category)}</dd>
            <dt>Mitambong</dt><dd>${num(activity.attended)} sa ${num(activity.meetings_held)} ka meeting (${num(activity.late)} late)</dd>
            <dt>Excused / absent</dt><dd>${num(activity.excused)} / ${num(activity.absences)}</dd>
          </dl>`
            : ""
        }
        <details><summary>Listahan (${att.length})</summary>
          <table><tbody>${att
            .map((a) => `<tr><td>${esc(fmtShort(a.meetings?.meeting_date))}</td><td>${esc(a.meetings?.title)}</td><td>${esc(ATT_STATUS[a.status])}</td></tr>`)
            .join("") || emptyRow(3, "Wala pay record.")}</tbody></table>
        </details>
      </div>
    </div>
    <div class="cols">
      <div class="panel"><h2>Disposals</h2>
        <table><tbody>${disposals
          .map(
            (d) => `<tr class="clickable" data-disp="${d.id}"><td>${esc(d.control_no)}</td><td>${esc(fmtShort(d.disposal_date))}</td>
            <td class="num">${num(d.total_heads)} ulo</td><td class="num">${money(d.total_amount)}</td><td>${disposalBadge(d.status)}</td></tr>`
          )
          .join("") || emptyRow(5, "Wala pay disposal.")}</tbody></table>
      </div>
      <div class="panel"><h2>Rewards</h2>
        <table><tbody>${rewards
          .map((r) => `<tr><td>${esc(fmtShort(r.award_date))}</td><td>${esc(r.title)}</td><td>${esc(AWARD_TYPES[r.award_type])}</td></tr>`)
          .join("") || emptyRow(3, "Wala pay reward.")}</tbody></table>
      </div>
    </div>`;

  const $ = (s) => main.querySelector(s);
  $("#edit")?.addEventListener("click", () => memberForm(m));
  $("#herd")?.addEventListener("click", () => herdForm(m, cur));
  $("#print-cert")?.addEventListener("click", () => printHTML(Cert.membership(m, App.settings)));
  $("#print-id")?.addEventListener("click", () => printHTML(`<div class="idcards">${Cert.idCard(m, App.settings)}</div>`));
  main.querySelectorAll("[data-disp]").forEach((tr) => tr.addEventListener("click", () => go("disposals")));

  $("#approve")?.addEventListener("click", async () => {
    if (!m.orientation_completed) return toast("Dili pa ma-approve: wala pa nahuman ang orientation. I-edit una.", true);
    if (!cur) return toast("Dili pa ma-approve: walay record sa buhi nga baboy.", true);
    modal({
      title: "I-approve isip member",
      body: `<p>I-approve si <strong>${esc(displayName(m))}</strong>? Automatic siyang mahatagan og Member ID number.</p>
        <label style="max-width:240px">Petsa sa membership<input type="date" name="membership_date" value="${isoDate()}" required></label>`,
      submitLabel: "I-approve",
      onSubmit: async (form) => {
        const o = formToObj(form);
        const saved = await db(App.sb.from("members").update({ status: "active", membership_date: o.membership_date }).eq("id", m.id).select().single());
        toast(`Approved! Member ID: ${saved.member_no}`);
        await App.render();
        modal({
          title: "Member na!",
          body: `<p style="font-size:1.1rem">Member ID number: <strong class="memno">${esc(saved.member_no)}</strong></p><p>I-print na ang Certificate of Membership?</p>`,
          submitLabel: "Print certificate",
          cancelLabel: "Unya na lang",
          onSubmit: () => printHTML(Cert.membership(saved, App.settings)),
        });
        return false; // ang bag-ong modal na ang nagpakita, ayaw i-close
      },
    });
  });

  $("#deactivate")?.addEventListener("click", () =>
    modal({
      title: "Usba ang status",
      body: `<label>Bag-ong status<select name="status">${options({ inactive: "Inactive", resigned: "Resigned", deceased: "Deceased" }, "inactive")}</select></label>
        <label style="margin-top:.8rem">Rason<input name="remarks" value="${esc(m.remarks || "")}"></label>`,
      onSubmit: async (form) => {
        await db(App.sb.from("members").update(formToObj(form)).eq("id", m.id));
        toast("Na-update ang status.");
        App.render();
      },
    })
  );
  $("#reactivate")?.addEventListener("click", async () => {
    await db(App.sb.from("members").update({ status: "active" }).eq("id", m.id));
    toast("Active na usab.");
    App.render();
  });
  $("#del")?.addEventListener("click", async () => {
    if (!(await confirmBox(`Papason gyud si <strong>${esc(displayName(m))}</strong> ug ang tanan niyang records? Dili na ni mabawi.`, "Papasa"))) return;
    try {
      await db(App.sb.from("members").delete().eq("id", m.id));
      toast("Napapas.");
      go("members");
    } catch (e) {
      toast(/foreign key/i.test(e.message) ? "Dili mapapas kay naay disposal o bayad nga record. I-set na lang og Inactive/Resigned." : errMsg(e), true);
    }
  });
};
