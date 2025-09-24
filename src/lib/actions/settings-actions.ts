
"use server";

import { getDbClient } from "@/lib/db";
import sql from "mssql";
import { getCurrentUser } from "@/lib/auth/session";

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
		// Resolve current user for auditing (if schema supports audit columns)
		const currentUser = await getCurrentUser();
		const userIdInt = currentUser ? parseInt(currentUser.id, 10) : null;

		// Detect optional audit columns to avoid errors if schema isn't migrated yet
		const colsCheck = await pool.request().query(`
			SELECT 
			  COL_LENGTH('settings','createdByUserId') AS hasCreatedBy,
			  COL_LENGTH('settings','updatedByUserId') AS hasUpdatedBy,
			  COL_LENGTH('settings','createdAt') AS hasCreatedAt,
			  COL_LENGTH('settings','updatedAt') AS hasUpdatedAt;
		`);
		const row = colsCheck.recordset?.[0] || {};
		const hasCreatedBy = !!row.hasCreatedBy;
		const hasUpdatedBy = !!row.hasUpdatedBy;
		const hasCreatedAt = !!row.hasCreatedAt;
		const hasUpdatedAt = !!row.hasUpdatedAt; // expected true in current schema

		const columns: string[] = [
		  'alert_daysThreshold',
		  'alert_mileageThreshold',
		  'alert_lowEfficiencyThresholdKmPerGallon',
		  'alert_highMaintenanceCostThreshold',
		  'alert_maintenanceCostWindowDays'
		];
		const values: string[] = ['@days', '@km', '@lowEff', '@highMaint', '@win'];
		if (hasCreatedAt) { columns.push('createdAt'); values.push('GETDATE()'); }
		if (hasUpdatedAt) { columns.push('updatedAt'); values.push('GETDATE()'); }
		if (hasCreatedBy) { columns.push('createdByUserId'); values.push(userIdInt !== null ? String(userIdInt) : 'NULL'); }
		if (hasUpdatedBy) { columns.push('updatedByUserId'); values.push(userIdInt !== null ? String(userIdInt) : 'NULL'); }

		const sqlInsert = `INSERT INTO settings (${columns.join(', ')}) VALUES (${values.join(', ')});`;
		await req.query(sqlInsert);
		return { success: true };
	} catch (e) {
		console.error('[Settings] saveAlertThresholdsAction error', e);
		return { success: false };
	}
}
