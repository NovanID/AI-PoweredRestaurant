import { ToolExecutor } from '../lib/domain/tool-executor';

async function testCalculateOrderTotal() {
  console.log('--- Test 1: Empty / Unknown Item ---');
  const res1 = await ToolExecutor.execute({
    toolName: 'calculate_order_total',
    rawArgs: { items: [{ menuItemId: 'unknown', quantity: 1 }] },
    tenantId: 'tenant_rasominang_01',
    conversationId: 'test-sess',
  });
  console.log('Result 1:', res1);

  console.log('\n--- Test 2: Name match "Rendang Daging Sapi" (2) and "Ayam Pop" (1) ---');
  const res2 = await ToolExecutor.execute({
    toolName: 'calculate_order_total',
    rawArgs: {
      items: [
        { menuName: 'Rendang Daging Sapi', quantity: 2 },
        { menuName: 'Ayam Pop', quantity: 1 },
      ],
    },
    tenantId: 'tenant_rasominang_01',
    conversationId: 'test-sess',
  });
  console.log('Result 2:', res2);
}

testCalculateOrderTotal();
