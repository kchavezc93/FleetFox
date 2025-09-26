import { requirePermission } from "@/lib/authz";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import { createFuelingLog } from "@/lib/actions/fueling-actions";
import { FuelingForm } from "@/components/fueling-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NewFuelingMobilePage() {
	await requirePermission('/fueling-mobile');
	const vehicles = await getVehicles();
	const activeVehicles = vehicles.filter(v => v.status === 'Activo' || v.status === 'En Taller');

	return (
			<div className="max-w-md mx-auto p-4 space-y-3">
				<div className="flex items-center justify-between">
					<Link href="/fueling/mobile"><Button variant="secondary" size="sm">Volver</Button></Link>
				</div>
				<FuelingForm vehicles={activeVehicles} onSubmitAction={createFuelingLog} redirectPath="/fueling/mobile" />
		</div>
	);
}
