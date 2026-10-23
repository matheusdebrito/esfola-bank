import { prisma } from "./config/prisma";
import { env, isProduction, isTest } from "./config/env";
import { logger } from "./config/logger";
import { passwordService } from "./modules/auth/password.service";

/**
 * Garante que exista ao menos um usuário administrador para o primeiro acesso.
 * Só executa quando a tabela de usuários está vazia, portanto nunca sobrescreve
 * usuários existentes. Em produção, defina ADMIN_EMAIL e ADMIN_PASSWORD.
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  if (isTest()) return;

  const total = await prisma.user.count();
  if (total > 0) return;

  const passwordHash = await passwordService.hash(env.ADMIN_PASSWORD);
  await prisma.user.create({
    data: {
      email: env.ADMIN_EMAIL,
      name: "Administrador",
      passwordHash,
      role: "ADMIN",
      active: true,
    },
  });

  logger.warn(
    { email: env.ADMIN_EMAIL },
    "Nenhum usuário encontrado: administrador inicial criado. Altere a senha após o primeiro acesso.",
  );

  if (isProduction() && env.ADMIN_PASSWORD === "Admin@12345") {
    logger.warn("ADMIN_PASSWORD padrão em produção. Defina uma senha forte e remova o usuário padrão.");
  }
}
