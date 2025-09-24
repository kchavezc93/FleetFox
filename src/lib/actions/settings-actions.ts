
"use server";

import { getDbClient } from "@/lib/db";
import sql from "mssql";

export async function loadAlertThresholdsAction() {
	const dbClient = await getDbClient();
	if (!dbClient || dbClient.type !== "SQLServer" || !(dbClient as any).pool) return null;
	const pool = (dbClient as any).pool as sql.ConnectionPool;
	try {
		const res = await pool.request().query(`
			SELECT TOP 1 
				alert_daysThreshold AS daysThreshold,
				alert_mileageThreshold AS mileageThreshold,
				alert_lowEfficiencyThresholdKmPerGallon AS lowEfficiencyThresholdKmPerGallon,
				alert_highMaintenanceCostThreshold AS highMaintenanceCostThreshold,
				alert_maintenanceCostWindowDays AS maintenanceCostWindowDays
			FROM settings
			ORDER BY updatedAt DESC;
		`);
		if (!res.recordset.length) return null;
		const r = res.recordset[0];
		return {
			daysThreshold: r.daysThreshold != null ? Number(r.daysThreshold) : undefined,
			mileageThreshold: r.mileageThreshold != null ? Number(r.mileageThreshold) : undefined,
			lowEfficiencyThresholdKmPerGallon: r.lowEfficiencyThresholdKmPerGallon != null ? Number(r.lowEfficiencyThresholdKmPerGallon) : undefined,
			highMaintenanceCostThreshold: r.highMaintenanceCostThreshold != null ? Number(r.highMaintenanceCostThreshold) : undefined,
			maintenanceCostWindowDays: r.maintenanceCostWindowDays != null ? Number(r.maintenanceCostWindowDays) : undefined,
		};
	} catch {
		return null;
	}
}

export async function saveAlertThresholdsAction(payload: {
	daysThreshold: number;
	mileageThreshold: number;
	lowEfficiencyThresholdKmPerGallon: number;
	highMaintenanceCostThreshold: number;
	maintenanceCostWindowDays: number;
}) {
	const dbClient = await getDbClient();
	if (!dbClient || dbClient.type !== "SQLServer" || !(dbClient as any).pool) return { success: false };
	const pool = (dbClient as any).pool as sql.ConnectionPool;
	try {
		const req = pool.request();
		req.input('days', sql.Int, payload.daysThreshold);
		req.input('km', sql.Int, payload.mileageThreshold);
		req.input('lowEff', sql.Decimal(10,2), payload.lowEfficiencyThresholdKmPerGallon);
		req.input('highMaint', sql.Decimal(18,2), payload.highMaintenanceCostThreshold);
		req.input('win', sql.Int, payload.maintenanceCostWindowDays);
		await req.query(`
			INSERT INTO settings (
				alert_daysThreshold,
				alert_mileageThreshold,
				alert_lowEfficiencyThresholdKmPerGallon,
				alert_highMaintenanceCostThreshold,
				alert_maintenanceCostWindowDays,
				updatedAt
			) VALUES (
				@days,
				@km,
				@lowEff,
				@highMaint,
				@win,
				GETDATE()
			);
		`);
		return { success: true };
	} catch (e) {
		console.error('[Settings] saveAlertThresholdsAction error', e);
		return { success: false };
	}
}
