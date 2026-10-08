import { create, insert, search, type AnyOrama } from '@orama/orama';
import { MenuItem, TenantId } from '../domain/types';
import { PrismaRestaurantRepository } from '../db/prisma-repository';
import { DEFAULT_TENANT_ID } from '../mock-data';

export interface SearchMenuFilters {
  tenantId?: TenantId;
  category?: string;
  maxPrice?: number;
  spicinessLevel?: number;
  tolerance?: number;
  limit?: number;
}

const menuSchema = {
  id: 'string',
  name: 'string',
  category: 'string',
  price: 'number',
  description: 'string',
  isAvailable: 'boolean',
  spicinessLevel: 'number',
  tenantId: 'string',
} as const;

/**
 * Orama fuzzy-search index built ENTIRELY from PostgreSQL (all tenants).
 * The in-memory mock store is no longer a data source.
 * Results are always filtered by tenantId so tenants never see each other's menu.
 */
export class OramaMenuIndex {
  private static db: AnyOrama | null = null;
  private static initPromise: Promise<void> | null = null;
  private static lastBuildAt = 0;
  private static readonly REFRESH_MS = 60_000; // rebuild at most once per minute

  private static async build(): Promise<AnyOrama> {
    const db = await create({ schema: menuSchema });
    // Load every tenant's menu straight from PostgreSQL
    const items = (await PrismaRestaurantRepository.getMenuItemsForAllTenants()) as MenuItem[];
    for (const item of items) {
      await insert(db, {
        id: String(item.id),
        name: String(item.name),
        category: String(item.category),
        price: Number(item.price),
        description: String(item.description || ''),
        isAvailable: Boolean(item.isAvailable),
        spicinessLevel: Number(item.spicinessLevel || 0),
        tenantId: String(item.tenantId || DEFAULT_TENANT_ID),
      });
    }
    this.lastBuildAt = Date.now();
    console.log(`[OramaMenuIndex] Built from PostgreSQL with ${items.length} menu items.`);
    return db;
  }

  /**
   * Initialize or retrieve existing Orama index instance (with TTL refresh).
   */
  public static async getInstance(): Promise<AnyOrama> {
    if (this.db && Date.now() - this.lastBuildAt < this.REFRESH_MS) {
      return this.db;
    }

    if (this.initPromise) {
      await this.initPromise;
      if (this.db) return this.db;
    }

    this.initPromise = (async () => {
      try {
        this.db = await this.build();
      } finally {
        this.initPromise = null;
      }
    })();

    await this.initPromise;
    if (!this.db) {
      throw new Error('Orama index gagal dibangun dari database.');
    }
    return this.db;
  }

  /**
   * Search menu items with fuzzy typo tolerance (Levenshtein distance)
   */
  public static async searchMenu(
    query?: string,
    filters?: SearchMenuFilters
  ): Promise<MenuItem[]> {
    const db = await this.getInstance();
    const cleanQuery = query?.trim();

    // If no search query, return filtered items straight from PostgreSQL
    if (!cleanQuery) {
      let allItems: MenuItem[] = await PrismaRestaurantRepository.getMenuItems({
        tenantId: filters?.tenantId,
        category: filters?.category,
        maxPrice: filters?.maxPrice,
        spicinessLevel: filters?.spicinessLevel,
      });

      if (filters?.maxPrice) {
        allItems = allItems.filter((i) => i.price <= filters.maxPrice!);
      }
      if (filters?.spicinessLevel) {
        allItems = allItems.filter((i) => i.spicinessLevel === filters.spicinessLevel!);
      }
      return allItems;
    }

    const tolerancesToTry = filters?.tolerance !== undefined
      ? [filters.tolerance]
      : cleanQuery.length <= 3
      ? [0]
      : [0, 1, 2];

    let hits: MenuItem[] = [];

    for (const tol of tolerancesToTry) {
      const searchResults = await search(db, {
        term: cleanQuery,
        tolerance: tol,
        limit: filters?.limit || 10,
        boost: {
          name: 3,
        },
      });

      let candidateHits = searchResults.hits.map((hit) => hit.document as unknown as MenuItem);

      // TENANT ISOLATION: when a tenant filter is given, drop any document
      // that does not belong to that tenant (never leak across tenants).
      if (filters?.tenantId) {
        candidateHits = candidateHits.filter((h) => h.tenantId === filters.tenantId);
      }
      if (filters?.category && filters.category !== 'Semua') {
        candidateHits = candidateHits.filter((h) => h.category.toLowerCase() === filters.category!.toLowerCase());
      }
      if (filters?.maxPrice) {
        candidateHits = candidateHits.filter((h) => h.price <= filters.maxPrice!);
      }
      if (filters?.spicinessLevel) {
        candidateHits = candidateHits.filter((h) => Number(h.spicinessLevel) === Number(filters.spicinessLevel));
      }

      if (candidateHits.length > 0) {
        hits = candidateHits;
        break;
      }
    }

    return hits;
  }

  /**
   * Find the single best matching menu item for an order query with typo tolerance
   * e.g. "rendng" -> Rendang Daging Sapi, "aym pop" -> Ayam Pop
   */
  public static async findBestMatch(query: string, tenantId?: TenantId): Promise<MenuItem | null> {
    const results = await this.searchMenu(query, { tenantId, limit: 1 });
    if (results.length > 0) {
      return results[0];
    }
    return null;
  }

  /**
   * Add or update an individual menu item in the index
   */
  public static async syncMenuItem(item: MenuItem): Promise<void> {
    const db = await this.getInstance();
    await insert(db, {
      id: String(item.id),
      name: String(item.name),
      category: String(item.category),
      price: Number(item.price),
      description: String(item.description || ''),
      isAvailable: Boolean(item.isAvailable),
      spicinessLevel: Number(item.spicinessLevel || 0),
      tenantId: String(item.tenantId || DEFAULT_TENANT_ID),
    });
  }

  /**
   * Force full re-index from PostgreSQL
   */
  public static async reindex(): Promise<void> {
    this.db = null;
    this.lastBuildAt = 0;
    await this.getInstance();
  }
}
