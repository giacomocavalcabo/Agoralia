-- Minimal Postgres schema for ColdAI (multi-tenant ready)
-- Run with: psql "$DATABASE_URL" -f backend/migrations/0001_init.sql

create table if not exists calls (
  id serial primary key,
  tenant_id int null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  direction varchar(16) not null,
  provider varchar(32) default 'retell',
  to_number varchar(32),
  from_number varchar(32),
  provider_call_id varchar(128),
  status varchar(32) default 'created',
  raw_response text
);

create table if not exists call_segments (
  id serial primary key,
  tenant_id int null,
  call_id int references calls(id),
  provider_call_id varchar(128),
  turn_index int,
  speaker varchar(16),
  start_ms int,
  end_ms int,
  text text,
  ts timestamptz default now()
);

create table if not exists summaries (
  id serial primary key,
  tenant_id int null,
  call_id int references calls(id),
  provider_call_id varchar(128),
  bullets_json text,
  created_at timestamptz default now()
);

create table if not exists call_structured (
  id serial primary key,
  tenant_id int null,
  call_id int references calls(id),
  bant_json text,
  trade_json text,
  created_at timestamptz default now()
);

create table if not exists call_media (
  id serial primary key,
  tenant_id int null,
  call_id int references calls(id),
  audio_url text,
  created_at timestamptz default now()
);

create table if not exists dispositions (
  id serial primary key,
  tenant_id int null,
  call_id int references calls(id),
  outcome varchar(64),
  note text,
  updated_at timestamptz default now()
);

create table if not exists settings (
  id serial primary key,
  tenant_id int null,
  default_agent_id varchar(128),
  default_from_number varchar(32),
  default_spacing_ms int default 1000,
  require_legal_review int default 1,
  legal_defaults_json text
);

create table if not exists webhook_events (
  id serial primary key,
  tenant_id int null,
  event_id varchar(128),
  type varchar(64),
  received_at timestamptz default now(),
  processed int default 0,
  raw_json text
);

create table if not exists webhook_dlq (
  id serial primary key,
  tenant_id int null,
  event_id varchar(128),
  error text,
  raw_json text,
  created_at timestamptz default now()
);

create table if not exists agents (
  id serial primary key,
  tenant_id int null,
  name varchar(128) not null,
  lang varchar(16),
  voice_id varchar(64)
);

create table if not exists kbs (
  id serial primary key,
  tenant_id int null,
  lang varchar(16),
  scope varchar(16)
);

create table if not exists numbers (
  id serial primary key,
  tenant_id int null,
  e164 varchar(32) not null,
  type varchar(16) default 'retell',
  verified int default 0,
  country varchar(8)
);

create table if not exists dnc_numbers (
  id serial primary key,
  tenant_id int null,
  e164 varchar(32) not null,
  created_at timestamptz default now()
);

create table if not exists consents (
  id serial primary key,
  tenant_id int null,
  lead_id int,
  number varchar(32),
  type varchar(32) not null,
  status varchar(16) not null,
  source varchar(64),
  proof_url text,
  ts timestamptz default now()
);

create table if not exists crm_connections (
  id serial primary key,
  tenant_id int null,
  provider varchar(32) not null,
  auth_json text,
  enabled int default 1,
  created_at timestamptz default now()
);

create table if not exists crm_mappings (
  id serial primary key,
  tenant_id int null,
  provider varchar(32) not null,
  object_type varchar(32) not null,
  field_map_json text,
  updated_at timestamptz default now()
);

create table if not exists users (
  id serial primary key,
  tenant_id int not null,
  email varchar(256) not null,
  name varchar(128),
  password_salt varchar(64) not null,
  password_hash varchar(128) not null,
  is_admin int default 0,
  created_at timestamptz default now()
);

-- Optional: enable RLS and policies (requires app setting current_setting('app.tenant_id'))
-- alter table calls enable row level security;
-- create policy calls_tenant_isolation on calls using (tenant_id = current_setting('app.tenant_id')::int);


