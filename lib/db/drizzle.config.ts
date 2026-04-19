import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "url";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// __dirname is undefined in ESM; derive it from import.meta.url instead
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ssl =
  process.env.DATABASE_SSL === "true" || process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : undefined;

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl,
  },
});
