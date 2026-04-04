-- Budget Tracker Schema
-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  year integer not null,
  month integer not null check (month between 1 and 12),
  label text not null,
  salary numeric(12,2) not null default 0,
  rent_income numeric(12,2) not null default 0,
  other_income numeric(12,2) not null default 0,
  created_at timestamptz default now(),
  unique(user_id, year, month)
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  month_id uuid references months(id) on delete cascade not null,
  account_name text not null,
  account_type text not null check (account_type in ('chequing','savings','investment','rrsp','tfsa','mutual_fund')),
  balance numeric(12,2) not null default 0,
  is_liquid boolean not null default false
);

create table if not exists fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  month_id uuid references months(id) on delete cascade not null,
  category text not null,
  budgeted numeric(12,2) not null default 0,
  actual numeric(12,2),
  paid_date date
);

create table if not exists variable_budget (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  month_id uuid references months(id) on delete cascade not null,
  category text not null,
  budgeted numeric(12,2) not null default 0,
  unique(month_id, category)
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  month_id uuid references months(id) on delete cascade not null,
  date date not null,
  week_number integer not null check (week_number between 1 and 5),
  category text not null,
  subcategory text not null default '',
  amount numeric(12,2) not null check (amount >= 0),
  notes text,
  is_shared boolean not null default false,
  shared_direction text check (shared_direction in ('from_thiyag','to_thiyag'))
);

create table if not exists investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  month_id uuid references months(id) on delete cascade not null,
  vehicle text not null,
  budgeted numeric(12,2) not null default 0,
  actual numeric(12,2),
  contributed_date date,
  unique(month_id, vehicle)
);

create table if not exists shared_settlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  month_id uuid references months(id) on delete cascade not null,
  direction text not null check (direction in ('from_thiyag','to_thiyag')),
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  date date not null,
  settled boolean not null default false
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table months enable row level security;
alter table accounts enable row level security;
alter table fixed_expenses enable row level security;
alter table variable_budget enable row level security;
alter table transactions enable row level security;
alter table investments enable row level security;
alter table shared_settlements enable row level security;

-- Each user sees only their own rows
create policy "months_own" on months for all using (auth.uid() = user_id);
create policy "accounts_own" on accounts for all using (auth.uid() = user_id);
create policy "fixed_expenses_own" on fixed_expenses for all using (auth.uid() = user_id);
create policy "variable_budget_own" on variable_budget for all using (auth.uid() = user_id);
create policy "transactions_own" on transactions for all using (auth.uid() = user_id);
create policy "investments_own" on investments for all using (auth.uid() = user_id);
create policy "shared_settlements_own" on shared_settlements for all using (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists transactions_month_idx on transactions(month_id);
create index if not exists transactions_date_idx on transactions(date);
create index if not exists accounts_month_idx on accounts(month_id);
