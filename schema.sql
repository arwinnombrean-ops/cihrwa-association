-- =====================================================================
--  HOG RAISERS ASSOCIATION MANAGEMENT SYSTEM  —  Supabase schema
--  I-paste ni tanan sa Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. OFFICER ROLES
-- ---------------------------------------------------------------------
do $$ begin
  create type public.officer_role as enum
    ('president','vice_president','secretary','treasurer','auditor','pro','board_member','pending');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. SETTINGS (usa ra ka row)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id                     int primary key default 1 check (id = 1),
  association_name       text not null default 'Hog Raisers Association',
  association_short      text not null default 'HRA',
  address                text default '',
  registration_no        text default '',
  president_name         text default '',
  secretary_name         text default '',
  treasurer_name         text default '',
  mayor_name             text default '',
  da_office              text default 'Office of the Municipal Agriculturist',
  membership_fee         numeric(12,2) not null default 0,
  monthly_due            numeric(12,2) not null default 0,
  member_id_prefix       text not null default 'HRA',
  very_active_threshold  int not null default 90,
  active_threshold       int not null default 70,
  less_active_threshold  int not null default 40,
  updated_at             timestamptz default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3. PROFILES (officers nga maka-login)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text default '',
  role        public.officer_role not null default 'pending',
  created_at  timestamptz default now()
);

-- Ang UNANG user nga ma-create mahimong PRESIDENT. Ang uban 'pending' hangtod i-assign sa president.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email,
          case when exists (select 1 from public.profiles) then 'pending'::officer_role
               else 'president'::officer_role end);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper functions para sa security
create or replace function public.my_role()
returns public.officer_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.has_role(roles public.officer_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = any(roles), false)
$$;

create or replace function public.is_officer()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() <> 'pending', false)
$$;

-- President ra ang maka-usab sa role (bisan sa iyang kaugalingon dili makausab ang uban)
create or replace function public.guard_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and not public.has_role(array['president']::officer_role[]) then
    raise exception 'Ang President ra ang maka-usab sa role sa officer.';
  end if;
  if old.role = 'president' and new.role <> 'president'
     and (select count(*) from public.profiles where role = 'president') <= 1 then
    raise exception 'Kinahanglan adunay bisan usa ka President nga account.';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------
-- 4. MEMBERS
-- ---------------------------------------------------------------------
create sequence if not exists public.member_no_seq;

create table if not exists public.members (
  id                      uuid primary key default gen_random_uuid(),
  member_no               text unique,
  last_name               text not null,
  first_name              text not null,
  middle_name             text default '',
  suffix                  text default '',
  sex                     text check (sex in ('Male','Female')),
  birthdate               date,
  civil_status            text,
  purok                   text default '',
  barangay                text default '',
  municipality            text default '',
  province                text default '',
  contact_no              text default '',
  occupation              text default '',
  emergency_contact       text default '',
  orientation_completed   boolean not null default false,
  orientation_date        date,
  orientation_by          text default '',
  application_date        date not null default current_date,
  membership_date         date,
  status                  text not null default 'applicant'
                          check (status in ('applicant','active','inactive','resigned','deceased')),
  is_pioneer              boolean not null default false,
  remarks                 text default '',
  created_by              uuid default auth.uid(),
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- Herd records (pila kabook ang buhi)
create table if not exists public.herd_updates (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  record_date  date not null default current_date,
  sows         int not null default 0 check (sows >= 0),       -- Anay / Inahin
  gilts        int not null default 0 check (gilts >= 0),      -- Bigal
  boars        int not null default 0 check (boars >= 0),      -- Butakal
  piglets      int not null default 0 check (piglets >= 0),    -- Biik
  fatteners    int not null default 0 check (fatteners >= 0),  -- Fattening
  source       text not null default 'manual' check (source in ('application','manual','disposal')),
  disposal_id  uuid,
  notes        text default '',
  created_by   uuid default auth.uid(),
  created_at   timestamptz default now()
);
create index if not exists idx_herd_member on public.herd_updates(member_id, record_date desc, created_at desc);

-- Dili ma-ACTIVE ang member kung walay orientation ug walay herd record.
-- Automatic ang Member ID number inig ka-active.
create or replace function public.members_before_save()
returns trigger language plpgsql security definer set search_path = public as $$
declare pfx text;
begin
  new.updated_at := now();
  if new.status = 'active' then
    if not new.orientation_completed then
      raise exception 'Dili pa ma-activate: wala pa nahuman ang orientation sa member.';
    end if;
    if tg_op = 'UPDATE' and not exists (select 1 from herd_updates where member_id = new.id) then
      raise exception 'Dili pa ma-activate: wala pay record kung pila kabook ang buhi.';
    end if;
    if tg_op = 'INSERT' then
      raise exception 'I-save una isip applicant uban ang herd record, dayon i-approve.';
    end if;
    if new.membership_date is null then new.membership_date := current_date; end if;
    if new.member_no is null then
      select member_id_prefix into pfx from settings where id = 1;
      new.member_no := coalesce(pfx,'HRA') || '-' || to_char(new.membership_date,'YYYY') || '-'
                       || lpad(nextval('member_no_seq')::text, 4, '0');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_members_before_save on public.members;
create trigger trg_members_before_save before insert or update on public.members
  for each row execute function public.members_before_save();

-- ---------------------------------------------------------------------
-- 5. DISPOSALS (pagbaligya / pagdispose sa baboy)
-- ---------------------------------------------------------------------
create sequence if not exists public.disposal_no_seq;
create sequence if not exists public.assoc_cert_seq;

create table if not exists public.disposals (
  id                   uuid primary key default gen_random_uuid(),
  control_no           text unique,
  member_id            uuid not null references public.members(id),
  disposal_date        date not null default current_date,
  -- Herd sa member karon (updated count)
  herd_sows            int not null default 0 check (herd_sows >= 0),
  herd_gilts           int not null default 0 check (herd_gilts >= 0),
  herd_boars           int not null default 0 check (herd_boars >= 0),
  herd_piglets         int not null default 0 check (herd_piglets >= 0),
  herd_fatteners       int not null default 0 check (herd_fatteners >= 0),
  -- Pila ang i-dispose
  qty_sows             int not null default 0 check (qty_sows >= 0),
  qty_gilts            int not null default 0 check (qty_gilts >= 0),
  qty_boars            int not null default 0 check (qty_boars >= 0),
  qty_piglets          int not null default 0 check (qty_piglets >= 0),
  qty_fatteners        int not null default 0 check (qty_fatteners >= 0),
  total_heads          int generated always as
                        (qty_sows + qty_gilts + qty_boars + qty_piglets + qty_fatteners) stored,
  -- Buyer
  buyer_name           text not null,
  buyer_address        text default '',
  buyer_contact        text default '',
  -- Asa dalhon
  destination_type     text not null default 'slaughterhouse'
                       check (destination_type in ('slaughterhouse','backyard','other_farm','other')),
  destination_name     text default '',
  destination_address  text default '',
  -- Presyo
  total_weight_kg      numeric(10,2),
  price_basis          text not null default 'per_kilo' check (price_basis in ('per_kilo','per_head','lump_sum')),
  unit_price           numeric(12,2),
  total_amount         numeric(12,2) not null default 0 check (total_amount >= 0),
  -- Step 1: Certification gikan sa President
  assoc_cert_no        text unique,
  assoc_cert_date      date,
  assoc_cert_by        text,
  -- Step 2: Certification gikan sa D.A.
  da_cert_no           text,
  da_cert_date         date,
  da_officer           text default '',
  status               text not null default 'for_president'
                       check (status in ('for_president','for_da','cleared','cancelled')),
  herd_deducted        boolean not null default false,
  remarks              text default '',
  created_by           uuid default auth.uid(),
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  constraint chk_has_heads check (qty_sows + qty_gilts + qty_boars + qty_piglets + qty_fatteners > 0),
  constraint chk_qty_le_herd check (
    qty_sows <= herd_sows and qty_gilts <= herd_gilts and qty_boars <= herd_boars
    and qty_piglets <= herd_piglets and qty_fatteners <= herd_fatteners)
);
create index if not exists idx_disposals_date on public.disposals(disposal_date desc);

create or replace function public.disposals_before_save()
returns trigger language plpgsql security definer set search_path = public as $$
declare pfx text; mstatus text;
begin
  new.updated_at := now();
  select member_id_prefix into pfx from settings where id = 1;

  if tg_op = 'INSERT' then
    select status into mstatus from members where id = new.member_id;
    if mstatus is distinct from 'active' then
      raise exception 'Ang ACTIVE members ra ang maka-dispose.';
    end if;
    new.control_no := coalesce(pfx,'HRA') || '-D-' || to_char(new.disposal_date,'YYYY') || '-'
                      || lpad(nextval('disposal_no_seq')::text, 4, '0');
    new.herd_deducted := false;
  end if;

  -- President ra ang maka-issue sa Association Certification
  if new.assoc_cert_no is distinct from (case when tg_op = 'UPDATE' then old.assoc_cert_no end) then
    if not has_role(array['president']::officer_role[]) then
      raise exception 'Ang President ra ang maka-issue sa Association Certification.';
    end if;
  end if;
  if new.assoc_cert_no = 'AUTO' then
    new.assoc_cert_no := coalesce(pfx,'HRA') || '-AC-' || to_char(current_date,'YYYY') || '-'
                         || lpad(nextval('assoc_cert_seq')::text, 4, '0');
    new.assoc_cert_date := coalesce(new.assoc_cert_date, current_date);
  end if;

  if tg_op = 'UPDATE' and old.herd_deducted then
    -- human na ma-clear: dili na mausab ang ihap aron dili magkagubot ang herd
    if (new.qty_sows, new.qty_gilts, new.qty_boars, new.qty_piglets, new.qty_fatteners,
        new.herd_sows, new.herd_gilts, new.herd_boars, new.herd_piglets, new.herd_fatteners)
       is distinct from
       (old.qty_sows, old.qty_gilts, old.qty_boars, old.qty_piglets, old.qty_fatteners,
        old.herd_sows, old.herd_gilts, old.herd_boars, old.herd_piglets, old.herd_fatteners) then
      raise exception 'Cleared na ni nga disposal; dili na mausab ang ihap sa baboy.';
    end if;
    if new.status = 'cancelled' then
      raise exception 'Cleared na ni nga disposal; dili na ma-cancel. Himoi og herd update kung naay sayop.';
    end if;
  end if;

  if new.status <> 'cancelled' then
    new.status := case
      when new.assoc_cert_no is null then 'for_president'
      when coalesce(new.da_cert_no,'') = '' then 'for_da'
      else 'cleared' end;
  end if;
  return new;
end $$;
drop trigger if exists trg_disposals_before_save on public.disposals;
create trigger trg_disposals_before_save before insert or update on public.disposals
  for each row execute function public.disposals_before_save();

-- Inig ka-CLEARED: automatic ma-update ang herd sa member (ibawas ang gi-dispose)
create or replace function public.disposals_after_save()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cleared' and not new.herd_deducted then
    insert into herd_updates (member_id, record_date, sows, gilts, boars, piglets, fatteners,
                              source, disposal_id, notes, created_by)
    values (new.member_id, coalesce(new.da_cert_date, new.disposal_date),
            new.herd_sows - new.qty_sows, new.herd_gilts - new.qty_gilts,
            new.herd_boars - new.qty_boars, new.herd_piglets - new.qty_piglets,
            new.herd_fatteners - new.qty_fatteners,
            'disposal', new.id, 'Automatic human sa disposal ' || new.control_no, auth.uid());
    update disposals set herd_deducted = true where id = new.id;
  end if;
  return null;
end $$;
drop trigger if exists trg_disposals_after_save on public.disposals;
create trigger trg_disposals_after_save after insert or update on public.disposals
  for each row execute function public.disposals_after_save();

-- ---------------------------------------------------------------------
-- 6. FINANCE (kwarta sa association)
-- ---------------------------------------------------------------------
create table if not exists public.transactions (
  id                   uuid primary key default gen_random_uuid(),
  txn_date             date not null default current_date,
  txn_type             text not null check (txn_type in ('income','expense')),
  category             text not null check (category in (
                         'membership_fee','monthly_due','sponsor','government_support','donation',
                         'fines','other_income',
                         'meeting_expense','office_supplies','transportation','assistance_to_members',
                         'rewards','other_expense')),
  member_id            uuid references public.members(id),
  source_or_payee      text default '',
  due_month            date,           -- para sa monthly dues: first day sa bulan nga gibayran
  amount               numeric(12,2) not null check (amount >= 0),
  is_in_kind           boolean not null default false,   -- e.g. feeds, biik, bakuna gikan sa gobyerno
  in_kind_description  text default '',
  or_number            text default '',
  description          text default '',
  audited              boolean not null default false,
  audited_by           text,
  audited_at           timestamptz,
  audit_note           text default '',
  recorded_by          uuid default auth.uid(),
  created_at           timestamptz default now(),
  constraint chk_income_cat check (
    (txn_type = 'income'  and category in ('membership_fee','monthly_due','sponsor','government_support','donation','fines','other_income')) or
    (txn_type = 'expense' and category in ('meeting_expense','office_supplies','transportation','assistance_to_members','rewards','other_expense'))),
  constraint chk_due_month check (category <> 'monthly_due' or (member_id is not null and due_month is not null))
);
create unique index if not exists uq_monthly_due on public.transactions(member_id, due_month)
  where category = 'monthly_due';
create unique index if not exists uq_membership_fee on public.transactions(member_id)
  where category = 'membership_fee';
create index if not exists idx_txn_date on public.transactions(txn_date desc);

-- Auditor: maka-audit ra, dili maka-usab sa amount. Audited na: dili na mausab/mapapas.
create or replace function public.transactions_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.due_month is not null then new.due_month := date_trunc('month', new.due_month)::date; end if;
  if tg_op = 'DELETE' then
    if old.audited then raise exception 'Na-audit na ni nga transaction; dili na mapapas.'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if has_role(array['auditor']::officer_role[]) then
      if (new.txn_date, new.txn_type, new.category, new.member_id, new.source_or_payee, new.due_month,
          new.amount, new.is_in_kind, new.or_number, new.description)
         is distinct from
         (old.txn_date, old.txn_type, old.category, old.member_id, old.source_or_payee, old.due_month,
          old.amount, old.is_in_kind, old.or_number, old.description) then
        raise exception 'Ang Auditor maka-audit ra; dili maka-usab sa detalye sa transaction.';
      end if;
    elsif old.audited and new.audited then
      raise exception 'Na-audit na ni nga transaction; ang Auditor ra ang maka-unmark.';
    end if;
    if new.audited and not old.audited then
      new.audited_at := now();
      new.audited_by := coalesce((select nullif(full_name,'') from profiles where id = auth.uid()),
                                 (select email from profiles where id = auth.uid()));
    elsif not new.audited then
      new.audited_at := null; new.audited_by := null;
    end if;
    if not has_role(array['auditor','president']::officer_role[]) and new.audited is distinct from old.audited then
      raise exception 'Ang Auditor ra ang maka-mark nga audited.';
    end if;
  end if;
  if tg_op = 'INSERT' then new.audited := false; new.audited_at := null; new.audited_by := null; end if;
  return new;
end $$;
drop trigger if exists trg_transactions_guard on public.transactions;
create trigger trg_transactions_guard before insert or update or delete on public.transactions
  for each row execute function public.transactions_guard();

-- ---------------------------------------------------------------------
-- 7. MEETINGS & ATTENDANCE
-- ---------------------------------------------------------------------
create table if not exists public.meetings (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  meeting_date  date not null,
  start_time    time,
  venue         text default '',
  meeting_type  text not null default 'regular'
                check (meeting_type in ('regular','special','general_assembly','orientation')),
  agenda        text default '',
  minutes       text default '',
  created_by    uuid default auth.uid(),
  created_at    timestamptz default now()
);

create table if not exists public.attendance (
  meeting_id   uuid not null references public.meetings(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  status       text not null check (status in ('present','late','excused','absent')),
  recorded_at  timestamptz default now(),
  primary key (meeting_id, member_id)
);

-- ---------------------------------------------------------------------
-- 8. REWARDS
-- ---------------------------------------------------------------------
create table if not exists public.rewards (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  award_date   date not null default current_date,
  award_type   text not null check (award_type in
                ('pioneer','perfect_attendance','very_active','loyalty','top_raiser','other')),
  title        text not null,
  description  text default '',
  value        numeric(12,2) default 0,
  given_by     text default '',
  created_by   uuid default auth.uid(),
  created_at   timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 9. VIEWS (reports)
-- ---------------------------------------------------------------------
create or replace view public.v_current_herd with (security_invoker = true) as
select distinct on (h.member_id)
  h.member_id, h.record_date, h.sows, h.gilts, h.boars, h.piglets, h.fatteners,
  (h.sows + h.gilts + h.boars + h.piglets + h.fatteners) as total
from public.herd_updates h
order by h.member_id, h.record_date desc, h.created_at desc;

-- Attendance rate ug category (Very Active / Active / Less Active / Inactive)
create or replace view public.v_member_activity with (security_invoker = true) as
with s as (select * from public.settings where id = 1),
base as (
  select m.id as member_id,
         count(mt.id) as meetings_held,
         count(a.*) filter (where a.status in ('present','late')) as attended,
         count(a.*) filter (where a.status = 'present') as on_time,
         count(a.*) filter (where a.status = 'late') as late,
         count(a.*) filter (where a.status = 'excused') as excused
  from public.members m
  left join public.meetings mt
         on mt.meeting_date >= coalesce(m.membership_date, m.application_date)
        and mt.meeting_date <= current_date
        and mt.meeting_type <> 'orientation'
  left join public.attendance a on a.meeting_id = mt.id and a.member_id = m.id
  where m.status = 'active'
  group by m.id
)
select b.*,
       (b.meetings_held - b.excused - b.attended) as absences,
       case when b.meetings_held - b.excused > 0
            then round(100.0 * b.attended / (b.meetings_held - b.excused))::int end as attendance_rate,
       case
         when b.meetings_held - b.excused <= 0 then 'New'
         when 100.0 * b.attended / (b.meetings_held - b.excused) >= s.very_active_threshold then 'Very Active'
         when 100.0 * b.attended / (b.meetings_held - b.excused) >= s.active_threshold then 'Active'
         when 100.0 * b.attended / (b.meetings_held - b.excused) >= s.less_active_threshold then 'Less Active'
         else 'Inactive'
       end as activity_category
from base b cross join s;

-- Monthly dues: pila ka bulan ang wala pa mabayri
create or replace view public.v_dues_status with (security_invoker = true) as
with s as (select monthly_due from public.settings where id = 1),
months as (
  select m.id as member_id, gs::date as due_month
  from public.members m,
       generate_series(date_trunc('month', coalesce(m.membership_date, m.application_date)),
                       date_trunc('month', current_date), interval '1 month') gs
  where m.status = 'active'
)
select mo.member_id,
       count(*) as months_due,
       count(t.id) as months_paid,
       count(*) - count(t.id) as months_unpaid,
       (count(*) - count(t.id)) * (select monthly_due from s) as amount_unpaid,
       max(t.due_month) as last_paid_month,
       exists (select 1 from public.transactions f
               where f.member_id = mo.member_id and f.category = 'membership_fee') as membership_fee_paid
from months mo
left join public.transactions t
       on t.member_id = mo.member_id and t.category = 'monthly_due' and t.due_month = mo.due_month
group by mo.member_id;

-- ---------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY
--   president      : tanan
--   secretary      : members, herd, disposals, meetings, attendance, rewards
--   treasurer      : finance
--   auditor        : makakita tanan + maka-audit sa finance
--   vice_president, pro, board_member : makakita ra (read-only)
--   pending        : walay access hangtod i-assign sa president
-- ---------------------------------------------------------------------
alter table public.settings     enable row level security;
alter table public.profiles     enable row level security;
alter table public.members      enable row level security;
alter table public.herd_updates enable row level security;
alter table public.disposals    enable row level security;
alter table public.transactions enable row level security;
alter table public.meetings     enable row level security;
alter table public.attendance   enable row level security;
alter table public.rewards      enable row level security;

do $$
declare t text;
begin
  -- limpyo sa daang policies aron ma-run balik ang script
  for t in select policyname || ' on public.' || tablename from pg_policies where schemaname = 'public' loop
    execute 'drop policy if exists ' || t;
  end loop;
end $$;

-- settings
create policy settings_read  on public.settings for select using (public.is_officer());
create policy settings_write on public.settings for update
  using (public.has_role(array['president','secretary']::officer_role[]));

-- profiles
create policy profiles_read on public.profiles for select using (public.is_officer() or id = auth.uid());
create policy profiles_self on public.profiles for update using (id = auth.uid());
create policy profiles_pres on public.profiles for update using (public.has_role(array['president']::officer_role[]));
create policy profiles_del  on public.profiles for delete using (public.has_role(array['president']::officer_role[]) and id <> auth.uid());

-- members / herd / disposals / meetings / attendance / rewards
do $$
declare t text;
begin
  foreach t in array array['members','herd_updates','disposals','meetings','attendance','rewards'] loop
    execute format('create policy %1$s_read on public.%1$s for select using (public.is_officer())', t);
    execute format('create policy %1$s_ins on public.%1$s for insert with check (public.has_role(array[''president'',''secretary'']::officer_role[]))', t);
    execute format('create policy %1$s_upd on public.%1$s for update using (public.has_role(array[''president'',''secretary'']::officer_role[]))', t);
  end loop;
  foreach t in array array['members','herd_updates','disposals','meetings','rewards'] loop
    execute format('create policy %1$s_del on public.%1$s for delete using (public.has_role(array[''president'']::officer_role[]))', t);
  end loop;
end $$;
create policy attendance_del on public.attendance for delete
  using (public.has_role(array['president','secretary']::officer_role[]));

-- transactions
create policy txn_read on public.transactions for select using (public.is_officer());
create policy txn_ins  on public.transactions for insert
  with check (public.has_role(array['president','treasurer']::officer_role[]));
create policy txn_upd  on public.transactions for update
  using (public.has_role(array['president','treasurer','auditor']::officer_role[]));
create policy txn_del  on public.transactions for delete
  using (public.has_role(array['president','treasurer']::officer_role[]));

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.my_role(), public.has_role(public.officer_role[]), public.is_officer() to authenticated;
