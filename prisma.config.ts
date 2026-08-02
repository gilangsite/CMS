import { config } from "dotenv";
// Load both .env and .env.local (Next.js convention)
config({ path: ".env" });
config({ path: ".env.local", override: true });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL!,
    // directUrl is used for migrations with Neon pooled connections
    // directUrl: process.env.DIRECT_URL,
  },
});
