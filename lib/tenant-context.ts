"use client";

import { createContext, useContext } from 'react';
import type { TenantBranding } from './tenants';
import { TENANT_BRANDING, DEFAULT_TENANT_ID } from './tenants';

export interface TenantContextValue {
  tenantId: string;
  branding: TenantBranding;
  /** URL base path for this tenant: '' for the default root storefront, '/t/<slug>' otherwise */
  basePath: string;
}

const defaultBranding = TENANT_BRANDING[DEFAULT_TENANT_ID];

export const TenantContext = createContext<TenantContextValue>({
  tenantId: DEFAULT_TENANT_ID,
  branding: defaultBranding,
  basePath: '',
});

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}
