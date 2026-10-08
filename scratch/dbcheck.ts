import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const tenants = await p.restaurant.findMany({ select: { tenantId: true, name: true } });
  const resCount = await p.reservation.count();
  console.log(JSON.stringify({ tenants, resCount }));
}
main().finally(() => p.$disconnect());
