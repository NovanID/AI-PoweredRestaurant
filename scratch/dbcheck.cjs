require('dotenv').config && 0;
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const tenants = await p.restaurant.findMany({ select: { tenantId: true, name: true } });
  const resCount = await p.reservation.count();
  const tables = await p.table.groupBy({ by: ['tenantId'], _count: true });
  console.log(JSON.stringify({ tenants, resCount, tables }, null, 1));
})().finally(() => p.$disconnect());
