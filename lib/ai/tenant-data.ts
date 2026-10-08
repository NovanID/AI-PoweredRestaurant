import { PrismaRestaurantRepository } from '../db/prisma-repository';
import { RestaurantProfile, MenuItem, TenantId } from '../domain/types';

export interface TenantRuntimeData {
  profile: RestaurantProfile;
  menuSnapshot: MenuItem[];
  availableTablesCount: number;
}

/**
 * Load the AI grounding context for ONE tenant straight from PostgreSQL.
 * This is the ONLY server-side source of restaurant data for the AI flow —
 * the in-memory singleton store is no longer consulted.
 *
 * Throws when the tenant is unknown or the DB is unreachable; callers must
 * surface that as a failure instead of falling back to another tenant's data.
 */
export async function loadTenantRuntimeData(tenantId: TenantId): Promise<TenantRuntimeData> {
  const [profile, menuSnapshot, tables] = await Promise.all([
    PrismaRestaurantRepository.getProfile(tenantId),
    PrismaRestaurantRepository.getMenuItems({ tenantId }),
    PrismaRestaurantRepository.getTables(tenantId),
  ]);

  if (!profile) {
    throw new Error(`Tenant "${tenantId}" tidak ditemukan di database.`);
  }

  return {
    profile,
    menuSnapshot,
    availableTablesCount: tables.filter((t) => t.status === 'available').length,
  };
}
