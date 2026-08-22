import type { Metadata } from "next";
import AdminDashboard from "../../components/AdminDashboard";

export const metadata: Metadata = {
  title: "Admin Portal — Raso Minang",
  description: "Dashboard pengelolaan menu, reservasi, dan meja restoran Padang Raso Minang.",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
