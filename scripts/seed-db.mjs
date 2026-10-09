import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_TENANT_ID,
  initialRestaurantProfile,
  initialTables,
  initialMenuItems,
  initialReservations,
  initialAuditEvents,
} from '../lib/mock-data.ts';

const prisma = new PrismaClient();

const categoryMap = {
  'Lauk Utama': 'LAUK_UTAMA',
  'Sayur & Kuah': 'SAYUR_KUAH',
  'Pelengkap & Sambal': 'PELENGKAP_SAMBAL',
  Minuman: 'MINUMAN',
};

function toDate(value) {
  return value ? new Date(value) : undefined;
}

async function main() {
  const p = initialRestaurantProfile;

  await prisma.restaurant.upsert({
    where: { tenantId: DEFAULT_TENANT_ID },
    update: {
      name: p.name,
      tagline: p.tagline,
      address: p.address,
      city: p.city,
      phone: p.phone,
      openingHours: p.openingHours,
      openTime: p.openTime,
      closeTime: p.closeTime,
      description: p.description,
      policies: p.policies,
    },
    create: {
      tenantId: p.tenantId,
      name: p.name,
      tagline: p.tagline,
      address: p.address,
      city: p.city,
      phone: p.phone,
      openingHours: p.openingHours,
      openTime: p.openTime,
      closeTime: p.closeTime,
      description: p.description,
      policies: p.policies,
    },
  });

  for (const table of initialTables) {
    await prisma.table.upsert({
      where: { tenantId_tableNumber: { tenantId: table.tenantId, tableNumber: table.number } },
      update: {
        capacity: table.capacity,
        area: table.area,
        status: table.status,
      },
      create: {
        id: table.id,
        tenantId: table.tenantId,
        tableNumber: table.number,
        capacity: table.capacity,
        area: table.area,
        status: table.status,
      },
    });
  }

  for (const item of initialMenuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {
        tenantId: item.tenantId,
        name: item.name,
        category: categoryMap[item.category],
        price: item.price,
        description: item.description,
        isAvailable: item.isAvailable,
        isPopular: item.isPopular ?? false,
        spicinessLevel: item.spicinessLevel ?? 1,
      },
      create: {
        id: item.id,
        tenantId: item.tenantId,
        name: item.name,
        category: categoryMap[item.category],
        price: item.price,
        description: item.description,
        isAvailable: item.isAvailable,
        isPopular: item.isPopular ?? false,
        spicinessLevel: item.spicinessLevel ?? 1,
      },
    });
  }

  for (const reservation of initialReservations) {
    await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId: reservation.tenantId, phone: reservation.customerPhone } },
      update: {
        name: reservation.customerName,
        lastVisit: toDate(reservation.updatedAt),
      },
      create: {
        tenantId: reservation.tenantId,
        name: reservation.customerName,
        phone: reservation.customerPhone,
        reservationCount: 1,
        lastVisit: toDate(reservation.updatedAt),
      },
    });

    await prisma.reservation.upsert({
      where: { code: reservation.code },
      update: {
        tenantId: reservation.tenantId,
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        tableId: reservation.tableId,
        tableNumber: reservation.tableNumber,
        tableArea: reservation.tableArea,
        reservationDate: reservation.date,
        reservationTime: reservation.time,
        guestCount: reservation.guestCount,
        status: reservation.status,
        autoConfirmed: reservation.autoConfirmed ?? false,
        qrToken: reservation.qrToken,
        seatedAt: toDate(reservation.seatedAt),
        completedAt: toDate(reservation.completedAt),
        expiresAt: toDate(reservation.expiresAt),
        paymentStatus: reservation.paymentStatus ?? 'unpaid',
        paymentAmount: reservation.paymentAmount,
        paymentMethod: reservation.paymentMethod,
        snapToken: reservation.snapToken,
        paymentPaidAt: toDate(reservation.paymentPaidAt),
        notes: reservation.notes,
        rejectionReason: reservation.rejectionReason,
        createdAt: toDate(reservation.createdAt),
        updatedAt: toDate(reservation.updatedAt),
      },
      create: {
        id: reservation.id,
        tenantId: reservation.tenantId,
        code: reservation.code,
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        tableId: reservation.tableId,
        tableNumber: reservation.tableNumber,
        tableArea: reservation.tableArea,
        reservationDate: reservation.date,
        reservationTime: reservation.time,
        guestCount: reservation.guestCount,
        status: reservation.status,
        autoConfirmed: reservation.autoConfirmed ?? false,
        qrToken: reservation.qrToken,
        seatedAt: toDate(reservation.seatedAt),
        completedAt: toDate(reservation.completedAt),
        expiresAt: toDate(reservation.expiresAt),
        paymentStatus: reservation.paymentStatus ?? 'unpaid',
        paymentAmount: reservation.paymentAmount,
        paymentMethod: reservation.paymentMethod,
        snapToken: reservation.snapToken,
        paymentPaidAt: toDate(reservation.paymentPaidAt),
        notes: reservation.notes,
        rejectionReason: reservation.rejectionReason,
        createdAt: toDate(reservation.createdAt),
        updatedAt: toDate(reservation.updatedAt),
      },
    });
  }

  for (const event of initialAuditEvents) {
    await prisma.auditEvent.upsert({
      where: { id: event.id },
      update: {
        tenantId: event.tenantId,
        actor: event.actor,
        action: event.action,
        entity: event.entity,
        details: event.details,
        createdAt: toDate(event.timestamp),
      },
      create: {
        id: event.id,
        tenantId: event.tenantId,
        actor: event.actor,
        action: event.action,
        entity: event.entity,
        details: event.details,
        createdAt: toDate(event.timestamp),
      },
    });
  }

  const [restaurants, tables, menuItems, reservations, auditEvents] = await Promise.all([
    prisma.restaurant.count(),
    prisma.table.count(),
    prisma.menuItem.count(),
    prisma.reservation.count(),
    prisma.auditEvent.count(),
  ]);

  console.log(JSON.stringify({ restaurants, tables, menuItems, reservations, auditEvents }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
