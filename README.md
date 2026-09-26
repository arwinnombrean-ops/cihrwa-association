# Hog Raisers Association — Management System

Sistema para sa association sa mga nag-alima og baboy: membership, herd, disposal/sales uban sa certification sa President ug D.A., finance, meeting attendance, activity category, ug rewards. Naggamit og **Supabase** (database + login) ug **GitHub Pages** (libre nga hosting).

---

## Unsa ang naa sa sistema

| Tab | Unsa ang mahimo |
|---|---|
| **Dashboard** | Ihap sa members, total nga baboy, cash on hand, ug mga buhatonon (applicants nga andam na i-approve, disposal nga naghulat, utang nga dues). |
| **Members** | Membership application form (orientation → personal details → pila kabook ang buhi). Inig **I-approve**, automatic ang **Member ID number** (e.g. `HRA-2026-0001`) ug ma-print dayon ang **Certificate of Membership** ug **ID card**. |
| **Disposal / Sales** | Disposal form (update sa herd, pila ang i-dispose: anay, bigal, butakal, biik, fattening; buyer; asa dalhon; presyo). Proseso: **President** mo-issue sa certification → **D.A.** certification i-record → **Cleared** ug ma-print ang **Certificate of Disposal**. Automatic nga maminusan ang herd sa member. |
| **Finance** | Membership fee, monthly dues (makita kinsa ang naay utang ug pila ka bulan), sponsors, government support (cash o in-kind sama sa feeds/biik), donations, ug gasto. Ang Auditor maka-mark nga "audited". |
| **Meetings** | Paghimo og meeting, i-check ang attendance (Present / Late / Excused / Absent), i-print ang attendance sheet nga naay lugar sa pirma. Kung "Orientation" nga meeting, automatic ma-check ang orientation sa applicants nga mitambong. |
| **Activity & Rewards** | Automatic nga category base sa attendance: **Very Active** (≥90%), **Active** (≥70%), **Less Active** (≥40%), **Inactive**. Listahan sa qualified sa reward (Pioneers, Very Active, Perfect attendance) ug record sa rewards nga nahatag. |
| **Reports** | Report sa bisan unsang petsa: membership, swine inventory, disposal/sales, finance, meetings. Ma-print. |
| **Settings** | Ngalan sa association, address, ngalan sa mga officer para sa pirma, membership fee, monthly due, ug pag-assign sa position sa mga officer. |

### Unsa ang mahimo sa matag officer

| Position | Access |
|---|---|
| President | Tanan. Siya ra ang maka-issue sa Association Certification sa disposal ug maka-assign og position. |
| Secretary | Members, herd, disposal forms, meetings, attendance, rewards, settings. |
| Treasurer | Finance (bayad, dues, sponsors, government support, gasto). |
| Auditor | Makakita sa tanan; maka-mark nga audited ang transactions (dili maka-usab sa amount). Kung audited na, dili na ma-edit o mapapas. |
| Vice President, P.R.O., Board Member | Makakita ug maka-print ra. |

Ang mga lagda gi-enforce sa database mismo (Row Level Security), dili lang sa screen — bisan kinsa nga mosulay og lusot, dili gihapon makabuhat sa dili iyang trabaho.

---

## Pag-setup (mga 20 minutos)

### 1. Paghimo og Supabase project
1. Adto sa <https://supabase.com> → **Start your project** → mag-sign up (libre).
2. **New project**. Butangi og ngalan (e.g. `hog-association`), paghimo og database password (i-save ni), pili-a ang region nga **Southeast Asia (Singapore)**.
3. Hulata nga mahuman (1–2 minutos).

### 2. I-install ang database
1. Sa Supabase, adto sa **SQL Editor** → **New query**.
2. Ablihi ang file nga `supabase/schema.sql`, kopyaha tanan, i-paste, dayon **Run**.
3. Dapat "Success. No rows returned." (Luwas ra ni i-run balik kung naay update.)

### 3. I-setup ang login
1. **Authentication → Sign In / Providers → Email**: siguroha nga naka-enable.
2. **Authentication → Sign In / Providers**: i-OFF ang **Allow new users to sign up** aron ang President ra ang makadugang og officers.
3. **Authentication → Users → Add user → Create new user**: ibutang ang email ug password sa **President**, i-check ang **Auto Confirm User**.
   > ⚠️ Ang **UNANG** user nga ma-create automatic nga mahimong **President**. Ang sunod nga users mahimong "Pending" hangtod i-assign sa President.

### 4. I-connect ang app sa Supabase
1. Sa Supabase: **Project Settings → API** (o **Data API**). Kopyaha ang **Project URL** ug ang **anon public** key.
2. Ablihi ang `js/config.js` ug ilisi:
   ```js
   SUPABASE_URL: "https://abcdxyz.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...."
   ```
   Luwas ra nga makita sa publiko ang anon key — ang security naa sa database rules.

### 5. I-upload sa GitHub ug i-publish
1. Adto sa <https://github.com> → **New repository** → ngalan e.g. `hog-association` → **Create**.
2. I-klik ang **uploading an existing file**, i-drag tanan nga files ug folders niini (`index.html`, `css/`, `js/`, `supabase/`, `README.md`) → **Commit changes**.
3. **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / `(root)` → **Save**.
4. Human sa 1–2 minutos, ma-abli na sa `https://IMONG-USERNAME.github.io/hog-association/`.

   Kung gusto ninyo private ang code, pwede usab i-deploy sa **Netlify** o **Vercel** (i-connect lang ang GitHub repo; walay build command).

### 6. Unang login sa President
1. Ablihi ang website, log in gamit ang email/password sa President.
2. Adto sa **Settings**: ibutang ang ngalan sa association, address, registration no., ngalan sa President/Secretary/Treasurer (mogawas ni sa pirma sa certificates), **membership fee**, **monthly due**, ug **prefix sa Member ID**.

### 7. Pagdugang og ubang officers
1. Supabase → **Authentication → Users → Add user** (email + password, Auto Confirm).
2. Sa app → **Settings → Mga officer**: mogawas siya isip "Pending". I-set ang iyang ngalan ug position → **I-save**.

---

## Giunsa paggamit

**Bag-ong member**
1. Members → **Bag-ong member** → i-fill up ang orientation, personal details, ug pila kabook ang buhi → **I-save ang application**.
2. Kung nahuman na ang orientation, abli-a ang profile → **I-approve isip member** → automatic ang Member ID → **Print certificate** / **Print ID**.
   (Dili ma-approve kung wala pay orientation o herd record.)

**Disposal sa baboy**
1. Disposal / Sales → **Bag-ong disposal** → pili-a ang member (automatic mogawas ang iyang herd; i-update kung nausab) → pila ang i-dispose → buyer → asa dalhon → presyo (automatic ang total kung per kilo o per ulo).
2. **President** → **I-issue ang certification** → ma-print ang Certification nga dad-on sa D.A.
3. Human makuha ang D.A. certification → **I-record ang D.A. cert.** (numero ug petsa) → **Cleared** → ma-print ang **Certificate of Disposal**. Automatic nga ma-update ang herd sa member.

**Bayad sa dues**
Finance → **Monthly dues** → **Bayad dues** sa member → pili-a ang mga bulan → i-save. Para sa membership fee, sponsors, ug government support, gamita ang **Bag-ong transaction**. Kung in-kind (feeds, biik, bakuna), i-check ang "In-kind" ug ibutang ang gibanabana nga value; dili ni maapil sa cash on hand.

**Meeting**
Meetings → **Bag-ong meeting** → i-check ang attendance → **I-save**. Ang activity category ug rewards automatic nga ma-update.

---

## Pag-print
Ang tanang certificates ug reports kay A4. Sa print window, i-set ang **Margins: Default** ug i-check ang **Background graphics** aron mogawas ang border ug kolor. Pwede usab **Save as PDF**.

## Backup
Supabase free plan: i-export matag bulan. **Table Editor** → pili-a ang table → **Export → CSV** (members, herd_updates, disposals, transactions, meetings, attendance, rewards).

## Mga file
```
index.html              – ang app
css/style.css           – design ug print layout sa certificates
js/config.js            – Supabase URL ug key (ILISI NI)
js/core.js              – shared helpers
js/certificates.js      – template sa mga certificate
js/pages/*.js           – matag tab
js/main.js              – login ug navigation
supabase/schema.sql     – database, security rules, automatic numbering
```
