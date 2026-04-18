begin;

create extension if not exists pgcrypto;

create table if not exists teams (
  id serial primary key,
  name text not null unique,
  password_hash text not null,
  members text[] not null default '{}',
  hp integer not null default 10000,
  ap integer not null default 0,
  is_eliminated boolean not null default false,
  is_admin boolean not null default false,
  alliance_id integer,
  active_task_id integer,
  tasks_completed integer not null default 0,
  attacks_made integer not null default 0,
  completed_task_ids integer[] not null default '{}',
  last_completed_task_ap integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id serial primary key,
  title text not null,
  description text not null,
  type text not null,
  difficulty text not null,
  ap_reward integer not null,
  content text not null,
  answer text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists game_state (
  id serial primary key,
  status text not null default 'waiting',
  current_epoch integer not null default 0,
  epoch_started_at timestamptz,
  epoch_ends_at timestamptz,
  epoch_duration_seconds integer not null default 900,
  total_epochs integer not null default 16,
  phase text not null default 'task',
  updated_at timestamptz not null default now()
);

create table if not exists alliances (
  id serial primary key,
  team1_id integer not null,
  team2_id integer not null,
  is_active boolean not null default true,
  backstabbed_by integer,
  backstab_in_progress boolean not null default false,
  backstab_initiator_id integer,
  backstab_bonus_ap integer not null default 0,
  suspicion_in_progress boolean not null default false,
  suspicion_initiator_id integer,
  created_at timestamptz not null default now(),
  dissolved_at timestamptz
);

create table if not exists alliance_requests (
  id serial primary key,
  from_team_id integer not null,
  to_team_id integer not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists game_events (
  id serial primary key,
  type text not null,
  from_team_id integer,
  from_team_name text,
  to_team_id integer,
  to_team_name text,
  description text not null,
  epoch integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_teams_alliance_id on teams(alliance_id);
create index if not exists idx_teams_is_eliminated on teams(is_eliminated);
create index if not exists idx_tasks_is_active on tasks(is_active);
create index if not exists idx_alliances_active on alliances(is_active);
create index if not exists idx_alliance_requests_to_team on alliance_requests(to_team_id, status);
create index if not exists idx_game_events_created_at on game_events(created_at desc);

commit;
