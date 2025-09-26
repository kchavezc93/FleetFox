"use server";

import { getDbClient } from "@/lib/db";
import sql from "mssql";
import type { Alert } from "@/types";
import { revalidatePath } from "next/cache";
import { getUpcomingMaintenance, getFuelEfficiencyStats, getMaintenanceCostSummary } from "@/lib/actions/report-actions";
import { getExpiringDocuments } from "@/lib/actions/document-actions";
import { getCurrentUser } from "@/lib/auth/session";

// Fetch alerts with optional status filter
export async function getAlerts(params: { status?: Alert["status"] } = {}): Promise<Alert[]> {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== "SQLServer" || !(dbClient as any).pool) return [];
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  const { status } = params;
  try {
    const req = pool.request();
    if (status) req.input("status", sql.NVarChar(20), status);
    const where = status ? "WHERE a.status = @status" : "";
    const result = await req.query(`
      SELECT a.id, a.vehicleId, v.plateNumber AS vehiclePlateNumber, a.alertType, a.message, a.dueDate, a.status, a.createdAt, a.severity,
             a.createdByUserId, a.updatedByUserId, cu.username AS createdByUsername, uu.username AS updatedByUsername
      FROM alerts a
      LEFT JOIN vehicles v ON v.id = a.vehicleId
      LEFT JOIN users cu ON a.createdByUserId = cu.id
      LEFT JOIN users uu ON a.updatedByUserId = uu.id
      ${where}
      ORDER BY CASE a.status WHEN N'Nueva' THEN 0 WHEN N'Vista' THEN 1 ELSE 2 END, a.createdAt DESC;
    `);
    return result.recordset.map((row: any) => ({
      id: row.id?.toString?.() ?? String(row.id),
      vehicleId: row.vehicleId?.toString?.() ?? String(row.vehicleId),
      vehiclePlateNumber: row.vehiclePlateNumber || undefined,
      alertType: row.alertType,
      message: row.message,
      dueDate: row.dueDate ? new Date(row.dueDate).toISOString().split("T")[0] : undefined,
      status: row.status,
      createdAt: new Date(row.createdAt).toISOString(),
      severity: row.severity || undefined,
      createdByUserId: row.createdByUserId ? row.createdByUserId.toString() : undefined,
      updatedByUserId: row.updatedByUserId ? row.updatedByUserId.toString() : undefined,
      createdByUsername: row.createdByUsername || undefined,
      updatedByUsername: row.updatedByUsername || undefined,
    })) as Alert[];
  } catch (err) {
    console.error("[Alert Actions] getAlerts error:", err);
    return [];
  }
}

export async function getRecentAlerts(limit = 10): Promise<Alert[]> {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== "SQLServer" || !(dbClient as any).pool) return [];
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  try {
    const req = pool.request();
    req.input("limit", sql.Int, limit);
    const result = await req.query(`
      SELECT TOP (@limit) a.id, a.vehicleId, v.plateNumber AS vehiclePlateNumber, a.alertType, a.message, a.dueDate, a.status, a.createdAt, a.severity,
             a.createdByUserId, a.updatedByUserId, cu.username AS createdByUsername, uu.username AS updatedByUsername
      FROM alerts a
      LEFT JOIN vehicles v ON v.id = a.vehicleId
      LEFT JOIN users cu ON a.createdByUserId = cu.id
      LEFT JOIN users uu ON a.updatedByUserId = uu.id
      WHERE a.status <> N'Resuelta'
      ORDER BY a.createdAt DESC;
    `);
    return result.recordset.map((row: any) => ({
      id: row.id?.toString?.() ?? String(row.id),
      vehicleId: row.vehicleId?.toString?.() ?? String(row.vehicleId),
      vehiclePlateNumber: row.vehiclePlateNumber || undefined,
      alertType: row.alertType,
      message: row.message,
      dueDate: row.dueDate ? new Date(row.dueDate).toISOString().split("T")[0] : undefined,
      status: row.status,
      createdAt: new Date(row.createdAt).toISOString(),
      severity: row.severity || undefined,
      createdByUserId: row.createdByUserId ? row.createdByUserId.toString() : undefined,
      updatedByUserId: row.updatedByUserId ? row.updatedByUserId.toString() : undefined,
      createdByUsername: row.createdByUsername || undefined,
      updatedByUsername: row.updatedByUsername || undefined,
    })) as Alert[];
  } catch (err) {
    console.error("[Alert Actions] getRecentAlerts error:", err);
    return [];
  }
}

export async function createAlert(payload: Omit<Alert, "id" | "createdAt"> & { actorUserId?: string }): Promise<{ success: boolean; id?: string; message: string }> {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== "SQLServer" || !(dbClient as any).pool) {
    return { success: false, message: "BD no disponible para crear alerta." };
  }
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  try {
    const req = pool.request();
    req.input("vehicleId", sql.NVarChar(50), payload.vehicleId);
    req.input("alertType", sql.NVarChar(100), payload.alertType);
    req.input("message", sql.NVarChar(sql.MAX), payload.message);
    req.input("dueDate", sql.Date, payload.dueDate ?? null);
    req.input("status", sql.NVarChar(20), payload.status);
    req.input("severity", sql.NVarChar(20), payload.severity ?? null);
    const actorUserIdInt = payload.actorUserId ? parseInt(payload.actorUserId, 10) : null;
    const result = await req.query(`
      INSERT INTO alerts (vehicleId, alertType, message, dueDate, status, severity, createdAt, createdByUserId, updatedByUserId)
      OUTPUT INSERTED.id
      VALUES (@vehicleId, @alertType, @message, @dueDate, @status, @severity, GETDATE(), ${actorUserIdInt !== null ? actorUserIdInt : 'NULL'}, ${actorUserIdInt !== null ? actorUserIdInt : 'NULL'});
    `);
    const id = result.recordset?.[0]?.id?.toString?.() ?? result.recordset?.[0]?.id;
    revalidatePath("/alerts");
    revalidatePath("/dashboard");
    return { success: true, id, message: "Alerta creada." };
  } catch (err) {
    console.error("[Alert Actions] createAlert error:", err);
    return { success: false, message: (err as Error).message };
  }
}

export async function updateAlertStatus(id: string, status: Alert["status"]): Promise<{ success: boolean; message: string }> {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== "SQLServer" || !(dbClient as any).pool) {
    return { success: false, message: "BD no disponible." };
  }
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  try {
    const req = pool.request();
    req.input("id", sql.NVarChar(50), id);
    req.input("status", sql.NVarChar(20), status);
    const currentUser = await getCurrentUser();
    const userIdInt = currentUser ? parseInt(currentUser.id, 10) : null;
    await req.query(`
      UPDATE alerts SET status = @status${status === "Resuelta" ? ", resolvedAt = GETDATE()" : ""}, updatedByUserId = ${userIdInt !== null ? userIdInt : 'NULL'} WHERE id = @id;
    `);
    revalidatePath("/alerts");
    revalidatePath("/dashboard");
    return { success: true, message: "Estado actualizado." };
  } catch (err) {
    console.error("[Alert Actions] updateAlertStatus error:", err);
    return { success: false, message: (err as Error).message };
  }
}

type GenerateOptions = {
  daysThreshold?: number;
  mileageThreshold?: number;
  lowEfficiencyThresholdKmPerGallon?: number; // e.g., 10 km/gal
  highMaintenanceCostThreshold?: number; // e.g., 20000 C$
  maintenanceCostWindowDays?: number; // e.g., 30 days
};

// Generate alerts based on business rules. Idempotent: avoids duplicates by key
// (vehicleId + alertType [+ dueDate]) or within a recent window, even if a prior
// alert fue Resuelta.
export async function generateAlerts(options: GenerateOptions = {}): Promise<{ success: boolean; created: number; message: string }> {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== "SQLServer" || !(dbClient as any).pool) {
    return { success: false, created: 0, message: "BD no disponible." };
  }
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  const currentUser = await getCurrentUser();
  const actorUserId = currentUser?.id;

  // Load thresholds from settings table if available
  const thresholds = await loadAlertThresholds(pool);
  const daysThreshold = options.daysThreshold ?? thresholds.daysThreshold ?? 30;
  const mileageThreshold = options.mileageThreshold ?? thresholds.mileageThreshold ?? 2000;
  const lowEffThreshold = options.lowEfficiencyThresholdKmPerGallon ?? thresholds.lowEfficiencyThresholdKmPerGallon ?? 10;
  const highMaintThreshold = options.highMaintenanceCostThreshold ?? thresholds.highMaintenanceCostThreshold ?? 20000;
  const windowDays = options.maintenanceCostWindowDays ?? thresholds.maintenanceCostWindowDays ?? 30;

  let created = 0;
  try {
    // 0) Documentos por vencer (usa el mismo umbral de días por simplicidad por ahora)
    const expiringDocs = await getExpiringDocuments(daysThreshold);
    for (const d of expiringDocs) {
      const msg = `${d.documentType}${d.documentNumber ? ` #${d.documentNumber}` : ""} vence en ${d.daysToExpiry} días (${d.expiryDate}).`;
      // Evitar duplicados por llave (vehículo+tipo+dueDate) aunque hayan sido resueltos
      const exists = await existsSimilar(pool, d.vehicleId, "DocumentExpiry", { dueDate: d.expiryDate, includeResolved: true });
      if (!exists) {
        await createAlert({ vehicleId: d.vehicleId, alertType: "DocumentExpiry", message: msg, dueDate: d.expiryDate, status: "Nueva", severity: d.daysToExpiry <= 7 ? "High" : "Medium", actorUserId });
        created++;
      }
    }

    // 1) Próximo mantenimiento (fecha o km)
    const upcoming = await getUpcomingMaintenance({ daysThreshold, mileageThreshold });
    for (const item of upcoming) {
      const dueDate = item.nextPreventiveMaintenanceDate ?? undefined;
      const message = `Mantenimiento preventivo próximo por ${item.reason}.`;
      const severity: Alert["severity"] = item.reason === "Ambos" ? "High" : "Medium";
      // Si hay dueDate, dedup por llave; si no, dedup por ventana de 14 días
      const exists = await existsSimilar(pool, item.vehicleId, "PreventiveMaintenanceDue", { dueDate, withinDays: dueDate ? undefined : 14, includeResolved: true });
      if (!exists) {
        await createAlert({ vehicleId: item.vehicleId, alertType: "PreventiveMaintenanceDue", message, dueDate, status: "Nueva", severity, actorUserId });
        created++;
      }
    }

    // 2) Baja eficiencia de combustible (promedio por vehículo bajo umbral)
    const effStats = await getFuelEfficiencyStats();
    for (const s of effStats) {
      if (s.averageEfficiency != null && s.averageEfficiency < lowEffThreshold) {
        const msg = `Eficiencia baja (${s.averageEfficiency.toFixed(1)} km/gal < ${lowEffThreshold}).`;
        // Evitar spam: si ya hubo una alerta de baja eficiencia en últimos 30 días, no duplicar
        const exists = await existsSimilar(pool, s.vehicleId, "LowMileageEfficiency", { withinDays: 30, includeResolved: true });
        if (!exists) {
          await createAlert({ vehicleId: s.vehicleId, alertType: "LowMileageEfficiency", message: msg, status: "Nueva", severity: "Medium", actorUserId });
          created++;
        }
      }
    }

    // 3) Costos de mantenimiento altos en ventana de tiempo
    const start = new Date();
    start.setDate(start.getDate() - windowDays);
    const startStr = start.toISOString().split("T")[0];
    const maintCosts = await getMaintenanceCostSummary({ startDate: startStr });
    for (const c of maintCosts) {
      if (c.totalCost > highMaintThreshold) {
        const msg = `Costo de mantenimiento alto en ${windowDays} días (C$ ${c.totalCost.toFixed(2)} > C$ ${highMaintThreshold.toFixed(2)}).`;
        // Dedup dentro de la misma ventana de evaluación
        const exists = await existsSimilar(pool, c.vehicleId, "HighMaintenanceCost", { withinDays: windowDays, includeResolved: true });
        if (!exists) {
          await createAlert({ vehicleId: c.vehicleId, alertType: "HighMaintenanceCost", message: msg, status: "Nueva", severity: "High", actorUserId });
          created++;
        }
      }
    }

    revalidatePath("/alerts");
    revalidatePath("/dashboard");
    return { success: true, created, message: `Generación completada. Nuevas alertas: ${created}.` };
  } catch (err) {
    console.error("[Alert Actions] generateAlerts error:", err);
    return { success: false, created, message: (err as Error).message };
  }
}

// Check for existing similar alert, optionally within a recent time window, and
// optionally including resolved ones. If dueDate is provided, use it as part of
// the uniqueness key; otherwise use createdAt within 'withinDays' when provided.
async function existsSimilar(
  pool: sql.ConnectionPool,
  vehicleId: string,
  alertType: string,
  opts: { dueDate?: string; withinDays?: number; includeResolved?: boolean } = { includeResolved: true }
) {
  const req = pool.request();
  req.input("vehicleId", sql.NVarChar(50), vehicleId);
  req.input("alertType", sql.NVarChar(100), alertType);
  let where = "a.vehicleId = @vehicleId AND a.alertType = @alertType";
  if (opts.dueDate) {
    req.input("dueDate", sql.Date, opts.dueDate);
    where += " AND (a.dueDate = @dueDate OR a.dueDate IS NULL)";
  }
  if (opts.withinDays && opts.withinDays > 0) {
    req.input("days", sql.Int, opts.withinDays);
    where += " AND a.createdAt >= DATEADD(day, -@days, GETDATE())";
  }
  if (opts.includeResolved === false) {
    where += " AND a.status <> N'Resuelta'";
  }
  const result = await req.query(`
    SELECT TOP 1 a.id FROM alerts a WHERE ${where};
  `);
  return result.recordset.length > 0;
}

async function loadAlertThresholds(pool: sql.ConnectionPool) {
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
    if (!res.recordset.length) return {} as any;
    const r = res.recordset[0];
    return {
      daysThreshold: r.daysThreshold != null ? Number(r.daysThreshold) : undefined,
      mileageThreshold: r.mileageThreshold != null ? Number(r.mileageThreshold) : undefined,
      lowEfficiencyThresholdKmPerGallon: r.lowEfficiencyThresholdKmPerGallon != null ? Number(r.lowEfficiencyThresholdKmPerGallon) : undefined,
      highMaintenanceCostThreshold: r.highMaintenanceCostThreshold != null ? Number(r.highMaintenanceCostThreshold) : undefined,
      maintenanceCostWindowDays: r.maintenanceCostWindowDays != null ? Number(r.maintenanceCostWindowDays) : undefined,
    };
  } catch {
    return {} as any;
  }
}
