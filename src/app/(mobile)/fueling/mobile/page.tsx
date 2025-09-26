import { requirePermission } from "@/lib/authz";
import { getFuelingLogsFiltered } from "@/lib/actions/fueling-actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatCurrency, formatNumber } from "@/lib/currency";

function toYMD(d: Date) {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export default async function MobileFuelingHomePage() {
	await requirePermission('/fueling-mobile');
	const today = new Date();
	const sevenDaysAgo = new Date(today);
	sevenDaysAgo.setDate(today.getDate() - 7);

	const logs = await getFuelingLogsFiltered({ from: toYMD(sevenDaysAgo), to: toYMD(today) });

	return (
		<div className="max-w-md mx-auto space-y-4">
			<div className="flex justify-between items-center">
				<h1 className="text-xl font-semibold">Combustible (últimos 7 días)</h1>
				<Link href="/fueling/mobile/new">
					<Button size="sm" className="bg-primary hover:bg-primary/90">Registrar</Button>
				</Link>
			</div>

			{logs.length === 0 ? (
				<p className="text-sm text-muted-foreground">No hay registros en los últimos 7 días.</p>
			) : (
							<ul className="space-y-2">
					{logs.map((l) => (
									<li key={l.id} className="border rounded bg-card shadow-sm">
										<Link href={`/fueling/mobile/${l.id}`} className="block p-3 sm:p-4">
							<div className="text-sm font-medium">{l.vehiclePlateNumber || l.vehicleId}</div>
							<div className="text-xs text-muted-foreground">{l.fuelingDate}</div>
							<div className="mt-1 text-sm flex justify-between">
													<span>{formatNumber(l.quantityLiters, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L</span>
													<span>{formatCurrency(l.totalCost)}</span>
							</div>
							<div className="mt-1 text-xs text-muted-foreground truncate">{l.station}</div>
						  </Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
