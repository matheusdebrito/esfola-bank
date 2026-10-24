-- Preserva referências históricas de empréstimos, pagamentos, caixa e auditoria.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMPTZ(6);

-- Identifica exclusões lógicas sem apagar e-mails ou relações financeiras.
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_DELETE';
