const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const rows = await p.reservation.findMany({ select: { code: true, tenantId: true, tableId: true, reservationDate: true, reservationTime: true, status: true } });
  console.log(JSON.stringify(rows));
  const gist = await p.$queryRawUnsafe("SELECT count(*)::int AS n FROM pg_extension WHERE extname='btree_gist'");
  console.log('btree_gist_installed:', JSON.stringify(gist));
  const owner = await p.$queryRawUnsafe("SELECT current_user, session_user");
  console.log(JSON.stringify(owner));
})().finally(() => p.$disconnect());
