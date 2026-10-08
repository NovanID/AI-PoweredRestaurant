"use client";

import { ReactNode } from 'react';
import { TenantContext } from '../lib/tenant-context';
import { getTenantBranding } from '../lib/tenants';
import { DEFAULT_TENANT_ID } from '../lib/mock-data';

/**
 * Client provider that makes the server-resolved tenant available to the whole
 * storefront subtree (useTenant()).
 */
export default function TenantProvider({
  tenantId,
  children,
}: {
  tenantId: string;
  children: ReactNode;
}) {
  const branding = getTenantBranding(tenantId || DEFAULT_TENANT_ID);
  const basePath =
    tenantId && tenantId !== DEFAULT_TENANT_ID ? `/t/${branding.slug}` : '';

  return (
    <TenantContext.Provider value={{ tenantId, branding, basePath }}>
      {children}
    </TenantContext.Provider>
  );
}
