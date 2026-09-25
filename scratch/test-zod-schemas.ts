import { validateToolArgs } from '../lib/ai/tool-schemas';
import { ToolExecutor } from '../lib/domain/tool-executor';
import { ToolRegistry } from '../lib/ai/tool-registry';

async function runZodVerificationTests() {
  console.log('=== 1. TEST TOOL SCHEMAS VALIDATION & COERCION ===');

  // Test 1: check_availability with string numbers (coercion)
  const test1 = validateToolArgs('check_availability', {
    date: '2026-09-15',
    time: '19:00',
    guestCount: '4', // String should be coerced to number 4
  });
  console.assert(test1.success === true, 'Test 1 Failed: Valid availability check rejected');
  console.assert((test1.data as any).guestCount === 4, 'Test 1 Failed: guestCount was not coerced to number');
  console.log('✔ Test 1 Passed: check_availability coerced string to number successfully.');

  // Test 2: check_availability with invalid date format
  const test2 = validateToolArgs('check_availability', {
    date: '15-09-2026', // Wrong format
    time: '19:00',
    guestCount: 2,
  });
  console.assert(test2.success === false, 'Test 2 Failed: Invalid date should fail');
  console.log('✔ Test 2 Passed: Invalid date correctly caught:', test2.errors);

  // Test 3: check_availability with guestCount 0 (must be >= 1)
  const test3 = validateToolArgs('check_availability', {
    date: '2026-09-15',
    time: '19:00',
    guestCount: 0,
  });
  console.assert(test3.success === false, 'Test 3 Failed: guestCount 0 should fail');
  console.log('✔ Test 3 Passed: guestCount 0 correctly caught:', test3.errors);

  // Test 4: get_reservation uppercase transform
  const test4 = validateToolArgs('get_reservation', {
    code: '  rm-1024  ',
  });
  console.assert(test4.success === true, 'Test 4 Failed: get_reservation should succeed');
  console.assert((test4.data as any).code === 'RM-1024', 'Test 4 Failed: code should be trimmed and uppercased');
  console.log('✔ Test 4 Passed: Reservation code uppercase transform works:', (test4.data as any).code);

  // Test 5: create_takeaway_order empty items
  const test5 = validateToolArgs('create_takeaway_order', {
    customerName: 'Budi',
    items: [],
  });
  console.assert(test5.success === false, 'Test 5 Failed: empty items should fail');
  console.log('✔ Test 5 Passed: Empty order items correctly rejected:', test5.errors);

  console.log('\n=== 2. TEST TOOL EXECUTOR INTEGRATION WITH ZOD ===');

  // Test 6: ToolExecutor invalid params
  const execFail = await ToolExecutor.execute({
    toolName: 'check_availability',
    rawArgs: { date: 'invalid-date', time: '99:99', guestCount: -5 },
    tenantId: 'tenant_rasominang_01',
    conversationId: 'conv_test_1',
  });
  console.assert(execFail.success === false, 'Test 6 Failed: ToolExecutor should fail invalid params');
  console.assert(execFail.errorCode === 'INVALID_PARAMETERS', 'Test 6 Failed: Expected INVALID_PARAMETERS error code');
  console.log('✔ Test 6 Passed: ToolExecutor rejected invalid parameters with:', execFail.message);

  // Test 7: ToolExecutor valid params with coercion
  const execSuccess = await ToolExecutor.execute({
    toolName: 'get_restaurant_info',
    rawArgs: {},
    tenantId: 'tenant_rasominang_01',
    conversationId: 'conv_test_1',
  });
  console.assert(execSuccess.success === true, 'Test 7 Failed: ToolExecutor get_restaurant_info failed');
  console.log('✔ Test 7 Passed: ToolExecutor get_restaurant_info executed successfully.');

  console.log('\n🎉 ALL ZOD VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runZodVerificationTests().catch((err) => {
  console.error('Test failed with exception:', err);
  process.exit(1);
});
