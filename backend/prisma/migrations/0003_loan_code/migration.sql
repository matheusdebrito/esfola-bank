-- AlterTable
ALTER TABLE "Loan" ADD COLUMN "code" TEXT;

-- CreateTable
CREATE TABLE "LoanCodeCounter" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanCodeCounter_pkey" PRIMARY KEY ("year")
);

-- Backfill: identificador por ano de concessão, na ordem de criação
WITH ranked AS (
    SELECT "id",
           EXTRACT(YEAR FROM COALESCE("grantedAt", "createdAt"))::int AS "year",
           ROW_NUMBER() OVER (
               PARTITION BY EXTRACT(YEAR FROM COALESCE("grantedAt", "createdAt"))
               ORDER BY "createdAt", "id"
           ) AS rn
    FROM "Loan"
)
UPDATE "Loan" l
SET "code" = 'EMP-' || r."year"::text || '-' || LPAD(r.rn::text, 4, '0')
FROM ranked r
WHERE l."id" = r."id";

-- Semeia o contador com o último sequencial utilizado em cada ano
INSERT INTO "LoanCodeCounter" ("year", "lastValue", "updatedAt")
SELECT EXTRACT(YEAR FROM COALESCE("grantedAt", "createdAt"))::int AS "year",
       COUNT(*)::int AS "lastValue",
       NOW()
FROM "Loan"
GROUP BY 1
ON CONFLICT ("year") DO NOTHING;

-- Torna o identificador obrigatório e único
ALTER TABLE "Loan" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "Loan_code_key" ON "Loan"("code");
