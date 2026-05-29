create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'staff');
  end if;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'staff',
  created_at timestamptz not null default now()
);

create table if not exists public.datasets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  source_filename text,
  is_active boolean not null default false,
  require_registration_first boolean not null default true,
  registration_station_id uuid,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  label text not null,
  station_key text not null,
  station_token text not null unique,
  ordinal integer not null default 1,
  created_at timestamptz not null default now()
);

create unique index if not exists stations_dataset_key_unique
  on public.stations(dataset_id, station_key);

create table if not exists public.delegates (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  delegate_id text not null,
  normalized_delegate_id text not null,
  full_name text,
  mobile text,
  category text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists delegates_dataset_delegate_unique
  on public.delegates(dataset_id, normalized_delegate_id);

create table if not exists public.delegate_station_status (
  id uuid primary key default gen_random_uuid(),
  delegate_id uuid not null references public.delegates(id) on delete cascade,
  station_id uuid not null references public.stations(id) on delete cascade,
  eligible boolean not null default true,
  status text not null default 'PENDING',
  used_at timestamptz,
  used_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(delegate_id, station_id)
);

create table if not exists public.scan_logs (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  station_id uuid references public.stations(id) on delete set null,
  delegate_id uuid references public.delegates(id) on delete set null,
  scanned_input text not null,
  result text not null,
  message text not null,
  operator_name text,
  scanned_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.datasets
  drop constraint if exists datasets_registration_station_id_fkey;
alter table public.datasets
  add constraint datasets_registration_station_id_fkey
  foreign key (registration_station_id)
  references public.stations(id)
  on delete set null;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.datasets enable row level security;
alter table public.stations enable row level security;
alter table public.delegates enable row level security;
alter table public.delegate_station_status enable row level security;
alter table public.scan_logs enable row level security;
alter table public.admin_audit_logs enable row level security;

create or replace function public.current_org_id()
returns uuid
language sql
stable
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role()
returns public.app_role
language sql
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

drop policy if exists "org read organizations" on public.organizations;
create policy "org read organizations" on public.organizations
for select using (id = public.current_org_id());

drop policy if exists "org read profiles" on public.profiles;
create policy "org read profiles" on public.profiles
for select using (organization_id = public.current_org_id());

drop policy if exists "org read datasets" on public.datasets;
create policy "org read datasets" on public.datasets
for select using (organization_id = public.current_org_id());

drop policy if exists "org read stations" on public.stations;
create policy "org read stations" on public.stations
for select using (
  exists (
    select 1 from public.datasets d
    where d.id = stations.dataset_id
    and d.organization_id = public.current_org_id()
  )
);

drop policy if exists "org read delegates" on public.delegates;
create policy "org read delegates" on public.delegates
for select using (
  exists (
    select 1 from public.datasets d
    where d.id = delegates.dataset_id
    and d.organization_id = public.current_org_id()
  )
);

drop policy if exists "org read delegate status" on public.delegate_station_status;
create policy "org read delegate status" on public.delegate_station_status
for select using (
  exists (
    select 1
    from public.delegates de
    join public.datasets d on d.id = de.dataset_id
    where de.id = delegate_station_status.delegate_id
    and d.organization_id = public.current_org_id()
  )
);

drop policy if exists "org read scan logs" on public.scan_logs;
create policy "org read scan logs" on public.scan_logs
for select using (
  exists (
    select 1 from public.datasets d
    where d.id = scan_logs.dataset_id
    and d.organization_id = public.current_org_id()
  )
);

drop policy if exists "org read admin audit" on public.admin_audit_logs;
create policy "org read admin audit" on public.admin_audit_logs
for select using (organization_id = public.current_org_id());

-- Admin-only write access through authenticated client.
drop policy if exists "admin write profiles" on public.profiles;
create policy "admin write profiles" on public.profiles
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "admin write datasets" on public.datasets;
create policy "admin write datasets" on public.datasets
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "admin write stations" on public.stations;
create policy "admin write stations" on public.stations
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "admin write delegates" on public.delegates;
create policy "admin write delegates" on public.delegates
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "admin write delegate status" on public.delegate_station_status;
create policy "admin write delegate status" on public.delegate_station_status
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "admin write scan logs" on public.scan_logs;
create policy "admin write scan logs" on public.scan_logs
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "admin write audit logs" on public.admin_audit_logs;
create policy "admin write audit logs" on public.admin_audit_logs
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

insert into public.organizations (name)
select 'Default Organization'
where not exists (select 1 from public.organizations);
