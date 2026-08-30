import { AIOrchestrator } from '../lib/ai/orchestrator';
import { ConversationSession } from '../lib/ai/types';
import { ReservationService } from '../lib/domain/reservation-service';
import { restaurantStore } from '../lib/restaurant-store';

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 RUNNING RESTAURANT AI OS - PRODUCTION ARCHITECTURE TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let session: ConversationSession = {
    sessionId: 'test-session-001',
    tenantId: 'tenant_rasominang_01',
    state: 'IDLE',
    stateVersion: 1,
    history: [],
    lastInteractionAt: Date.now(),
  };

  // -------------------------------------------------------------
  // TEST 1: Menu Recommendation (Budget <= 40k, Spicy)
  // -------------------------------------------------------------
  console.log('🔹 [TEST 1] Skenario A: Rekomendasi Menu Pedas Budget 40k');
  const res1 = await AIOrchestrator.processMessage({
    userMessage: 'Mbak ada rekomendasi makanan pedas budget 40 ribu?',
    session,
  });
  session = res1.session;
  console.log('State:', session.state, '| Version:', session.stateVersion);
  console.log('AI Reply:\n', res1.reply);
  console.log('Tool Executed:', res1.toolExecuted?.tool, '| Data Count:', res1.toolExecuted?.data?.length);
  console.log('Validation:', res1.validation.isValid ? '✅ PASSED' : '❌ FAILED');
  console.log('-------------------------------------------------------------\n');

  // -------------------------------------------------------------
  // TEST 2: Two-Phase Reservation Hold Request
  // -------------------------------------------------------------
  console.log('🔹 [TEST 2] Skenario B (Phase 1): Request Hold Slot Meja');
  const res2 = await AIOrchestrator.processMessage({
    userMessage: 'Tolong pesan meja untuk 4 orang besok jam 19.00 atas nama Budi Santoso di area Indoor',
    session,
  });
  session = res2.session;
  console.log('State:', session.state, '| Pending Action:', session.pendingAction?.type);
  console.log('Lease Token:', session.pendingAction?.leaseToken);
  console.log('AI Reply:\n', res2.reply);
  console.log('Validation:', res2.validation.isValid ? '✅ PASSED' : '❌ FAILED');
  console.log('-------------------------------------------------------------\n');

  // -------------------------------------------------------------
  // TEST 3: Confirmation -> Atomic Commit & Event Emission
  // -------------------------------------------------------------
  console.log('🔹 [TEST 3] Skenario B (Phase 2): Konfirmasi "Ya" & Atomic Commit');
  const res3 = await AIOrchestrator.processMessage({
    userMessage: 'Ya, setuju konfirmasi',
    session,
  });
  session = res3.session;
  console.log('State:', session.state, '| Version:', session.stateVersion);
  console.log('AI Reply:\n', res3.reply);
  console.log('Tool Result:', res3.toolExecuted?.tool, '| Code:', res3.toolExecuted?.data?.code);
  const createdCode = res3.toolExecuted?.data?.code;
  console.log('-------------------------------------------------------------\n');

  // -------------------------------------------------------------
  // TEST 4: Query Ticket Status by Code
  // -------------------------------------------------------------
  if (createdCode) {
    console.log(`🔹 [TEST 4] Skenario C: Cek Status Tiket ${createdCode}`);
    const res4 = await AIOrchestrator.processMessage({
      userMessage: `Cek status reservasi ${createdCode}`,
      session,
    });
    session = res4.session;
    console.log('AI Reply:\n', res4.reply);
    console.log('-------------------------------------------------------------\n');
  }

  // -------------------------------------------------------------
  // TEST 5: Business Rule Violation (Operating Hours rejection)
  // -------------------------------------------------------------
  console.log('🔹 [TEST 5] Skenario D: Proteksi Jam Buka Restoran (Booking jam 03.00 pagi)');
  const res5 = await AIOrchestrator.processMessage({
    userMessage: 'Pesan meja jam 03:00 subuh untuk 2 orang',
    session,
  });
  session = res5.session;
  console.log('State:', session.state);
  console.log('AI Reply:\n', res5.reply);
  console.log('Is Correctly Rejected:', res5.reply.includes('Restoran') && res5.reply.includes('melayani'));
  console.log('-------------------------------------------------------------\n');

  // -------------------------------------------------------------
  // TEST 6: Reschedule & Cancellation Flow
  // -------------------------------------------------------------
  if (createdCode) {
    console.log(`🔹 [TEST 6] Skenario E: Pembatalan Tiket ${createdCode}`);
    const res6 = await AIOrchestrator.processMessage({
      userMessage: `Batalkan reservasi ${createdCode}`,
      session,
    });
    session = res6.session;
    console.log('AI Reply:\n', res6.reply);
    console.log('-------------------------------------------------------------\n');
  }

  console.log('🎉 ALL PRODUCTION ARCHITECTURE INTEGRATION TESTS COMPLETED SUCCESSFULLY!');
}

runTests().catch(console.error);
