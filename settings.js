/* =============================================================
   SETTINGS & OFFICERS
   ============================================================= */
App.pages.settings = async function (main) {
  const s = await loadSettings();
  const profiles = await db(App.sb.from("profiles").select("*").order("created_at"));
  const ro = can("settings") ? "" : "disabled";

  main.innerHTML =
    pageHead("Settings", "Detalye sa association, bayronon, ug mga officer nga maka-login.") +
    `<form class="panel" id="set-form"><h2>Association</h2>
      <div class="grid two">
        <label>Ngalan sa association<input name="association_name" value="${esc(s.association_name)}" ${ro} required></label>
        <label>Short name<input name="association_short" value="${esc(s.association_short)}" ${ro}></label>
        <label>Address<input name="address" value="${esc(s.address)}" ${ro} placeholder="Barangay, City, Province"></label>
        <label>Registration no. <span class="hint">(DOLE / CDA / SEC)</span><input name="registration_no" value="${esc(s.registration_no)}" ${ro}></label>
        <label>Ngalan sa President <span class="hint">(para sa pirma sa certificate)</span><input name="president_name" value="${esc(s.president_name)}" ${ro}></label>
        <label>Ngalan sa Secretary<input name="secretary_name" value="${esc(s.secretary_name)}" ${ro}></label>
        <label>Ngalan sa Treasurer<input name="treasurer_name" value="${esc(s.treasurer_name)}" ${ro}></label>
        <label>Ngalan sa Mayor<input name="mayor_name" value="${esc(s.mayor_name)}" ${ro}></label>
        <label>D.A. office<input name="da_office" value="${esc(s.da_office)}" ${ro}></label>
        <label>Prefix sa Member ID <span class="hint">e.g. HRA → HRA-2026-0001</span><input name="member_id_prefix" value="${esc(s.member_id_prefix)}" ${ro} required maxlength="10"></label>
      </div>
      <h2 style="margin-top:1.25rem">Bayronon</h2>
      <div class="grid">
        <label>Membership fee (₱)<input type="number" step="0.01" min="0" name="membership_fee" value="${esc(s.membership_fee)}" ${ro}></label>
        <label>Monthly due (₱)<input type="number" step="0.01" min="0" name="monthly_due" value="${esc(s.monthly_due)}" ${ro}></label>
      </div>
      <h2 style="margin-top:1.25rem">Activity categories (attendance %)</h2>
      <div class="grid">
        <label>Very Active kung ≥<input type="number" min="0" max="100" name="very_active_threshold" value="${esc(s.very_active_threshold)}" ${ro}></label>
        <label>Active kung ≥<input type="number" min="0" max="100" name="active_threshold" value="${esc(s.active_threshold)}" ${ro}></label>
        <label>Less Active kung ≥<input type="number" min="0" max="100" name="less_active_threshold" value="${esc(s.less_active_threshold)}" ${ro}></label>
      </div>
      ${can("settings") ? `<div class="actions" style="margin-top:1rem"><button class="btn primary" type="submit">I-save ang settings</button></div>` : ""}
    </form>

    <div class="panel"><h2>Mga officer nga maka-login</h2>
      ${
        can("officers")
          ? `<p class="muted small">Pagdugang og officer: sa Supabase dashboard → Authentication → Users → <em>Add user</em> (email ug password, i-check ang “Auto confirm”).
             Mogawas siya dinhi isip “Pending”; dayon i-set ang iyang position.</p>`
          : `<p class="muted small">Ang President ra ang maka-usab sa position sa mga officer.</p>`
      }
      <div class="table-wrap"><table><thead><tr><th>Email</th><th>Ngalan</th><th>Position</th><th></th></tr></thead>
      <tbody id="off-rows">${profiles
        .map(
          (p) => `<tr data-id="${p.id}">
          <td>${esc(p.email)}${p.id === App.session.user.id ? ' <span class="badge b-blue">Ikaw</span>' : ""}</td>
          <td>${can("officers") ? `<input name="full_name" value="${esc(p.full_name)}">` : esc(p.full_name)}</td>
          <td>${can("officers") ? `<select name="role">${options(ROLES, p.role)}</select>` : esc(ROLES[p.role])}</td>
          <td>${can("officers") ? `<button class="btn small" data-save>I-save</button>` : ""}</td></tr>`
        )
        .join("")}</tbody></table></div>
      <details style="margin-top:1rem"><summary>Unsa ang mahimo sa matag position</summary>
        <table class="small"><tbody>
          <tr><td><strong>President</strong></td><td>Tanan; maka-issue sa Association Certification; maka-assign sa position; maka-papas.</td></tr>
          <tr><td><strong>Secretary</strong></td><td>Members, herd, disposal forms, meetings, attendance, rewards, settings.</td></tr>
          <tr><td><strong>Treasurer</strong></td><td>Finance: bayad, dues, sponsors, government support, gasto.</td></tr>
          <tr><td><strong>Auditor</strong></td><td>Makakita sa tanan; maka-mark nga audited sa transactions (dili maka-usab sa amount).</td></tr>
          <tr><td><strong>Vice President, P.R.O., Board Member</strong></td><td>Makakita ug maka-print ra (read-only).</td></tr>
        </tbody></table>
      </details>
    </div>

    <form class="panel" id="me-form"><h2>Akong account</h2>
      <div class="grid">
        <label>Akong ngalan<input name="full_name" value="${esc(App.profile.full_name)}"></label>
        <label>Bag-ong password <span class="hint">(biyai nga blangko kung dili usbon)</span><input type="password" name="password" minlength="8" autocomplete="new-password"></label>
      </div>
      <div class="actions" style="margin-top:1rem"><button class="btn" type="submit">I-save ang akong account</button></div>
    </form>`;

  main.querySelector("#set-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await db(App.sb.from("settings").update({ ...formToObj(e.target), updated_at: new Date().toISOString() }).eq("id", 1));
      await loadSettings();
      document.getElementById("brand-name").textContent = App.settings.association_name;
      toast("Na-save ang settings.");
    } catch (err) {
      toast(errMsg(err), true);
    }
  });

  main.querySelector("#off-rows").addEventListener("click", async (e) => {
    if (!e.target.closest("[data-save]")) return;
    const tr = e.target.closest("tr");
    try {
      await db(
        App.sb
          .from("profiles")
          .update({ full_name: tr.querySelector("[name=full_name]").value.trim(), role: tr.querySelector("[name=role]").value })
          .eq("id", tr.dataset.id)
      );
      toast("Na-save ang officer.");
      if (tr.dataset.id === App.session.user.id) location.reload();
    } catch (err) {
      toast(errMsg(err), true);
    }
  });

  main.querySelector("#me-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const o = formToObj(e.target);
    try {
      await db(App.sb.from("profiles").update({ full_name: o.full_name }).eq("id", App.session.user.id));
      App.profile.full_name = o.full_name;
      if (o.password) {
        const { error } = await App.sb.auth.updateUser({ password: o.password });
        if (error) throw error;
      }
      document.getElementById("brand-user").textContent = `${App.profile.full_name || App.profile.email} · ${ROLES[App.profile.role]}`;
      toast("Na-save ang imong account.");
      e.target.password.value = "";
    } catch (err) {
      toast(errMsg(err), true);
    }
  });
};
