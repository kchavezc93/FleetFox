import { requirePermission } from "@/lib/authz";
import { getFuelingLogById, deleteFuelingLog } from "@/lib/actions/fueling-actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { VoucherGallery } from "@/components/voucher-gallery";
import { formatCurrency, formatNumber } from "@/lib/currency";

export default async function MobileFuelingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission('/fueling-mobile');
  const log = await getFuelingLogById(id);
  if (!log) {
    return <div className="max-w-md mx-auto p-4 text-sm text-muted-foreground">Registro no encontrado.</div>;
  }
  return (
    <div className="max-w-md mx-auto p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Link href="/fueling/mobile"><Button variant="secondary" size="sm">Volver</Button></Link>
        <Link href={`/fueling/mobile/${log.id}/edit`}><Button variant="outline" size="sm">Editar</Button></Link>
      </div>
      <div className="text-sm"><span className="text-muted-foreground">Vehículo:</span> {log.vehiclePlateNumber || log.vehicleId}</div>
      <div className="text-sm"><span className="text-muted-foreground">Fecha:</span> {log.fuelingDate}</div>
  <div className="text-sm"><span className="text-muted-foreground">Kilometraje:</span> {formatNumber(log.mileageAtFueling)}</div>
  <div className="text-sm"><span className="text-muted-foreground">Litros:</span> {formatNumber(log.quantityLiters, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div className="text-sm"><span className="text-muted-foreground">Costo:</span> {formatCurrency(log.totalCost)}</div>
      {log.vouchers && log.vouchers.length > 0 && (
        <VoucherGallery vouchers={log.vouchers as any} fuelingLogId={log.id} />
      )}
    </div>
  );
}
