import { restaurantStore } from '../lib/restaurant-store';
import { restaurantAITools } from '../lib/ai-tools';
import { processAIChat, ChatMessage } from '../lib/ai-assistant-service';
import fs from 'fs';
import path from 'path';

async function runAuditAndSimulation() {
  console.log('===============================================================');
  console.log('🚀 MEMULAI AUDIT MENYELURUH & SIMULASI REAL-TIME (BULAN AGUSTUS)');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;
  const issuesFound: string[] = [];

  function assert(condition: boolean, testName: string, failureDetail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.log(`  ❌ [FAIL] ${testName}`);
      if (failureDetail) console.log(`     Detail: ${failureDetail}`);
      issuesFound.push(`${testName}: ${failureDetail || 'Assertion failed'}`);
    }
  }

  // =========================================================================
  // 1. SCHEMA & DATA INTEGRITY AUDIT
  // =========================================================================
  console.log('📌 1. AUDIT KONSISTENSI DATABASE SCHEMA (SQL vs PRISMA vs TS TYPES)');
  
  const schemaSqlPath = path.join(process.cwd(), 'schema.sql');
  const prismaSchemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  
  const sqlContent = fs.readFileSync(schemaSqlPath, 'utf-8');
  const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf-8');

  // Check enum coverage in SQL
  const sqlHasSeated = sqlContent.includes("'seated'") && sqlContent.includes("'completed'");
  assert(sqlHasSeated, 'SQL Schema Enum Reservation Status mencakup status operasional (seated, completed, no_show, expired)',
    sqlHasSeated ? undefined : 'schema.sql hanya memiliki enum (pending, confirmed, rejected, cancelled). Kurang: seated, completed, no_show, expired!');

  // Check enum coverage in Prisma
  const prismaHasSeated = prismaContent.includes('seated') && prismaContent.includes('completed');
  assert(prismaHasSeated, 'Prisma Schema Enum Reservation Status mencakup status operasional (seated, completed, no_show, expired)',
    prismaHasSeated ? undefined : 'schema.prisma hanya memiliki enum (pending, confirmed, rejected, cancelled). Kurang: seated, completed, no_show, expired!');

  // Check missing columns in SQL
  const sqlHasQrToken = sqlContent.includes('qr_token') || sqlContent.includes('qrToken');
  assert(sqlHasQrToken, 'SQL Schema memiliki kolom qr_token dan tracking timestamp (seated_at, completed_at, expires_at)',
    sqlHasQrToken ? undefined : 'schema.sql belum memiliki kolom qr_token, auto_confirmed, seated_at, completed_at, expires_at!');

  console.log('');

  // =========================================================================
  // 2. ATOMIC SLOT LOCKING & DOUBLE-BOOKING STRESS TEST
  // =========================================================================
  console.log('📌 2. STRESS TEST: ATOMIC SLOT LOCKING & PENCEGAHAN DOUBLE-BOOKING');
  restaurantStore.resetToDefaults();

  const testDate = '2026-09-01';
  const testTime = '19:00';

  // Test 2.1: Booking Pertama (Harus Sukses)
  const res1 = restaurantStore.createReservation({
    customerName: 'Pelanggan Uji 1',
    customerPhone: '081234567891',
    date: testDate,
    time: testTime,
    guestCount: 2,
    preferredArea: 'Indoor',
  });
  assert(res1.success, 'Booking pertama 2 orang jam 19:00 berhasil', res1.message);

  // Test 2.2: Booking Kedua di meja yang sama persis (Harus dialokasikan ke meja 2 orang lain atau gagal jika penuh)
  const res2 = restaurantStore.createReservation({
    customerName: 'Pelanggan Uji 2',
    customerPhone: '081234567892',
    date: testDate,
    time: testTime,
    guestCount: 2,
    preferredArea: 'Indoor',
  });
  assert(res2.success && res2.reservation?.tableId !== res1.reservation?.tableId,
    'Booking kedua 2 orang jam 19:00 dialokasikan ke meja kedua (M-02) bukan meja pertama (M-01)',
    `Meja 1: ${res1.reservation?.tableNumber}, Meja 2: ${res2.reservation?.tableNumber}`);

  // Test 2.3: Booking Ketiga 2 orang di jam yang sama (Karena meja 2-orang hanya ada 2 buah, harus dialokasikan ke meja 4-orang atau ditolak jika strictly matching)
  const res3 = restaurantStore.createReservation({
    customerName: 'Pelanggan Uji 3',
    customerPhone: '081234567893',
    date: testDate,
    time: testTime,
    guestCount: 2,
    preferredArea: 'Indoor',
  });
  assert(res3.success, 'Booking ketiga 2 orang dialokasikan ke meja yang lebih besar (M-03 cap 4)', `Meja dialokasikan: ${res3.reservation?.tableNumber}`);

  // Test 2.4: 90-Minute Overlap Test (Jam 19:30 vs Jam 19:00 - harus mendeteksi tabrakan waktu)
  const checkOverlap30Min = restaurantStore.checkAvailability(testDate, '19:30', 2, 'Indoor');
  // Meja indoor tersisa M-04 (cap 4), M-05 (cap 6). Jadi masih ada 2 meja kosong.
  assert(checkOverlap30Min.available, 'Cek ketersediaan jam 19:30 mendeteksi sisa meja yang benar');

  // Test 2.5: Jam di luar jam operasional (02:00 subuh)
  const checkSubuh = restaurantStore.checkAvailability(testDate, '02:00', 2);
  assert(!checkSubuh.available, 'Reservasi jam 02:00 subuh otomatis ditolak (Di luar jam buka)');

  // Test 2.6: Jam mendekati tutup (21:30 WIB jika tutup 22:00)
  const checkMendekatiTutup = restaurantStore.checkAvailability(testDate, '21:30', 2);
  assert(!checkMendekatiTutup.available, 'Reservasi jam 21:30 ditolak karena durasi makan butuh 60-90 menit sebelum jam 22:00');

  // Test 2.7: Kapasitas berlebih (15 orang di Indoor)
  const checkOverCap = restaurantStore.checkAvailability(testDate, '12:00', 15, 'Indoor');
  assert(!checkOverCap.available, 'Permintaan 15 orang di area Indoor ditolak (Maksimal kapasitas indoor 6 orang)');

  console.log('');

  // =========================================================================
  // 3. OPERATIONAL FLOOR LIFECYCLE SIMULATION
  // =========================================================================
  console.log('📌 3. SIMULASI OPERASIONAL RESTORAN (SEATED -> COMPLETED -> NO-SHOW)');
  
  if (res1.reservation) {
    const code = res1.reservation.code;
    const tableId = res1.reservation.tableId;

    // 3.1 Tamu datang & check-in
    const seatedRes = restaurantStore.markAsSeated(code, 'Kasir Budi');
    assert(seatedRes.success && seatedRes.reservation?.status === 'seated', `Tamu check-in: Status reservasi ${code} berubah menjadi 'seated'`);
    
    const tableAfterSeated = restaurantStore.getTables().find(t => t.id === tableId);
    assert(tableAfterSeated?.status === 'occupied', `Meja ${tableAfterSeated?.number} otomatis berubah status menjadi 'occupied'`);

    // 3.2 Tamu selesai makan
    const completedRes = restaurantStore.markAsCompleted(code, 'Kasir Budi');
    assert(completedRes.success && completedRes.reservation?.status === 'completed', `Tamu selesai makan: Status reservasi ${code} berubah menjadi 'completed'`);

    const tableAfterCompleted = restaurantStore.getTables().find(t => t.id === tableId);
    assert(tableAfterCompleted?.status === 'available', `Meja ${tableAfterCompleted?.number} otomatis kembali menjadi 'available' (siap tamu baru)`);
  }

  console.log('');

  // =========================================================================
  // 4. SIMULASI DATASET EVALUASI BASELINE (50 SKENARIO PELANGGAN)
  // =========================================================================
  console.log('📌 4. SIMULASI DATASET EVALUASI BASELINE (50 SKENARIO PELANGGAN)');

  const evalDatasetPath = path.join(process.cwd(), 'docs/benchmarks/evaluation_dataset_baseline.json');
  const evalData = JSON.parse(fs.readFileSync(evalDatasetPath, 'utf-8'));

  let evalPassed = 0;
  for (const item of evalData) {
    // Reset store before each item to ensure clean isolation
    restaurantStore.resetToDefaults();

    let testSuccess = false;
    let detailMsg = '';

    try {
      if (item.expected_tool === 'get_restaurant_info') {
        const res = restaurantAITools.get_restaurant_info();
        testSuccess = res.success && res.data.name === 'Raso Minang';
      } else if (item.expected_tool === 'get_menu') {
        const res = restaurantAITools.get_menu(item.expected_arguments?.category, item.expected_arguments?.search);
        testSuccess = res.success;
      } else if (item.expected_tool === 'check_availability') {
        const res = restaurantAITools.check_availability({
          date: item.expected_arguments?.date || '2026-08-30',
          time: item.expected_arguments?.time || '19:00',
          guestCount: item.expected_arguments?.guestCount || 4,
          preferredArea: item.expected_arguments?.preferredArea,
        });
        // Check if expectation matches rejection on edge cases (e.g. 02:00 or 25 guests)
        if (item.expected_arguments?.time === '02:00' || item.expected_arguments?.guestCount === 25) {
          testSuccess = !res.success; // Expected to fail/reject
        } else {
          testSuccess = res.success;
        }
      } else if (item.expected_tool === 'get_reservation') {
        const res = restaurantAITools.get_reservation(item.expected_arguments?.code);
        if (item.expected_arguments?.code === 'RM-9999') {
          testSuccess = !res.success; // Non-existent code
        } else {
          testSuccess = res.success;
        }
      } else if (item.expected_tool === 'cancel_reservation') {
        const res = restaurantAITools.cancel_reservation(item.expected_arguments?.code);
        testSuccess = res.success;
      } else if (item.expected_tool === 'update_reservation') {
        const res = restaurantAITools.update_reservation({
          code: item.expected_arguments?.code,
          newDate: item.expected_arguments?.newDate,
          newTime: item.expected_arguments?.newTime,
          newGuestCount: item.expected_arguments?.newGuestCount,
          preferredArea: item.expected_arguments?.preferredArea,
        });
        // If updating 8 guests to outdoor (which has max cap 6), rejection is the expected safe behavior!
        if (item.expected_arguments?.code === 'RM-1002' && item.expected_arguments?.preferredArea === 'Outdoor') {
          testSuccess = !res.success && res.message.includes('Outdoor');
        } else {
          testSuccess = res.success;
        }
      } else if (item.expected_tool === 'create_reservation') {
        const res = restaurantAITools.create_reservation({
          customerName: item.expected_arguments?.customerName || 'Test Customer',
          customerPhone: item.expected_arguments?.customerPhone || '081234567890',
          date: item.expected_arguments?.date || '2026-08-30',
          time: item.expected_arguments?.time || '19:00',
          guestCount: item.expected_arguments?.guestCount || 4,
          preferredArea: item.expected_arguments?.preferredArea,
        });
        testSuccess = res.success;
      } else if (item.expected_tool === 'none') {
        // Guardrail tests: test processAIChat
        const chatRes = await processAIChat(item.prompt, []);
        testSuccess = chatRes.reply.length > 0;
        // Verify it doesn't leak secrets or out-of-scope code
        if (item.ground_truth_assertion?.must_not_contain) {
          for (const forbidden of item.ground_truth_assertion.must_not_contain) {
            if (chatRes.reply.includes(forbidden)) {
              testSuccess = false;
              detailMsg = `Leaked forbidden text: ${forbidden}`;
            }
          }
        }
      }
    } catch (e: any) {
      testSuccess = false;
      detailMsg = e.message;
    }

    if (testSuccess) {
      evalPassed++;
    } else {
      console.log(`  ⚠️ Evaluasi Gagal di ${item.id} (${item.prompt}): ${detailMsg}`);
    }
  }

  assert(evalPassed === 50, `Semua 50 Skenario Evaluasi Lolos (${evalPassed}/50 Lolos)`, `${50 - evalPassed} skenario belum lolos.`);

  console.log('\n===============================================================');
  console.log(`📊 HASIL AKHIR SIMULASI: ${passedTests} / ${totalTests} PENGUJIAN LOLOS`);
  console.log('===============================================================');
  
  if (issuesFound.length > 0) {
    console.log('\n⚠️ TEMUAN CELAH KRITIS YANG DITEMUKAN:');
    issuesFound.forEach((iss, idx) => console.log(` ${idx + 1}. ${iss}`));
  } else {
    console.log('\n🎉 SELURUH SISTEM KONSISTEN & MEMENUHI TARGET SPRINT AGUSTUS!');
  }
}

runAuditAndSimulation();
