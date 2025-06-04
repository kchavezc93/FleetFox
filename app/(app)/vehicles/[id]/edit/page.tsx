import { getVehicleById, updateVehicle } from "@/lib/actions/vehicle-actions";
import { VehicleForm } from "@/components/vehicle-form";
import { notFound } from "next/navigation";

export default async function EditVehiclePage({ params }: { params: { id: string } }) {

  const vehicle = await getVehicleById(params.id);

  if (!vehicle) {
    notFound();
  }

  return (
    <>
      <h2>Editar Vehículo</h2>
      <VehicleForm vehicle={vehicle} vehicleId={params.id} onSubmitAction={updateVehicle} />
    </>
  );
}