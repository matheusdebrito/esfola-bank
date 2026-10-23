import { config } from "dotenv";
import { execSync } from "child_process";

// Carrega variáveis de ambiente antes de qualquer módulo da app
config({ path: ".env.test", override: true });

// Força ambiente de teste
process.env.NODE_ENV = "test";

// Se DATABASE_URL de teste estiver disponível, roda migrations contra ele
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  try {
    execSync("npx prisma migrate deploy", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
    });
  } catch {
    // migrations só rodam quando um banco de teste está disponível (Docker/CI)
  }
}
