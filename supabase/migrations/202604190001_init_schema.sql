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
begin;

insert into game_state (
  status,
  current_epoch,
  epoch_duration_seconds,
  total_epochs,
  phase
)
select
  'waiting',
  0,
  900,
  16,
  'task'
where not exists (select 1 from game_state);

insert into teams (
  name,
  password_hash,
  members,
  hp,
  ap,
  is_eliminated,
  is_admin,
  alliance_id,
  active_task_id,
  tasks_completed,
  attacks_made,
  completed_task_ids,
  last_completed_task_ap
)
values (
  'ISTE Admin',
  '45f2bc35b573ef8a3453e98cfd3ad84626e3bf5e17cb11dc6fbddc7ac32f6a78',
  '{}',
  10000,
  0,
  false,
  true,
  null,
  null,
  0,
  0,
  '{}',
  0
)
on conflict (name) do update
set
  password_hash = excluded.password_hash,
  is_admin = true,
  is_eliminated = false,
  updated_at = now();

insert into tasks (title, description, type, difficulty, ap_reward, content, answer, is_active)
select * from (
  values
    ('Sudoku Scout Grid', 'Complete a mini 4x4 logic grid.', 'sudoku', 'easy', 150, 'Fill missing digits in each row/column (1-4). Row 1: 1 _ 3 4. Return the missing value.', '2', true),
    ('Ciphered Banner', 'Decode a Caesar-shifted signal.', 'ctf', 'easy', 150, 'Decode Caesar +3: RYHUWKURQH. Return lowercase.', 'overthrone', true),
    ('Knight Arithmetic', 'Compute a fast integer expression.', 'math', 'easy', 150, 'Evaluate: (27 * 4) - (18 / 3) + 11', '113', true),
    ('Pathfinder Runtime', 'Choose the best time complexity.', 'algorithm', 'medium', 300, 'Average time complexity of binary search on sorted array?', 'o(log n)', true),
    ('Matrix Tribute', 'Solve a matrix determinant puzzle.', 'math', 'medium', 300, 'Determinant of [[2,3],[1,4]]', '5', true),
    ('Flag Fragment', 'Rebuild the hidden token.', 'ctf', 'medium', 300, 'part1=throne, part2=rise, format over{part1_part2}', 'over{throne_rise}', true),
    ('Siege Scheduler', 'Greedy strategy identification.', 'algorithm', 'hard', 500, 'Name greedy strategy selecting non-overlapping intervals by earliest finish time.', 'interval scheduling', true),
    ('Royal Prime Trial', 'Prime-check edge case.', 'math', 'hard', 500, 'Is 104729 prime? answer yes/no', 'yes', true),
    ('Shadow Sudoku', 'Deduce a hidden cell from constraints.', 'sudoku', 'medium', 300, 'Row has 1,2,3,4,6,7,8,9. Missing?', '5', true),
    ('Breach Traceback', 'Recover root cause from logs.', 'ctf', 'hard', 500, 'Required HTTP auth scheme from header Bearer <token>?', 'bearer', true)
) as v(title, description, type, difficulty, ap_reward, content, answer, is_active)
where not exists (select 1 from tasks t where t.title = v.title);

commit;
begin;

alter table teams disable row level security;
alter table tasks disable row level security;
alter table game_state disable row level security;
alter table alliances disable row level security;
alter table alliance_requests disable row level security;
alter table game_events disable row level security;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_teams_updated_at on teams;
create trigger trg_teams_updated_at
before update on teams
for each row
execute function set_updated_at();

drop trigger if exists trg_game_state_updated_at on game_state;
create trigger trg_game_state_updated_at
before update on game_state
for each row
execute function set_updated_at();

commit;
