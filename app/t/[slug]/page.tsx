import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import TenantProvider from '../../../components/TenantProvider';
import Storefront from '../../../components/Storefront';
import { TENANT_BRANDING, resolveTenantSlug, getTenantBranding } from '../../../lib/tenants';
import { PrismaRestaurantRepository } from '../../../lib/db/prisma-repository';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenantId = resolveTenantSlug(slug);
  if (!tenantId) return { title: 'Tenant Tidak Ditemukan' };

  const branding = getTenantBranding(tenantId);
  const profile = await PrismaRestaurantRepository.getProfile(tenantId).catch(() => null);
  const name = profile?.name || branding.chatPersonaLabel.replace('Asisten AI ', '');
  return {
    title: `${name} — Reservasi & Menu Online`,
    description:
      profile?.description ||
      `${branding.badgeText}. Menu dan reservasi ${name} dengan Payment Gateway Midtrans dan Asisten AI.`,
  };
}

export default async function TenantStorefrontPage({ params }: PageProps) {
  const { slug } = await params;
  const tenantId = resolveTenantSlug(slug);

  if (!tenantId || !TENANT_BRANDING[tenantId]) {
    notFound();
  }

  // Tenant must also exist in PostgreSQL — slug alone is not enough.
  const profile = await PrismaRestaurantRepository.getProfile(tenantId).catch(() => null);
  if (!profile) {
    notFound();
  }

  return (
    <TenantProvider tenantId={tenantId}>
      <Storefront />
    </TenantProvider>
  );
}
