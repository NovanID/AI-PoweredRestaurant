/**
 * Smoke tests (Phase 4): tenant isolation + double-booking guard.
 * Run: node --env-file=.env scratch/smoke-test.mjs
 * Uses plain SQL against PostgreSQL (no TS compile needed).
 */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const T1 = 'raso-minang-padang-01';
const T2 = 'kopi-nusantara-cafe-02';

let pass = 0;
let fail = 0;

function check(name, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  ✅ ${name}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${name} ${detail}`);
  }
}

async function main() {
  console.log('== Smoke Test: Isolasi Data & Double-Booking ==');

  // --- 1. Unique partial index exists ---
  const idx = await p.$queryRawUnsafe(
    "SELECT count(*)::int AS n FROM pg_indexes WHERE indexname = 'reservations_one_active_slot_per_table'"
  );
  check('Unique partial index reservations_one_active_slot_per_table terpasang', idx[0].n === 1);

  // --- 2. Cross-tenant: tenant 2 cannot use tenant 1's table ---
  const t1Table = await p.table.findFirst({ where: { tenantId: T1 } });
  let crossBlocked = false;
  try {
    await p.reservation.create({
      data: {
        tenantId: T2,
        code: `TEST-CROSS-${Date.now()}`,
        customerName: 'Cross Tenant Test',
        customerPhone: '-',
        tableId: t1Table.id, // <-- milik tenant 1!
        tableNumber: t1Table.tableNumber,
        tableArea: t1Table.area,
        reservationDate: '2099-01-01',
        reservationTime: '10:00',
        guestCount: 2,
        status: 'confirmed',
      },
    });
  } catch (e) {
    crossBlocked = true;
  }
  check('Reservasi tenant 2 dengan tableId tenant 1 DITOLAK DB', crossBlocked);

  // --- 3. Double-booking: exact same table+date+time slot rejected by unique index ---
  const t1Table2 = await p.table.findFirst({ where: { tenantId: T1, capacity: { gte: 2 } } });
  const testDate = '2099-02-02';
  const testTime = '19:00';
  const first = await p.reservation.create({
    data: {
      tenantId: T1,
      code: `TEST-DBL-A-${Date.now()}`,
      customerName: 'Double Book A',
      customerPhone: '-',
      tableId: t1Table2.id,
      tableNumber: t1Table2.tableNumber,
      tableArea: t1Table2.area,
      reservationDate: testDate,
      reservationTime: testTime,
      guestCount: 2,
      status: 'confirmed',
    },
  });
  let dblBlocked = false;
  try {
    await p.reservation.create({
      data: {
        tenantId: T1,
        code: `TEST-DBL-B-${Date.now()}`,
        customerName: 'Double Book B',
        customerPhone: '-',
        tableId: t1Table2.id,
        tableNumber: t1Table2.tableNumber,
        tableArea: t1Table2.area,
        reservationDate: testDate,
        reservationTime: testTime,
        guestCount: 2,
        status: 'confirmed',
      },
    });
  } catch (e) {
    dblBlocked = String(e.code) === 'P2002';
  }
  check('Double-booking slot persis sama DITOLAK unique index (P2002)', dblBlocked);

  // --- 4. Different tenants CAN use same time slot on their own tables ---
  const t2Table = await p.table.findFirst({ where: { tenantId: T2 } });
  let parallelOk = true;
  try {
    await p.reservation.create({
      data: {
        tenantId: T2,
        code: `TEST-PAR-${Date.now()}`,
        customerName: 'Parallel Tenant',
        customerPhone: '-',
        tableId: t2Table.id,
        tableNumber: t2Table.tableNumber,
        tableArea: t2Table.area,
        reservationDate: testDate,
        reservationTime: testTime,
        guestCount: 2,
        status: 'confirmed',
      },
    });
  } catch {
    parallelOk = false;
  }
  check('Tenant berbeda boleh booking slot jam sama di meja masing-masing', parallelOk);

  // --- 5. Cancelled reservations do NOT block the slot (partial index) ---
  await p.reservation.update({ where: { id: first.id }, data: { status: 'cancelled' } });
  let rebookOk = true;
  try {
    await p.reservation.create({
      data: {
        tenantId: T1,
        code: `TEST-REB-${Date.now()}`,
        customerName: 'Rebook After Cancel',
        customerPhone: '-',
        tableId: t1Table2.id,
        tableNumber: t1Table2.tableNumber,
        tableArea: t1Table2.area,
        reservationDate: testDate,
        reservationTime: testTime,
        guestCount: 2,
        status: 'confirmed',
      },
    });
  } catch (e) {
    rebookOk = false;
  }
  check('Slot bebas lagi setelah reservasi dibatalkan (partial index)', rebookOk);

  // --- 6. Admin data per tenant: query tenant 1 tidak melihat data tenant 2 ---
  const t1Res = await p.reservation.findMany({ where: { tenantId: T1 }, select: { tenantId: true } });
  const t2Res = await p.reservation.findMany({ where: { tenantId: T2 }, select: { tenantId: true } });
  check(
    'Query tenant-scoped tidak mencampur tenant (T1 murni, T2 murni)',
    t1Res.every((r) => r.tenantId === T1) && t2Res.every((r) => r.tenantId === T2)
  );

  // --- Cleanup test rows ---
  await p.reservation.deleteMany({ where: { code: { startsWith: 'TEST-' } } });
  const leftover = await p.reservation.count({ where: { code: { startsWith: 'TEST-' } } });
  check('Cleanup: semua baris TEST- dihapus', leftover === 0);

  console.log(`\n== Hasil: ${pass} PASS, ${fail} FAIL ==`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
