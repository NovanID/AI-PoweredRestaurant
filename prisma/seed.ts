import { PrismaClient, MenuCategory, TableArea, TableStatus, ReservationStatus, PaymentStatus } from '@prisma/client';
import {
  DEFAULT_TENANT_ID,
  TENANT_RASO_MINANG,
  TENANT_KOPI_NUSANTARA,
  initialRestaurantProfile,
  initialTables,
  initialMenuItems,
  initialReservations,
  initialAuditEvents,
  kopiNusantaraProfile,
  kopiNusantaraTables,
  kopiNusantaraMenuItems,
  kopiNusantaraReservations,
  kopiNusantaraAuditEvents,
} from '../lib/mock-data';

const prisma = new PrismaClient();

const CATEGORY_MAP: Record<string, MenuCategory> = {
  'Lauk Utama': MenuCategory.LAUK_UTAMA,
  'Sayur & Kuah': MenuCategory.SAYUR_KUAH,
  'Pelengkap & Sambal': MenuCategory.PELENGKAP_SAMBAL,
  'Minuman': MenuCategory.MINUMAN,
};

async function seedTenant(
  profile: typeof initialRestaurantProfile,
  tables: typeof initialTables,
  menuItems: typeof initialMenuItems,
  reservations: typeof initialReservations,
  auditEvents: typeof initialAuditEvents
) {
  const tenantId = profile.tenantId;
  console.log(`\n--- Seeding Tenant: ${profile.name} (${tenantId}) ---`);

  // 1. Restaurant Profile
  const restaurant = await prisma.restaurant.upsert({
    where: { tenantId },
    update: {
      name: profile.name,
      tagline: profile.tagline,
      address: profile.address,
      city: profile.city,
      phone: profile.phone,
      openingHours: profile.openingHours,
      openTime: profile.openTime,
      closeTime: profile.closeTime,
      description: profile.description,
      policies: profile.policies,
    },
    create: {
      tenantId,
      name: profile.name,
      tagline: profile.tagline,
      address: profile.address,
      city: profile.city,
      phone: profile.phone,
      openingHours: profile.openingHours,
      openTime: profile.openTime,
      closeTime: profile.closeTime,
      description: profile.description,
      policies: profile.policies,
    },
  });
  console.log(`✔ Restaurant upserted: ${restaurant.name}`);

  // 2. Tables
  for (const tbl of tables) {
    await prisma.table.upsert({
      where: {
        tenantId_tableNumber: {
          tenantId,
          tableNumber: tbl.number,
        },
      },
      update: {
        capacity: tbl.capacity,
        area: tbl.area as TableArea,
        status: tbl.status as TableStatus,
      },
      create: {
        id: tbl.id,
        tenantId,
        tableNumber: tbl.number,
        capacity: tbl.capacity,
        area: tbl.area as TableArea,
        status: tbl.status as TableStatus,
      },
    });
  }
  console.log(`✔ Seeded ${tables.length} tables.`);

  // 3. Menu Items
  for (const item of menuItems) {
    const categoryEnum = CATEGORY_MAP[item.category] || MenuCategory.LAUK_UTAMA;
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        category: categoryEnum,
        price: item.price,
        description: item.description,
        isAvailable: item.isAvailable,
        isPopular: item.isPopular,
        spicinessLevel: item.spicinessLevel,
      },
      create: {
        id: item.id,
        tenantId,
        name: item.name,
        category: categoryEnum,
        price: item.price,
        description: item.description,
        isAvailable: item.isAvailable,
        isPopular: item.isPopular,
        spicinessLevel: item.spicinessLevel,
      },
    });
  }
  console.log(`✔ Seeded ${menuItems.length} menu items.`);

  // 4. Reservations
  for (const res of reservations) {
    // Ensure table exists
    const table = await prisma.table.findFirst({
      where: { tenantId, tableNumber: res.tableNumber },
    });

    if (table) {
      await prisma.reservation.upsert({
        where: { code: res.code },
        update: {
          customerName: res.customerName,
          customerPhone: res.customerPhone || '-',
          tableId: table.id,
          tableNumber: res.tableNumber,
          tableArea: res.tableArea as TableArea,
          reservationDate: res.date,
          reservationTime: res.time,
          guestCount: res.guestCount,
          status: res.status as ReservationStatus,
          autoConfirmed: res.autoConfirmed ?? true,
          qrToken: res.qrToken,
          seatedAt: res.seatedAt ? new Date(res.seatedAt) : null,
          completedAt: res.completedAt ? new Date(res.completedAt) : null,
          paymentStatus: (res.paymentStatus as PaymentStatus) || 'unpaid',
          paymentAmount: res.paymentAmount ?? null,
          paymentMethod: res.paymentMethod ?? null,
          orderItems: res.orderItems ? (res.orderItems as any) : [],
          orderTotal: res.orderTotal ?? null,
          notes: res.notes,
        },
        create: {
          id: res.id,
          tenantId,
          code: res.code,
          customerName: res.customerName,
          customerPhone: res.customerPhone || '-',
          tableId: table.id,
          tableNumber: res.tableNumber,
          tableArea: res.tableArea as TableArea,
          reservationDate: res.date,
          reservationTime: res.time,
          guestCount: res.guestCount,
          status: res.status as ReservationStatus,
          autoConfirmed: res.autoConfirmed ?? true,
          qrToken: res.qrToken,
          seatedAt: res.seatedAt ? new Date(res.seatedAt) : null,
          completedAt: res.completedAt ? new Date(res.completedAt) : null,
          paymentStatus: (res.paymentStatus as PaymentStatus) || 'unpaid',
          paymentAmount: res.paymentAmount ?? null,
          paymentMethod: res.paymentMethod ?? null,
          orderItems: res.orderItems ? (res.orderItems as any) : [],
          orderTotal: res.orderTotal ?? null,
          notes: res.notes,
        },
      });
    }
  }
  console.log(`✔ Seeded ${reservations.length} reservations.`);

  // 5. Audit Events
  for (const aud of auditEvents) {
    await prisma.auditEvent.upsert({
      where: { id: aud.id },
      update: {
        actor: aud.actor,
        action: aud.action,
        entity: aud.entity,
        details: aud.details,
      },
      create: {
        id: aud.id,
        tenantId,
        actor: aud.actor,
        action: aud.action,
        entity: aud.entity,
        details: aud.details,
      },
    });
  }
  console.log(`✔ Seeded ${auditEvents.length} audit events.`);
}

async function main() {
  console.log('🚀 Starting Multi-Tenant Database Seeding (PostgreSQL)...');

  // Seed Tenant 1: Raso Minang Padang
  await seedTenant(
    initialRestaurantProfile,
    initialTables,
    initialMenuItems,
    initialReservations,
    initialAuditEvents
  );

  // Seed Tenant 2: Kopi Nusantara Cafe
  await seedTenant(
    kopiNusantaraProfile,
    kopiNusantaraTables,
    kopiNusantaraMenuItems,
    kopiNusantaraReservations,
    kopiNusantaraAuditEvents
  );

  console.log('\n🎉 Multi-Tenant PostgreSQL Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
