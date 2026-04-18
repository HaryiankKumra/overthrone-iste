import crypto from "node:crypto";
import {
  db,
  pool,
  gameStateTable,
  tasksTable,
  teamsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

type TaskSeed = {
  title: string;
  description: string;
  type: "sudoku" | "math" | "ctf" | "algorithm";
  difficulty: "easy" | "medium" | "hard";
  content: string;
  answer: string;
};

const ADMIN_NAME = "ISTE Admin";
const ADMIN_PASSWORD = "admin123";
const PASSWORD_SALT = "overthrone_salt_2024";

const AP_REWARD_BY_DIFFICULTY: Record<TaskSeed["difficulty"], number> = {
  easy: 150,
  medium: 300,
  hard: 500,
};

const DEFAULT_TASKS: TaskSeed[] = [
  {
    title: "Sudoku Scout Grid",
    description: "Complete a mini 4x4 logic grid.",
    type: "sudoku",
    difficulty: "easy",
    content:
      "Fill missing digits in each row/column (1-4).\nGrid row 1: 1 _ 3 4\nAnswer should be the missing value in row 1 as a single number.",
    answer: "2",
  },
  {
    title: "Ciphered Banner",
    description: "Decode a Caesar-shifted signal.",
    type: "ctf",
    difficulty: "easy",
    content:
      "Decode this Caesar cipher shifted by +3: RYHUWKURQH\nAnswer in lowercase.",
    answer: "overthrone",
  },
  {
    title: "Knight Arithmetic",
    description: "Compute a fast integer expression.",
    type: "math",
    difficulty: "easy",
    content: "Evaluate: (27 * 4) - (18 / 3) + 11",
    answer: "113",
  },
  {
    title: "Pathfinder Runtime",
    description: "Choose the best time complexity.",
    type: "algorithm",
    difficulty: "medium",
    content:
      "What is the average time complexity of binary search on a sorted array?\nUse Big-O notation.",
    answer: "o(log n)",
  },
  {
    title: "Matrix Tribute",
    description: "Solve a matrix determinant puzzle.",
    type: "math",
    difficulty: "medium",
    content:
      "For matrix [[2,3],[1,4]], compute determinant.\nAnswer as integer.",
    answer: "5",
  },
  {
    title: "Flag Fragment",
    description: "Rebuild the hidden token.",
    type: "ctf",
    difficulty: "medium",
    content:
      "Token format is over{part1_part2}.\nGiven part1=throne, part2=rise.\nProvide full token.",
    answer: "over{throne_rise}",
  },
  {
    title: "Siege Scheduler",
    description: "Greedy strategy identification.",
    type: "algorithm",
    difficulty: "hard",
    content:
      "Name the classic greedy strategy used to select non-overlapping intervals by earliest finish time.",
    answer: "interval scheduling",
  },
  {
    title: "Royal Prime Trial",
    description: "Prime-check edge case.",
    type: "math",
    difficulty: "hard",
    content:
      "Is 104729 prime? Respond with exactly one word: yes or no.",
    answer: "yes",
  },
  {
    title: "Shadow Sudoku",
    description: "Deduce a hidden cell from constraints.",
    type: "sudoku",
    difficulty: "medium",
    content:
      "In a row, digits 1-9 appear once. Existing digits: 1,2,3,4,6,7,8,9.\nWhat is missing?",
    answer: "5",
  },
  {
    title: "Breach Traceback",
    description: "Recover root cause from logs.",
    type: "ctf",
    difficulty: "hard",
    content:
      "HTTP logs show repeated 401 until token format changed from 'Bearer token' to 'Bearer <token>'.\nWhat header scheme is required?",
    answer: "bearer",
  },
];

function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(password + PASSWORD_SALT)
    .digest("hex");
}

async function ensureGameState(): Promise<{ id: number; created: boolean }> {
  const [state] = await db.select().from(gameStateTable).limit(1);
  if (state) {
    return { id: state.id, created: false };
  }

  const [created] = await db
    .insert(gameStateTable)
    .values({
      status: "waiting",
      currentEpoch: 0,
      phase: "task",
      epochDurationSeconds: 900,
      totalEpochs: 16,
    })
    .returning({ id: gameStateTable.id });

  return { id: created.id, created: true };
}

async function ensureAdmin(): Promise<{ id: number; created: boolean }> {
  const [existingAdmin] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.name, ADMIN_NAME))
    .limit(1);

  const passwordHash = hashPassword(ADMIN_PASSWORD);

  if (existingAdmin) {
    await db
      .update(teamsTable)
      .set({
        passwordHash,
        isAdmin: true,
        isEliminated: false,
      })
      .where(eq(teamsTable.id, existingAdmin.id));

    return { id: existingAdmin.id, created: false };
  }

  const [createdAdmin] = await db
    .insert(teamsTable)
    .values({
      name: ADMIN_NAME,
      passwordHash,
      members: [],
      isAdmin: true,
      hp: 10000,
      ap: 0,
      isEliminated: false,
      allianceId: null,
      activeTaskId: null,
      tasksCompleted: 0,
      attacksMade: 0,
      completedTaskIds: [],
      lastCompletedTaskAp: 0,
    })
    .returning({ id: teamsTable.id });

  return { id: createdAdmin.id, created: true };
}

async function ensureDefaultTasks(): Promise<{ inserted: number; total: number }> {
  const existingTasks = await db
    .select({ title: tasksTable.title })
    .from(tasksTable);

  const existingTitles = new Set(existingTasks.map((task) => task.title));

  const tasksToInsert = DEFAULT_TASKS.filter(
    (task) => !existingTitles.has(task.title),
  ).map((task) => ({
    ...task,
    apReward: AP_REWARD_BY_DIFFICULTY[task.difficulty],
    isActive: true,
  }));

  if (tasksToInsert.length > 0) {
    await db.insert(tasksTable).values(tasksToInsert);
  }

  const totalTasks = await db.select({ id: tasksTable.id }).from(tasksTable);

  return { inserted: tasksToInsert.length, total: totalTasks.length };
}

async function main() {
  const gameState = await ensureGameState();
  const admin = await ensureAdmin();
  const tasks = await ensureDefaultTasks();

  console.log("Seeding complete.");
  console.log(
    `Game state: ${gameState.created ? "created" : "already exists"} (id=${gameState.id})`,
  );
  console.log(
    `Admin team: ${admin.created ? "created" : "updated"} (id=${admin.id}, name=${ADMIN_NAME}, password=${ADMIN_PASSWORD})`,
  );
  console.log(
    `Tasks: inserted ${tasks.inserted}, total tasks in DB ${tasks.total}`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
