-- Inicia livro-caixa sem inventar saldos ou desembolsos históricos.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FINANCE_SETUP';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FINANCE_ENTRY_CREATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FINANCE_ENTRY_REVERSE';

CREATE TYPE "FinanceEntryType" AS ENUM ('CONTRIBUTION','WITHDRAWAL','EXPENSE','DISBURSEMENT');

CREATE TABLE "CashBook" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "openingBalance" DECIMAL(14,2) NOT NULL,
  "startedAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" UUID NOT NULL,
  CONSTRAINT "CashBook_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashBook_creator_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CashBook_singleton" CHECK ("id" = 1),
  CONSTRAINT "CashBook_opening_nonnegative" CHECK ("openingBalance" >= 0)
);

CREATE TABLE "FinanceEntry" (
  "id" UUID NOT NULL,
  "bookId" INTEGER NOT NULL DEFAULT 1,
  "type" "FinanceEntryType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "effectiveAt" TIMESTAMPTZ NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "loanId" UUID,
  "idempotencyKey" VARCHAR(128),
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedAt" TIMESTAMPTZ,
  "reversedById" UUID,
  "reversalReason" VARCHAR(500),
  CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceEntry_book_fkey" FOREIGN KEY ("bookId") REFERENCES "CashBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceEntry_creator_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceEntry_reverser_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "FinanceEntry_loan_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceEntry_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "FinanceEntry_loan_type" CHECK (("type" = 'DISBURSEMENT' AND "loanId" IS NOT NULL) OR ("type" <> 'DISBURSEMENT' AND "loanId" IS NULL)),
  CONSTRAINT "FinanceEntry_reversal" CHECK (("reversedAt" IS NULL AND "reversalReason" IS NULL AND "reversedById" IS NULL) OR ("reversedAt" IS NOT NULL AND "reversalReason" IS NOT NULL AND "reversedById" IS NOT NULL))
);

CREATE UNIQUE INDEX "FinanceEntry_loanId_key" ON "FinanceEntry"("loanId");
CREATE UNIQUE INDEX "FinanceEntry_idempotencyKey_key" ON "FinanceEntry"("idempotencyKey");
CREATE INDEX "FinanceEntry_effectiveAt_idx" ON "FinanceEntry"("effectiveAt");
CREATE INDEX "FinanceEntry_type_effectiveAt_idx" ON "FinanceEntry"("type","effectiveAt");
CREATE INDEX "FinanceEntry_reversedAt_idx" ON "FinanceEntry"("reversedAt");
