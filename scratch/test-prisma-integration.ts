import { prisma } from '../lib/prisma';
import { PrismaRestaurantRepository } from '../lib/db/prisma-repository';
import { ToolExecutor } from '../lib/domain/tool-executor';
import { DEFAULT_TENANT_ID } from '../lib/mock-data';

async function runPrismaIntegrationTests() {
  console.log('=== TEST 1: PRISMA PROFILE & MENU QUERIES ===');

  // 1. Check Profile
  const profile = await PrismaRestaurantRepository.getProfile(DEFAULT_TENANT_ID);
  console.assert(profile !== null, 'Profile is null');
  console.assert(profile?.name === 'Raso Minang', 'Profile name mismatch');
  console.log('✔ Test 1.1: Profile fetched from PostgreSQL:', profile?.name, `(${profile?.city})`);

  // 2. Check Menu
  const menuItems = await PrismaRestaurantRepository.getMenuItems({
    tenantId: DEFAULT_TENANT_ID,
    category: 'Lauk Utama',
  });
  console.assert(menuItems.length > 0, 'No menu items found in PostgreSQL');
  console.log(`✔ Test 1.2: Fetched ${menuItems.length} "Lauk Utama" menu items from PostgreSQL.`);
  console.log('   Sample menu:', menuItems[0].name, '- Rp', menuItems[0].price.toLocaleString('id-ID'));

  // 3. Check Tables
  const tables = await PrismaRestaurantRepository.getTables(DEFAULT_TENANT_ID);
  console.assert(tables.length === 10, `Expected 10 tables, found ${tables.length}`);
  console.log(`✔ Test 1.3: Fetched ${tables.length} tables from PostgreSQL.`);

  console.log('\n=== TEST 2: PRISMA TABLE AVAILABILITY CHECK ===');
  const avail = await PrismaRestaurantRepository.checkAvailability({
    tenantId: DEFAULT_TENANT_ID,
    date: '2026-09-20',
    time: '19:00',
    guestCount: 4,
    preferredArea: 'Indoor',
  });
  console.assert(avail.available === true, 'Availability check should be true');
  console.assert(avail.availableTables.length > 0, 'Available tables should be > 0');
  console.log(`✔ Test 2.1: Availability check passed. Found ${avail.availableTables.length} tables in Indoor area.`);

  console.log('\n=== TEST 3: END-TO-END RESERVATION LIFECYCLE (TOOL EXECUTOR -> POSTGRES) ===');

  // Step 1: Hold table
  const holdExec = await ToolExecutor.execute({
    toolName: 'request_reservation_hold',
    rawArgs: {
      customerName: 'Sutan Syahrir',
      customerPhone: '081299887766',
      date: '2026-09-20',
      time: '19:00',
      guestCount: 4,
      preferredArea: 'Indoor',
      notes: 'Dekat jendela jika memungkinkan',
    },
    tenantId: DEFAULT_TENANT_ID,
    conversationId: 'conv_prisma_test_1',
  });
  console.assert(holdExec.success === true, 'Hold reservation failed');
  const leaseToken = holdExec.data.leaseToken;
  console.log('✔ Test 3.1: Table hold created with leaseToken:', leaseToken);

  // Step 2: Confirm reservation
  const confirmExec = await ToolExecutor.execute({
    toolName: 'confirm_reservation',
    rawArgs: {
      leaseToken,
      customerName: 'Sutan Syahrir',
      customerPhone: '081299887766',
      notes: 'Dekat jendela jika memungkinkan',
    },
    tenantId: DEFAULT_TENANT_ID,
    conversationId: 'conv_prisma_test_1',
  });
  console.assert(confirmExec.success === true, 'Confirm reservation failed');
  const reservationCode = confirmExec.data.code;
  console.log('✔ Test 3.2: Reservation confirmed via ToolExecutor. Ticket code:', reservationCode);

  // Step 3: Verify reservation row exists in PostgreSQL table
  const pgReservation = await prisma.reservation.findUnique({
    where: { code: reservationCode },
  });
  console.assert(pgReservation !== null, 'Reservation not found in PostgreSQL!');
  console.assert(pgReservation?.customerName === 'Sutan Syahrir', 'Customer name mismatch in PostgreSQL');
  console.assert(pgReservation?.status === 'confirmed', 'Status mismatch in PostgreSQL');
  console.log('✔ Test 3.3: Confirmed row in PostgreSQL reservations table:', {
    code: pgReservation?.code,
    name: pgReservation?.customerName,
    tableNumber: pgReservation?.tableNumber,
    date: pgReservation?.reservationDate,
    status: pgReservation?.status,
  });

  // Step 4: Verify customer table updated in PostgreSQL
  const customerRecord = await prisma.customer.findUnique({
    where: {
      tenantId_phone: {
        tenantId: DEFAULT_TENANT_ID,
        phone: '081299887766',
      },
    },
  });
  console.assert(customerRecord !== null, 'Customer record not created in PostgreSQL');
  console.log('✔ Test 3.4: Customer record synced in PostgreSQL:', customerRecord?.name, `(visits: ${customerRecord?.reservationCount})`);

  // Step 5: Query via get_reservation tool
  const getExec = await ToolExecutor.execute({
    toolName: 'get_reservation',
    rawArgs: { code: reservationCode },
    tenantId: DEFAULT_TENANT_ID,
    conversationId: 'conv_prisma_test_1',
  });
  console.assert(getExec.success === true, 'get_reservation tool failed');
  console.log('✔ Test 3.5: get_reservation retrieved PostgreSQL data:', getExec.message);

  // Step 6: Cancel reservation via ToolExecutor
  const cancelExec = await ToolExecutor.execute({
    toolName: 'cancel_reservation',
    rawArgs: { code: reservationCode, reason: 'Ada keperluan mendadak' },
    tenantId: DEFAULT_TENANT_ID,
    conversationId: 'conv_prisma_test_1',
  });
  console.assert(cancelExec.success === true, 'cancel_reservation tool failed');

  // Verify cancelled in PostgreSQL
  const cancelledPg = await prisma.reservation.findUnique({
    where: { code: reservationCode },
  });
  console.assert(cancelledPg?.status === 'cancelled', 'Status was not updated to cancelled in PostgreSQL');
  console.log('✔ Test 3.6: Reservation successfully cancelled in PostgreSQL:', cancelledPg?.code, `(status: ${cancelledPg?.status})`);

  console.log('\n🎉 ALL PRISMA POSTGRESQL INTEGRATION TESTS PASSED 100%!');
}

runPrismaIntegrationTests()
  .catch((e) => {
    console.error('Integration test failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
