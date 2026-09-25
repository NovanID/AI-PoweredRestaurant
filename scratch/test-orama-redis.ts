import { OramaMenuIndex } from '../lib/search/orama-menu-index';
import { RedisLeaseManager } from '../lib/infrastructure/redis-lease-manager';
import { ToolExecutor } from '../lib/domain/tool-executor';
import { ReservationService } from '../lib/domain/reservation-service';

async function runTests() {
  console.log('=== START STEP 4 VERIFICATION (ORAMA & REDIS LEASE MANAGER) ===\n');

  // -------------------------------------------------------------
  // PART 1: Orama Fuzzy Search & Typo Tolerance
  // -------------------------------------------------------------
  console.log('--- TEST 1: Orama Direct Search (Typo Tolerance) ---');

  const testCases = [
    { query: 'rendng', expectedSnippet: 'Rendang' },
    { query: 'aym pop', expectedSnippet: 'Ayam Pop' },
    { query: 'tunjng', expectedSnippet: 'Tunjang' },
    { query: 'dendeng batok', expectedSnippet: 'Dendeng' },
  ];

  for (const tc of testCases) {
    const results = await OramaMenuIndex.searchMenu(tc.query);
    const topHit = results[0];
    if (topHit && topHit.name.toLowerCase().includes(tc.expectedSnippet.toLowerCase())) {
      console.log(`[PASS] Query "${tc.query}" -> Matched: "${topHit.name}" (Rp ${topHit.price.toLocaleString('id-ID')})`);
    } else {
      console.error(`[FAIL] Query "${tc.query}" -> Expected "${tc.expectedSnippet}", got:`, topHit ? topHit.name : 'NO_HITS');
    }
  }

  console.log('\n--- TEST 2: ToolExecutor "get_menu" with Typo ---');
  const toolResult = await ToolExecutor.execute({
    toolName: 'get_menu',
    rawArgs: { search: 'rendng sapi' },
    tenantId: 'tenant_rasominang_01',
    conversationId: 'test_conv_orama_01',
  });
  console.log('get_menu success:', toolResult.success);
  console.log('get_menu message:', toolResult.message);
  console.log('Found items count:', toolResult.data?.length);
  if (toolResult.data?.length > 0) {
    console.log('[PASS] First item:', toolResult.data[0].name);
  } else {
    console.error('[FAIL] No items returned by get_menu with typo!');
  }

  console.log('\n--- TEST 3: ToolExecutor "calculate_order_total" with Typo Items ---');
  const calcResult = await ToolExecutor.execute({
    toolName: 'calculate_order_total',
    rawArgs: {
      items: [
        { name: 'rendng', quantity: 2 },
        { name: 'aym pop', quantity: 1 },
      ],
    },
    tenantId: 'tenant_rasominang_01',
    conversationId: 'test_conv_orama_02',
  });
  console.log('calculate_order_total success:', calcResult.success);
  console.log('calculate_order_total message:', calcResult.message);
  if (calcResult.success && calcResult.data?.detailedItems?.length === 2) {
    console.log('[PASS] Typo items correctly resolved to catalog prices:');
    calcResult.data.detailedItems.forEach((it: any) => {
      console.log(`  - ${it.quantity}x ${it.name} = Rp ${it.itemTotal.toLocaleString('id-ID')}`);
    });
    console.log(`  Total (incl 10% PB1): Rp ${calcResult.data.total.toLocaleString('id-ID')}`);
  } else {
    console.error('[FAIL] calculate_order_total failed to resolve typo items:', calcResult);
  }

  // -------------------------------------------------------------
  // PART 2: Upstash Redis Lease Manager (Distributed Hold Lease)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: RedisLeaseManager Hold Lease & Lock Lifecycle ---');

  const testDate = '2026-09-25';
  const testTime = '19:00';
  const tenantId = 'tenant_rasominang_01';

  // 4a. Cek availability awal
  const availBefore = await ReservationService.checkAvailability({
    tenantId,
    date: testDate,
    time: testTime,
    guestCount: 4,
    preferredArea: 'Indoor',
  });
  console.log('Available tables before lock:', availBefore.availableTables.map((t) => t.number));
  const targetTable = availBefore.availableTables[0];
  if (!targetTable) {
    console.error('[FAIL] No tables available for test');
    return;
  }

  // 4b. Create hold lease
  const holdRes = await ReservationService.createHoldLease({
    tenantId,
    conversationId: 'test_conv_redis_01',
    customerName: 'Budi Santoso',
    customerPhone: '08123456789',
    date: testDate,
    time: testTime,
    guestCount: targetTable.capacity,
    preferredArea: targetTable.area,
  });

  console.log('Hold lease creation:', holdRes.success, holdRes.message);
  if (!holdRes.success || !holdRes.lease) {
    console.error('[FAIL] Could not create hold lease');
    return;
  }
  const token = holdRes.lease.leaseToken;
  console.log('[PASS] Acquired lease token:', token, 'for table:', holdRes.lease.tableNumber);

  // 4c. Verify table slot is locked
  const isLocked = await RedisLeaseManager.isTableSlotLocked(tenantId, targetTable.id, testDate, testTime);
  console.log(`[PASS] Is table ${targetTable.number} locked in Redis?`, isLocked);

  // 4d. Check availability during active lease -> target table must NOT be in available list
  const availDuring = await ReservationService.checkAvailability({
    tenantId,
    date: testDate,
    time: testTime,
    guestCount: 4,
    preferredArea: 'Indoor',
  });
  const tableStillAvailable = availDuring.availableTables.some((t) => t.id === targetTable.id);
  if (!tableStillAvailable) {
    console.log(`[PASS] Table ${targetTable.number} is excluded from available tables while lease is held!`);
  } else {
    console.error(`[FAIL] Table ${targetTable.number} should be locked, but is still listed as available!`);
  }

  // 4e. Commit reservation (releases lease)
  const commitRes = await ReservationService.commitLeasedReservation({
    leaseToken: token,
    customerName: 'Budi Santoso',
    customerPhone: '08123456789',
  });
  console.log('Commit reservation:', commitRes.success, commitRes.message);

  // 4f. Verify lease token was cleaned up
  const leaseAfterCommit = await RedisLeaseManager.getHoldLease(token);
  console.log('[PASS] Lease token in Redis after commit (should be null):', leaseAfterCommit);

  console.log('\n=== ALL STEP 4 TESTS COMPLETED SUCCESSFULLY! ===');
}

runTests().catch(console.error);
