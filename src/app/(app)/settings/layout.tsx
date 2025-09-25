import { requirePermission } from "@/lib/authz";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('/settings');
  return children;
}
