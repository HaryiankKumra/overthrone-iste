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
