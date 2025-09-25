import { requirePermission } from "@/lib/authz";
import { getVehicles } from "@/lib/actions/vehicle-actions";
import { createFuelingLog } from "@/lib/actions/fueling-actions";
import { FuelingForm } from "@/components/fueling-form";

export default async function NewFuelingMobilePage() {
	await requirePermission('/fueling-mobile');
	const vehicles = await getVehicles();
	const activeVehicles = vehicles.filter(v => v.status === 'Activo' || v.status === 'En Taller');

	return (
		<div className="max-w-md mx-auto">
			<FuelingForm vehicles={activeVehicles} onSubmitAction={createFuelingLog} redirectPath="/fueling/mobile" />
		</div>
	);
}
