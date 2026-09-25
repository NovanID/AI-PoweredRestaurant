import assert from 'node:assert/strict';
import { getExpectedPaymentAmount, isExpectedPaymentAmount } from '../lib/midtrans';
import { PrismaRestaurantRepository } from '../lib/db/prisma-repository';
import { prisma } from '../lib/prisma';
import { DEFAULT_TENANT_ID } from '../lib/mock-data';

const deposit = { paymentAmount: 50_000 };
const takeaway = { paymentAmount: 55_000, orderTotal: 55_000 };

assert.equal(getExpectedPaymentAmount(deposit), 50_000);
assert.equal(isExpectedPaymentAmount(deposit, '50000.00'), true);
assert.equal(isExpectedPaymentAmount(deposit, 1), false);
assert.equal(isExpectedPaymentAmount(takeaway, 55_000), true);
assert.equal(isExpectedPaymentAmount({ paymentAmount: 0 }, 0), false);

async function main() {
  let createdCode: string | undefined;

  try {
    const [menuItem] = await PrismaRestaurantRepository.getMenuItems({ tenantId: DEFAULT_TENANT_ID });
    assert.ok(menuItem, 'Seeded menu item is required');

    const order = await PrismaRestaurantRepository.createTakeawayOrder({
      tenantId: DEFAULT_TENANT_ID,
      customerName: 'Payment Integrity Test',
      customerPhone: '-',
      items: [{ menuItemId: menuItem.id, name: menuItem.name, price: menuItem.price, quantity: 1 }],
    });
    createdCode = order.code;

    assert.equal(order.tableId, '');
    assert.equal(order.paymentStatus, 'unpaid');
    assert.equal((await PrismaRestaurantRepository.updatePaymentStatusByCode(order.code, 'settlement', 'qris', 1)).success, false);

    const settled = await PrismaRestaurantRepository.updatePaymentStatusByCode(
      order.code,
      'settlement',
      'qris',
      order.orderTotal
    );
    assert.equal(settled.success, true);
    assert.equal(settled.reservation?.paymentStatus, 'settlement');
    assert.equal(settled.reservation?.status, 'confirmed');

    const latePending = await PrismaRestaurantRepository.updatePaymentStatusByCode(
      order.code,
      'pending',
      'qris',
      order.orderTotal
    );
    assert.equal(latePending.reservation?.paymentStatus, 'settlement');

    console.log('Payment integrity and PostgreSQL flow checks passed.');
  } finally {
    if (createdCode) {
      await prisma.$transaction([
        prisma.auditEvent.deleteMany({ where: { entity: { contains: createdCode } } }),
        prisma.reservation.delete({ where: { code: createdCode } }),
      ]);
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
