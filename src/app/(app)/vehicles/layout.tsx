import { requirePermission } from "@/lib/authz";

export default async function VehiclesLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('/vehicles');
  return children;
}
