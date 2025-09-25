import { requirePermission } from "@/lib/authz";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('/reports');
  return children;
}
