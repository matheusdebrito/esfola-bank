import { createApp, applyErrorHandling } from "../app";
import { passwordService } from "../modules/auth/password.service";

export function createTestApp() {
  const app = createApp();
  applyErrorHandling(app);
  return app;
}

export async function seedAdminUser(prisma: any) {
  const email = "admin@emprestimo.test";
  const password = "Admin1234";
  const passwordHash = await passwordService.hash(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", active: true, name: "Admin Teste" },
    create: { email, name: "Admin Teste", passwordHash, role: "ADMIN", active: true },
  });
  return { user, password };
}

export async function cleanupDb(prisma: any) {
  await prisma.financeEntry.deleteMany();
  await prisma.cashBook.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.installment.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.clientDocument.deleteMany();
  await prisma.client.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}
