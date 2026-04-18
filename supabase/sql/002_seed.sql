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
