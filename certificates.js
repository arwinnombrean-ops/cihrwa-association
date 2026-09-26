/* =============================================================
   CERTIFICATES — printable documents
   ============================================================= */
const Cert = {
  head(s) {
    return `<div class="cert-head">
      <div class="rep">Republic of the Philippines</div>
      <div class="org">${esc(s.association_name)}</div>
      <div class="addr">${esc(s.address || "")}</div>
      ${s.registration_no ? `<div class="addr">Registration No. ${esc(s.registration_no)}</div>` : ""}
    </div>`;
  },

  sig(name, title) {
    return `<div class="sig"><div style="height:12mm"></div><div class="line">${esc(name || "\u00a0")}</div>${esc(title)}</div>`;
  },

  herdTable(d, labelPrefix) {
    const rows = HERD.map(
      (h) => `<tr><td>${h.label} (${h.en})</td>
        <td class="num">${num(d["herd_" + h.k])}</td>
        <td class="num">${num(d["qty_" + h.k])}</td>
        <td class="num">${num(d["herd_" + h.k] - d["qty_" + h.k])}</td></tr>`
    ).join("");
    return `<table style="width:100%"><thead><tr><th>Klase sa baboy</th><th>Buhi (inventory)</th><th>I-dispose</th><th>Nahibilin</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Total</td><td class="num">${num(herdTotal(d, "herd_"))}</td><td class="num">${num(d.total_heads)}</td>
      <td class="num">${num(herdTotal(d, "herd_") - d.total_heads)}</td></tr></tfoot></table>`;
  },

  disposedList(d) {
    return HERD.filter((h) => d["qty_" + h.k] > 0)
      .map((h) => `${d["qty_" + h.k]} head(s) ${h.en.toLowerCase()} (${h.label.toLowerCase()})`)
      .join(", ");
  },

  destination(d) {
    const t = DEST_TYPES[d.destination_type] || "";
    return [d.destination_name, d.destination_address].filter(Boolean).join(", ") + (t ? ` (${t})` : "");
  },

  /* 1. Certificate of Membership */
  membership(m, s) {
    return `<div class="cert">
      ${Cert.head(s)}
      <div class="cert-title">CERTIFICATE OF MEMBERSHIP</div>
      <div class="cert-no">Member ID No. <strong>${esc(m.member_no || "—")}</strong></div>
      <p>This is to certify that</p>
      <span class="big-name">${esc(displayName(m).toUpperCase())}</span>
      <p>of ${esc(memberAddress(m) || "________________")}, is a bona fide member of the
        <strong>${esc(s.association_name)}</strong>, having completed the required membership orientation
        ${m.orientation_date ? `on <span class="fill">${esc(fmtDate(m.orientation_date))}</span>` : ""}
        and having been duly accepted as a member on <span class="fill">${esc(fmtDate(m.membership_date))}</span>.</p>
      ${m.is_pioneer ? `<p>The said member is likewise recognized as a <strong>Pioneer Member</strong> of the Association.</p>` : ""}
      <p>As a member, he/she is entitled to all the rights and privileges and is bound by the obligations provided
        in the Constitution and By-Laws of the Association.</p>
      <p>Issued this ${esc(ordinalDay(new Date()))}${s.address ? " at " + esc(s.address) : ""}.</p>
      <div class="sigs">${Cert.sig(s.secretary_name, "Secretary")}${Cert.sig(s.president_name, "President")}</div>
      <div class="cert-foot"><span>${esc(s.association_short)} · Member ID ${esc(m.member_no || "")}</span><span>Not valid without the official seal</span></div>
    </div>`;
  },

  /* 2. Member ID card (credit-card size) */
  idCard(m, s) {
    return `<div class="idcard">
      <div class="top">${esc(s.association_name)}<br><span style="font-weight:400">${esc(s.address || "")}</span></div>
      <div class="body">
        <div class="photo">1×1<br>photo</div>
        <div style="display:flex;flex-direction:column;flex:1">
          <div class="nm">${esc(displayName(m).toUpperCase())}</div>
          <div class="no">${esc(m.member_no || "")}</div>
          <div class="meta">${esc(memberAddress(m))}<br>
            Member since ${esc(fmtShort(m.membership_date))}${m.contact_no ? "<br>" + esc(m.contact_no) : ""}
            ${m.is_pioneer ? "<br><strong>PIONEER MEMBER</strong>" : ""}</div>
          <div class="sigline">${esc(s.president_name || "")}, President</div>
        </div>
      </div>
    </div>`;
  },

  /* 3. Association Certification — gikan sa President, dad-on sa D.A. */
  association(d, m, s) {
    return `<div class="cert">
      ${Cert.head(s)}
      <div class="cert-title">CERTIFICATION</div>
      <div class="cert-no">Cert. No. <strong>${esc(d.assoc_cert_no)}</strong> · Control No. ${esc(d.control_no)}</div>
      <p><strong>TO WHOM IT MAY CONCERN:</strong></p>
      <p>This is to certify that <span class="fill">${esc(displayName(m).toUpperCase())}</span>, with Member ID No.
        <span class="fill">${esc(m.member_no)}</span>, of ${esc(memberAddress(m))}, is a bona fide and
        <strong>active member in good standing</strong> of the ${esc(s.association_name)}.</p>
      <p>The said member intends to dispose of <strong>${esc(Cert.disposedList(d))}</strong>, a total of
        <strong>${num(d.total_heads)} head(s)</strong>, to <span class="fill">${esc(d.buyer_name)}</span>
        ${d.buyer_address ? `of ${esc(d.buyer_address)}` : ""}, to be brought to
        <span class="fill">${esc(Cert.destination(d) || "—")}</span>.</p>
      <p>Per the Association's records, the member's current swine inventory is as follows:</p>
      ${Cert.herdTable(d)}
      <p>This certification is issued upon the request of the above-named member in support of his/her
        application for certification from the ${esc(s.da_office || "Department of Agriculture")}.</p>
      <p>Issued this ${esc(ordinalDay(d.assoc_cert_date))}${s.address ? " at " + esc(s.address) : ""}.</p>
      <div class="sigs"><div></div>${Cert.sig(d.assoc_cert_by || s.president_name, "President")}</div>
      <div class="cert-foot"><span>${esc(d.assoc_cert_no)}</span><span>Not valid without the official seal</span></div>
    </div>`;
  },

  /* 4. Certificate of Disposal — human ma-clear sa D.A. */
  disposal(d, m, s) {
    const price =
      d.price_basis === "per_kilo" && d.unit_price
        ? `${money(d.unit_price)} per kilo × ${num(d.total_weight_kg)} kg`
        : d.price_basis === "per_head" && d.unit_price
        ? `${money(d.unit_price)} per head × ${num(d.total_heads)} head(s)`
        : PRICE_BASIS[d.price_basis] || "";
    return `<div class="cert">
      ${Cert.head(s)}
      <div class="cert-title">CERTIFICATE OF DISPOSAL</div>
      <div class="cert-no">Control No. <strong>${esc(d.control_no)}</strong></div>
      <p>This is to certify that the following disposal of swine by a member of the ${esc(s.association_name)}
        has been recorded and cleared by the Association and the ${esc(s.da_office || "Department of Agriculture")}:</p>
      <table style="width:100%"><tbody>
        <tr><th style="width:34%">Member</th><td>${esc(displayName(m))} (ID No. ${esc(m.member_no)})</td></tr>
        <tr><th>Address / Contact</th><td>${esc(memberAddress(m))}${m.contact_no ? " · " + esc(m.contact_no) : ""}</td></tr>
        <tr><th>Date of disposal</th><td>${esc(fmtDate(d.disposal_date))}</td></tr>
        <tr><th>Buyer</th><td>${esc(d.buyer_name)}${d.buyer_address ? ", " + esc(d.buyer_address) : ""}${d.buyer_contact ? " · " + esc(d.buyer_contact) : ""}</td></tr>
        <tr><th>Destination</th><td>${esc(Cert.destination(d) || "—")}</td></tr>
        <tr><th>Total weight</th><td>${d.total_weight_kg ? num(d.total_weight_kg) + " kg" : "—"}</td></tr>
        <tr><th>Selling price</th><td><strong>${money(d.total_amount)}</strong> ${price ? "(" + esc(price) + ")" : ""}</td></tr>
        <tr><th>Association Certification</th><td>${esc(d.assoc_cert_no || "—")} · ${esc(fmtDate(d.assoc_cert_date))}</td></tr>
        <tr><th>D.A. Certification</th><td>${esc(d.da_cert_no || "—")} · ${esc(fmtDate(d.da_cert_date))}${d.da_officer ? " · " + esc(d.da_officer) : ""}</td></tr>
      </tbody></table>
      ${Cert.herdTable(d)}
      <p>Issued this ${esc(ordinalDay(new Date()))}${s.address ? " at " + esc(s.address) : ""}.</p>
      <div class="sigs" style="grid-template-columns:1fr 1fr 1fr">
        ${Cert.sig(displayName(m), "Member (Conforme)")}
        ${Cert.sig(s.secretary_name, "Secretary")}
        ${Cert.sig(s.president_name, "President")}
      </div>
      <div class="cert-foot"><span>${esc(d.control_no)}</span><span>Not valid without the official seal</span></div>
    </div>`;
  },

  /* 5. Plain report wrapper */
  report(title, subtitle, inner, s) {
    return `<div class="print-report">
      <div class="rhead"><div>${esc(s.association_name)}</div><div class="small">${esc(s.address || "")}</div>
      <h1 style="margin-top:3mm">${esc(title)}</h1><div>${esc(subtitle || "")}</div></div>
      ${inner}
      <p class="small" style="margin-top:6mm">Printed ${esc(fmtDate(new Date()))} by ${esc(App.profile.full_name || App.profile.email)}
        (${esc(ROLES[App.profile.role])})</p>
    </div>`;
  },
};
