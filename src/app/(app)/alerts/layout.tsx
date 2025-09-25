import { requirePermission } from "@/lib/authz";

export default async function AlertsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('/alerts');
  return children;
}
