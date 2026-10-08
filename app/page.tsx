import type { Metadata } from 'next';
import TenantProvider from '../components/TenantProvider';
import Storefront from '../components/Storefront';
import { DEFAULT_TENANT_ID, getTenantBranding } from '../lib/tenants';
import { PrismaRestaurantRepository } from '../lib/db/prisma-repository';

export const dynamic = 'force-dynamic';

const branding = getTenantBranding(DEFAULT_TENANT_ID);

export async function generateMetadata(): Promise<Metadata> {
  const profile = await PrismaRestaurantRepository.getProfile(DEFAULT_TENANT_ID).catch(() => null);
  const name = profile?.name || 'Restoran';
  return {
    title: `${name} — Reservasi & Menu Online`,
    description:
      profile?.description ||
      `Menu dan reservasi ${name} dengan Payment Gateway Midtrans dan Asisten AI.`,
  };
}

export default function Home() {
  return (
    <TenantProvider tenantId={DEFAULT_TENANT_ID}>
      <Storefront />
    </TenantProvider>
  );
}
