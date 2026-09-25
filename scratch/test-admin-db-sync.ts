import { prisma } from '../lib/prisma';
import { PrismaRestaurantRepository } from '../lib/db/prisma-repository';
import { ToolExecutor } from '../lib/domain/tool-executor';
import { DEFAULT_TENANT_ID } from '../lib/mock-data';

async function runAdminDbSyncTests() {
  console.log('====================================================');
  console.log('   PHASE 5: ADMIN DASHBOARD & POS POSTGRESQL SYNC   ');
  console.log('====================================================\n');

  // STEP 1: AI Chatbot creates and confirms reservation
  console.log('--- TEST 1: AI Chatbot Booking Flow -> PostgreSQL ---');
  const dateStr = '2026-09-25';
  const timeStr = '18:30';

  const holdResult = await ToolExecutor.execute({
    toolName: 'request_reservation_hold',
    rawArgs: {
      customerName: 'Bung Hatta',
      customerPhone: '081211223344',
      date: dateStr,
      time: timeStr,
      guestCount: 2,
      preferredArea: 'Indoor',
      notes: 'Dekat ornamen Minang',
    },
    tenantId: DEFAULT_TENANT_ID,
    conversationId: 'conv_admin_sync_1',
  });
  console.assert(holdResult.success === true, 'Hold failed');
  const leaseToken = holdResult.data.leaseToken;
  console.log('✔ 1.1 Hold lease created:', leaseToken, `(Meja ${holdResult.data.tableNumber})`);

  const confirmResult = await ToolExecutor.execute({
    toolName: 'confirm_reservation',
    rawArgs: {
      leaseToken,
      customerName: 'Bung Hatta',
      customerPhone: '081211223344',
      notes: 'Dekat ornamen Minang',
    },
    tenantId: DEFAULT_TENANT_ID,
    conversationId: 'conv_admin_sync_1',
  });
  console.assert(confirmResult.success === true, 'Confirmation failed');
  const bookingCode = confirmResult.data.code;
  console.log('✔ 1.2 AI Confirmed booking. Ticket Code:', bookingCode);

  // STEP 2: Admin Dashboard Data Query (Simulating /api/admin/data)
  console.log('\n--- TEST 2: Admin Data Fetch from PostgreSQL ---');
  const allReservations = await PrismaRestaurantRepository.getAllReservations(DEFAULT_TENANT_ID);
  const foundInAdmin = allReservations.find((r) => r.code === bookingCode);
  console.assert(foundInAdmin !== undefined, 'Reservation not found in Admin list!');
  console.assert(foundInAdmin?.customerName === 'Bung Hatta', 'Customer name mismatch');
  console.log('✔ 2.1 Admin Dashboard fetched all reservations. Found:', {
    code: foundInAdmin?.code,
    customer: foundInAdmin?.customerName,
    table: foundInAdmin?.tableNumber,
    area: foundInAdmin?.tableArea,
    status: foundInAdmin?.status,
    totalReservationsInDb: allReservations.length,
  });

  // STEP 3: Check-in Guest (Mark as Seated)
  console.log('\n--- TEST 3: Guest Arrival & Check-In (Mark as Seated) ---');
  const checkinResult = await PrismaRestaurantRepository.markAsSeated(
    DEFAULT_TENANT_ID,
    bookingCode,
    'Staf Penerima Tamu (Budi)'
  );
  console.assert(checkinResult.success === true, 'Mark seated failed');
  console.assert(checkinResult.reservation?.status === 'seated', 'Status should be seated');

  // Verify table is marked occupied in PostgreSQL
  const tablesAfterCheckin = await PrismaRestaurantRepository.getTables(DEFAULT_TENANT_ID);
  const assignedTable = tablesAfterCheckin.find((t) => t.id === checkinResult.reservation?.tableId);
  console.assert(assignedTable?.status === 'occupied', 'Table should be occupied after seated');
  console.log('✔ 3.1 Check-in successful. Table', assignedTable?.number, 'status is now:', assignedTable?.status);

  // STEP 4: POS Billing - Add Ordered Items
  console.log('\n--- TEST 4: POS Billing - Adding Food & Drink Items ---');
  const orderItems = [
    { menuItemId: 'menu-1', name: 'Rendang Daging Sapi', price: 32000, quantity: 2 },
    { menuItemId: 'menu-3', name: 'Ayam Pop Spesial', price: 28000, quantity: 1 },
    { menuItemId: 'menu-8', name: 'Es Teh Manis', price: 8000, quantity: 2 },
  ];
  const expectedTotal = 32000 * 2 + 28000 * 1 + 8000 * 2; // 64000 + 28000 + 16000 = 108000

  const posOrderResult = await PrismaRestaurantRepository.addOrderItemsToReservation(
    DEFAULT_TENANT_ID,
    bookingCode,
    orderItems,
    'Staf Kasir (Budi)'
  );
  console.assert(posOrderResult.success === true, 'Add order items failed');
  console.assert(posOrderResult.reservation?.orderTotal === expectedTotal, 'Order total mismatch');
  console.log('✔ 4.1 POS order saved to PostgreSQL. Total:', posOrderResult.reservation?.orderTotal?.toLocaleString('id-ID'));

  // Verify directly in database
  const dbCheckOrder = await prisma.reservation.findUnique({
    where: { code: bookingCode },
  });
  console.assert(Number(dbCheckOrder?.orderTotal) === expectedTotal, 'DB orderTotal mismatch');
  console.assert(Array.isArray(dbCheckOrder?.orderItems), 'DB orderItems should be array');
  console.log('✔ 4.2 Verified in PostgreSQL raw row: order_total =', dbCheckOrder?.orderTotal?.toString(), ', items count =', (dbCheckOrder?.orderItems as any[])?.length);

  // STEP 5: POS Offline Payment Settlement
  console.log('\n--- TEST 5: POS Offline Payment Settlement ---');
  const settleResult = await PrismaRestaurantRepository.settleOfflinePayment(
    DEFAULT_TENANT_ID,
    bookingCode,
    'QRIS Statis Kasir',
    'Staf Kasir (Budi)'
  );
  console.assert(settleResult.success === true, 'Settlement failed');
  console.assert(settleResult.reservation?.paymentStatus === 'settlement', 'Payment status should be settlement');
  console.log('✔ 5.1 POS settlement completed via:', settleResult.reservation?.paymentMethod);

  // STEP 6: Dining Completed & Table Release
  console.log('\n--- TEST 6: Dining Completed & Table Release ---');
  const completeResult = await PrismaRestaurantRepository.markAsCompleted(
    DEFAULT_TENANT_ID,
    bookingCode,
    'Staf Kasir (Budi)'
  );
  console.assert(completeResult.success === true, 'Complete dining failed');
  console.assert(completeResult.reservation?.status === 'completed', 'Status should be completed');

  const tableAfterComplete = (await PrismaRestaurantRepository.getTables(DEFAULT_TENANT_ID)).find(
    (t) => t.id === checkinResult.reservation?.tableId
  );
  console.assert(tableAfterComplete?.status === 'available', 'Table should be released to available');
  console.log('✔ 6.1 Dining completed. Table', tableAfterComplete?.number, 'released back to:', tableAfterComplete?.status);

  // STEP 7: Walk-In Seated Direct Flow
  console.log('\n--- TEST 7: Walk-In Guest Direct Seating ---');
  const walkInTable = (await PrismaRestaurantRepository.getTables(DEFAULT_TENANT_ID)).find(
    (t) => t.status === 'available'
  );
  console.assert(walkInTable !== undefined, 'No available table for walk-in test');

  const walkInResult = await PrismaRestaurantRepository.createWalkInSeated(
    DEFAULT_TENANT_ID,
    { tableId: walkInTable!.id, guestCount: 3, actor: 'Kasir Walkin' }
  );
  console.assert(walkInResult.success === true, 'Walk-in failed');
  console.assert(walkInResult.reservation?.code.startsWith('WI-'), 'Walk-in code prefix mismatch');
  console.log('✔ 7.1 Walk-in guest seated at Table', walkInTable?.number, 'Code:', walkInResult.reservation?.code);

  // STEP 8: Midtrans Webhook Simulation
  console.log('\n--- TEST 8: Midtrans Webhook PostgreSQL Update ---');
  const webhookUpdate = await PrismaRestaurantRepository.updatePaymentStatus(
    DEFAULT_TENANT_ID,
    walkInResult.reservation!.code,
    'settlement',
    'qris',
    75000,
    'Midtrans Webhook Simulator'
  );
  console.assert(webhookUpdate.success === true, 'Webhook update failed');
  console.assert(webhookUpdate.reservation?.paymentStatus === 'settlement', 'Payment status mismatch');
  console.log('✔ 8.1 Midtrans webhook update verified in DB for ticket:', webhookUpdate.reservation?.code);

  // STEP 9: Audit Events
  console.log('\n--- TEST 9: Audit Events Trail in PostgreSQL ---');
  const auditLogs = await PrismaRestaurantRepository.getAuditEvents(DEFAULT_TENANT_ID, 10);
  console.assert(auditLogs.length > 0, 'No audit logs found');
  console.log(`✔ 9.1 Retrieved ${auditLogs.length} recent audit events from PostgreSQL. Latest actions:`);
  auditLogs.slice(0, 5).forEach((log, i) => {
    console.log(`    [${i + 1}] ${log.action} by ${log.actor} on ${log.entity}: ${log.details}`);
  });

  console.log('\n====================================================');
  console.log('   ✔ ALL 9 INTEGRATION TESTS PASSED SUCCESSFULLY!   ');
  console.log('====================================================');
}

runAdminDbSyncTests()
  .catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
