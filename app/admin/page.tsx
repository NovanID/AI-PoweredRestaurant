import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminDashboard from "../../components/AdminDashboard";
import { getAdminSession } from "../../lib/auth/admin-session";

export const metadata: Metadata = {
  title: "Admin Portal — Multi-Tenant Restaurant",
  description: "Dashboard pengelolaan menu, reservasi, dan meja untuk tenant restoran.",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Server-side authorization: verified HMAC session required (proxy.ts only
  // does the optimistic cookie-presence redirect).
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return <AdminDashboard />;
}
