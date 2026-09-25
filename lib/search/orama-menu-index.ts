import { create, insert, search, type AnyOrama } from '@orama/orama';
import { MenuItem, TenantId } from '../domain/types';
import { restaurantStore } from '../restaurant-store';
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

export class OramaMenuIndex {
  private static db: AnyOrama | null = null;
  private static isInitializing = false;
  private static initPromise: Promise<void> | null = null;

  /**
   * Initialize or retrieve existing Orama index instance
   */
  public static async getInstance(): Promise<AnyOrama> {
    if (this.db) {
      return this.db;
    }

    if (this.initPromise) {
      await this.initPromise;
      if (this.db) return this.db;
    }

    this.initPromise = (async () => {
      this.isInitializing = true;
      try {
        const db = await create({
          schema: menuSchema,
        });

        // 1. Fetch menu items from Prisma or fallback to in-memory store
        let items: MenuItem[] = [];
        try {
          items = (await PrismaRestaurantRepository.getMenuItems()) as MenuItem[];
        } catch (dbErr) {
          console.warn('[OramaMenuIndex] Prisma load fallback to store:', dbErr);
        }

        if (!items || items.length === 0) {
          items = restaurantStore.getMenuItems() as MenuItem[];
        }

        // 2. Insert items into Orama index
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

        this.db = db;
        console.log(`[OramaMenuIndex] Initialized with ${items.length} menu items.`);
      } finally {
        this.isInitializing = false;
        this.initPromise = null;
      }
    })();

    await this.initPromise;
    return this.db!;
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

    // If no search query, return filtered items from store/Prisma directly
    if (!cleanQuery) {
      let allItems: MenuItem[] = [];
      try {
        allItems = (await PrismaRestaurantRepository.getMenuItems({
          tenantId: filters?.tenantId,
          category: filters?.category,
          maxPrice: filters?.maxPrice,
          spicinessLevel: filters?.spicinessLevel,
        })) as MenuItem[];
      } catch {
        allItems = restaurantStore.getMenuItems(filters?.category as any) as MenuItem[];
      }

      if (filters?.maxPrice) {
        allItems = allItems.filter((i) => i.price <= filters.maxPrice!);
      }
      if (filters?.spicinessLevel) {
        allItems = allItems.filter((i) => i.spicinessLevel === filters.spicinessLevel!);
      }
      return allItems;
    }

    // If explicit tolerance passed, use it directly
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

      // Apply secondary filters
      if (filters?.category && filters.category !== 'Semua') {
        candidateHits = candidateHits.filter((h) => h.category.toLowerCase() === filters.category!.toLowerCase());
      }
      if (filters?.maxPrice) {
        candidateHits = candidateHits.filter((h) => h.price <= filters.maxPrice!);
      }
      if (filters?.spicinessLevel) {
        candidateHits = candidateHits.filter((h) => Number(h.spicinessLevel) === Number(filters.spicinessLevel));
      }
      if (filters?.tenantId) {
        candidateHits = candidateHits.filter((h) => !h.tenantId || h.tenantId === filters.tenantId);
      }

      if (candidateHits.length > 0) {
        hits = candidateHits;
        break; // Stop escalating tolerance once higher quality matches are found
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
   * Force full re-index
   */
  public static async reindex(): Promise<void> {
    this.db = null;
    await this.getInstance();
  }
}
