"use server";

import { getDbClient } from "@/lib/db";
import sql from "mssql";

// Types returned by report actions
export type MaintenanceCostSummary = {
  vehicleId: string;
  plateNumber: string;
  brandModel: string;
  totalPreventiveCost: number;
  totalCorrectiveCost: number;
  totalCost: number;
  logCount: number;
};

export type OverallVehicleCostSummary = {
  vehicleId: string;
  plateNumber: string;
  brandModel: string;
  totalFuelingCost: number;
  fuelingLogCount: number;
  totalMaintenanceCost: number;
  maintenanceLogCount: number;
  grandTotalCost: number;
};

export type FuelConsumptionSummary = {
  vehicleId: string;
  plateNumber: string;
  brandModel: string;
  totalLiters: number;
  totalGallons: number;
  totalCost: number;
  avgEfficiency?: number; // km/gal
  logCount: number;
};

export type FuelEfficiencyStats = {
  vehicleId: string;
  plateNumber: string;
  brandModel: string;
  averageEfficiency?: number;
  minEfficiency?: number;
  maxEfficiency?: number;
  logCount: number;
};

export type UpcomingMaintenanceItem = {
  vehicleId: string;
  plateNumber: string;
  brand: string;
  model: string;
  nextPreventiveMaintenanceDate: string | null;
  nextPreventiveMaintenanceMileage: number | null;
  currentMileage: number;
  daysToNextMaintenance?: number;
  kmToNextMaintenance?: number;
  reason: "Fecha" | "Kilometraje" | "Ambos";
};

type ReportParams = { startDate?: string; endDate?: string; vehicleId?: string };

// Informe: Costos de mantenimiento por vehículo (con rango opcional)
export async function getMaintenanceCostSummary(params: ReportParams = {}): Promise<MaintenanceCostSummary[]> {
  const dbClient = await getDbClient();
  if (!dbClient) return [];
  if (dbClient.type !== "SQLServer") return [];
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  if (!pool) return [];

  const { startDate, endDate, vehicleId } = params;
  try {
    const request = pool.request();
  if (startDate) request.input("startDate", sql.Date, startDate);
  if (endDate) request.input("endDate", sql.Date, endDate);
  if (vehicleId) request.input("vehicleId", sql.NVarChar(50), vehicleId);

    const where: string[] = [];
    if (startDate) where.push("m.executionDate >= @startDate");
    if (endDate) where.push("m.executionDate <= @endDate");
  if (vehicleId) where.push("m.vehicleId = @vehicleId");
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const query = `
      SELECT 
        m.vehicleId,
        MAX(m.vehiclePlateNumber) AS plateNumber,
        MAX(v.brand) AS brand,
        MAX(v.model) AS model,
        SUM(CASE WHEN m.maintenanceType = N'Preventivo' THEN m.cost ELSE 0 END) AS totalPreventiveCost,
        SUM(CASE WHEN m.maintenanceType = N'Correctivo' THEN m.cost ELSE 0 END) AS totalCorrectiveCost,
        COUNT(1) AS logCount
      FROM maintenance_logs m
      INNER JOIN vehicles v ON v.id = m.vehicleId
      ${whereClause}
      GROUP BY m.vehicleId
      ORDER BY MAX(v.plateNumber)
    `;
    const result = await request.query(query);
    return result.recordset.map((row: any) => {
      const totalPreventive = parseFloat(row.totalPreventiveCost ?? 0);
      const totalCorrective = parseFloat(row.totalCorrectiveCost ?? 0);
      return {
        vehicleId: row.vehicleId?.toString?.() ?? String(row.vehicleId),
        plateNumber: row.plateNumber,
        brandModel: `${row.brand} ${row.model}`.trim(),
        totalPreventiveCost: totalPreventive,
        totalCorrectiveCost: totalCorrective,
        totalCost: totalPreventive + totalCorrective,
        logCount: Number(row.logCount) || 0,
      };
    }) as MaintenanceCostSummary[];
  } catch (err) {
    console.error("[Report] getMaintenanceCostSummary error:", err);
    return [];
  }
}

// Informe: Costos generales (combustible + mantenimiento) por vehículo
export async function getOverallVehicleCostsSummary(params: ReportParams = {}): Promise<OverallVehicleCostSummary[]> {
  const dbClient = await getDbClient();
  if (!dbClient) return [];
  if (dbClient.type !== "SQLServer") return [];
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  if (!pool) return [];

  const { startDate, endDate, vehicleId } = params;
  try {
    const request = pool.request();
  if (startDate) request.input("startDate", sql.Date, startDate);
  if (endDate) request.input("endDate", sql.Date, endDate);
  if (vehicleId) request.input("vehicleId", sql.NVarChar(50), vehicleId);

    const maintWhere: string[] = [];
    const fuelWhere: string[] = [];
    if (startDate) {
      maintWhere.push("executionDate >= @startDate");
      fuelWhere.push("fuelingDate >= @startDate");
    }
    if (endDate) {
      maintWhere.push("executionDate <= @endDate");
      fuelWhere.push("fuelingDate <= @endDate");
    }
    if (vehicleId) {
      maintWhere.push("vehicleId = @vehicleId");
      fuelWhere.push("vehicleId = @vehicleId");
    }
    const maintWhereClause = maintWhere.length ? `WHERE ${maintWhere.join(" AND ")}` : "";
    const fuelWhereClause = fuelWhere.length ? `WHERE ${fuelWhere.join(" AND ")}` : "";

    const query = `
      WITH maint AS (
        SELECT vehicleId, SUM(cost) AS totalMaintenanceCost, COUNT(1) AS maintenanceLogCount
        FROM maintenance_logs
        ${maintWhereClause}
        GROUP BY vehicleId
      ), fuel AS (
        SELECT vehicleId, SUM(totalCost) AS totalFuelingCost, COUNT(1) AS fuelingLogCount
        FROM fueling_logs
        ${fuelWhereClause}
        GROUP BY vehicleId
      )
      SELECT 
        v.id AS vehicleId,
        v.plateNumber,
        v.brand,
        v.model,
        ISNULL(m.totalMaintenanceCost, 0) AS totalMaintenanceCost,
        ISNULL(m.maintenanceLogCount, 0) AS maintenanceLogCount,
        ISNULL(f.totalFuelingCost, 0) AS totalFuelingCost,
        ISNULL(f.fuelingLogCount, 0) AS fuelingLogCount
  FROM vehicles v
  LEFT JOIN maint m ON m.vehicleId = v.id
  LEFT JOIN fuel f ON f.vehicleId = v.id
  ORDER BY v.createdAt DESC
    `;

    const result = await request.query(query);
    return result.recordset.map((row: any) => {
      const totalFuel = parseFloat(row.totalFuelingCost ?? 0);
      const totalMaint = parseFloat(row.totalMaintenanceCost ?? 0);
      return {
        vehicleId: row.vehicleId?.toString?.() ?? String(row.vehicleId),
        plateNumber: row.plateNumber,
        brandModel: `${row.brand} ${row.model}`.trim(),
        totalFuelingCost: totalFuel,
        fuelingLogCount: Number(row.fuelingLogCount) || 0,
        totalMaintenanceCost: totalMaint,
        maintenanceLogCount: Number(row.maintenanceLogCount) || 0,
        grandTotalCost: totalFuel + totalMaint,
      };
    }) as OverallVehicleCostSummary[];
  } catch (err) {
    console.error("[Report] getOverallVehicleCostsSummary error:", err);
    return [];
  }
}

// Informe: Consumo de combustible por vehículo
export async function getFuelConsumptionSummary(params: ReportParams = {}): Promise<FuelConsumptionSummary[]> {
  const dbClient = await getDbClient();
  if (!dbClient) return [];
  if (dbClient.type !== "SQLServer") return [];
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  if (!pool) return [];

  const { startDate, endDate, vehicleId } = params;
  try {
    const request = pool.request();
  if (startDate) request.input("startDate", sql.Date, startDate);
  if (endDate) request.input("endDate", sql.Date, endDate);
  if (vehicleId) request.input("vehicleId", sql.NVarChar(50), vehicleId);

    const where: string[] = [];
    if (startDate) where.push("f.fuelingDate >= @startDate");
    if (endDate) where.push("f.fuelingDate <= @endDate");
  if (vehicleId) where.push("f.vehicleId = @vehicleId");
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const query = `
      SELECT 
        v.id AS vehicleId,
        v.plateNumber,
        v.brand,
        v.model,
        SUM(f.quantityLiters) AS totalLiters,
        SUM(f.totalCost) AS totalCost,
        AVG(CASE WHEN f.fuelEfficiencyKmPerGallon IS NOT NULL THEN f.fuelEfficiencyKmPerGallon END) AS avgEfficiency,
        COUNT(1) AS logCount
      FROM vehicles v
      INNER JOIN fueling_logs f ON f.vehicleId = v.id
      ${whereClause}
  GROUP BY v.id, v.plateNumber, v.brand, v.model
  ORDER BY MAX(v.createdAt) DESC
    `;

    const result = await request.query(query);
    const LITERS_PER_GALLON = 3.78541;
    return result.recordset.map((row: any) => {
      const liters = parseFloat(row.totalLiters ?? 0);
      const gallons = liters / LITERS_PER_GALLON;
      return {
        vehicleId: row.vehicleId?.toString?.() ?? String(row.vehicleId),
        plateNumber: row.plateNumber,
        brandModel: `${row.brand} ${row.model}`.trim(),
        totalLiters: liters,
        totalGallons: gallons,
        totalCost: parseFloat(row.totalCost ?? 0),
        avgEfficiency: row.avgEfficiency != null ? parseFloat(row.avgEfficiency) : undefined,
        logCount: Number(row.logCount) || 0,
      };
    }) as FuelConsumptionSummary[];
  } catch (err) {
    console.error("[Report] getFuelConsumptionSummary error:", err);
    return [];
  }
}

// Informe: Estadísticas de eficiencia por vehículo
export async function getFuelEfficiencyStats(params: ReportParams = {}): Promise<FuelEfficiencyStats[]> {
  const dbClient = await getDbClient();
  if (!dbClient) return [];
  if (dbClient.type !== "SQLServer") return [];
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  if (!pool) return [];

  const { startDate, endDate, vehicleId } = params;
  try {
    const request = pool.request();
  if (startDate) request.input("startDate", sql.Date, startDate);
  if (endDate) request.input("endDate", sql.Date, endDate);
  if (vehicleId) request.input("vehicleId", sql.NVarChar(50), vehicleId);

    const where: string[] = [
      "f.fuelEfficiencyKmPerGallon IS NOT NULL"
    ];
    if (startDate) where.push("f.fuelingDate >= @startDate");
    if (endDate) where.push("f.fuelingDate <= @endDate");
  if (vehicleId) where.push("f.vehicleId = @vehicleId");
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const query = `
      SELECT 
        v.id AS vehicleId,
        v.plateNumber,
        v.brand,
        v.model,
        AVG(f.fuelEfficiencyKmPerGallon) AS averageEfficiency,
        MIN(f.fuelEfficiencyKmPerGallon) AS minEfficiency,
        MAX(f.fuelEfficiencyKmPerGallon) AS maxEfficiency,
        COUNT(1) AS logCount
      FROM vehicles v
      INNER JOIN fueling_logs f ON f.vehicleId = v.id
      ${whereClause}
  GROUP BY v.id, v.plateNumber, v.brand, v.model
  ORDER BY MAX(v.createdAt) DESC
    `;
    const result = await request.query(query);
    return result.recordset.map((row: any) => ({
      vehicleId: row.vehicleId?.toString?.() ?? String(row.vehicleId),
      plateNumber: row.plateNumber,
      brandModel: `${row.brand} ${row.model}`.trim(),
      averageEfficiency: row.averageEfficiency != null ? parseFloat(row.averageEfficiency) : undefined,
      minEfficiency: row.minEfficiency != null ? parseFloat(row.minEfficiency) : undefined,
      maxEfficiency: row.maxEfficiency != null ? parseFloat(row.maxEfficiency) : undefined,
      logCount: Number(row.logCount) || 0,
    }));
  } catch (err) {
    console.error("[Report] getFuelEfficiencyStats error:", err);
    return [];
  }
}

// Informe: Próximo mantenimiento (por fecha o kilometraje)
export async function getUpcomingMaintenance(
  options: { daysThreshold?: number; mileageThreshold?: number; vehicleId?: string } = {}
): Promise<UpcomingMaintenanceItem[]> {
  const dbClient = await getDbClient();
  if (!dbClient) return [];
  if (dbClient.type !== "SQLServer") return [];
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  if (!pool) return [];

  const daysThreshold = options.daysThreshold ?? 30;
  const mileageThreshold = options.mileageThreshold ?? 2000;
  const vehicleId = options.vehicleId;

  try {
  const request = pool.request();
    request.input("daysThreshold", sql.Int, daysThreshold);
    request.input("mileageThreshold", sql.Int, mileageThreshold);
  if (vehicleId) request.input("vehicleId", sql.NVarChar(50), vehicleId);

    const query = `
      SELECT 
        v.id AS vehicleId,
        v.plateNumber,
        v.brand,
        v.model,
        v.currentMileage,
        v.nextPreventiveMaintenanceDate,
        v.nextPreventiveMaintenanceMileage,
        CASE 
          WHEN v.nextPreventiveMaintenanceDate IS NULL THEN NULL
          ELSE DATEDIFF(DAY, CAST(GETDATE() AS DATE), v.nextPreventiveMaintenanceDate)
        END AS daysToNextMaintenance,
        CASE 
          WHEN v.nextPreventiveMaintenanceMileage IS NULL THEN NULL
          ELSE v.nextPreventiveMaintenanceMileage - v.currentMileage
        END AS kmToNextMaintenance
      FROM vehicles v
      ${vehicleId ? "WHERE v.id = @vehicleId" : ""}
    `;

    const result = await request.query(query);

    // Filter and map in JS because SQL conditional filters with NULLs can be tricky here
    const rows = result.recordset as any[];
    const filtered = rows
      .map((row) => {
        const days = row.daysToNextMaintenance as number | null;
        const kmLeft = row.kmToNextMaintenance as number | null;
        const byDate = days != null && days >= 0 && days <= daysThreshold;
        const byMileage = kmLeft != null && kmLeft >= 0 && kmLeft <= mileageThreshold;

        if (!byDate && !byMileage) return null;
        const reason = byDate && byMileage ? "Ambos" : byDate ? "Fecha" : "Kilometraje";
        return {
          vehicleId: row.vehicleId?.toString?.() ?? String(row.vehicleId),
          plateNumber: row.plateNumber,
          brand: row.brand,
          model: row.model,
          currentMileage: row.currentMileage,
          nextPreventiveMaintenanceDate: row.nextPreventiveMaintenanceDate
            ? new Date(row.nextPreventiveMaintenanceDate).toISOString().split("T")[0]
            : null,
          nextPreventiveMaintenanceMileage: row.nextPreventiveMaintenanceMileage,
          daysToNextMaintenance: row.daysToNextMaintenance ?? undefined,
          kmToNextMaintenance: row.kmToNextMaintenance ?? undefined,
          reason,
        } as UpcomingMaintenanceItem;
      })
      .filter(Boolean) as UpcomingMaintenanceItem[];

    // Sort by urgency (days asc then km asc)
    filtered.sort((a, b) => {
      const aScore = Math.min(a.daysToNextMaintenance ?? Number.POSITIVE_INFINITY, (a.kmToNextMaintenance ?? Number.POSITIVE_INFINITY) / 50);
      const bScore = Math.min(b.daysToNextMaintenance ?? Number.POSITIVE_INFINITY, (b.kmToNextMaintenance ?? Number.POSITIVE_INFINITY) / 50);
      return aScore - bScore;
    });
    return filtered;
  } catch (err) {
    console.error("[Report] getUpcomingMaintenance error:", err);
    return [];
  }
}

// -------- Comparative Expense Analysis --------
export type ComparativeVehicleBreakdown = {
  vehicleId: string;
  plateNumber: string;
  brandModel: string;
  maintenanceCost: number;
  fuelingCost: number;
  totalCost: number;
  kmDriven: number | null;
};

export type ComparativeExpenseSummary = {
  totalMaintenanceCost: number;
  totalFuelingCost: number;
  totalOverallCost: number;
  totalGallonsConsumed: number;
  maintenanceLogCount: number;
  fuelingLogCount: number;
  kmDrivenInPeriod: number | null;
  costPerKm: number | null;
  avgFuelEfficiency: number | null; // km/gal
  vehicleBreakdown: ComparativeVehicleBreakdown[];
};

export async function getComparativeExpenseSummary(params: ReportParams = {}): Promise<ComparativeExpenseSummary> {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== "SQLServer") {
    return {
      totalMaintenanceCost: 0,
      totalFuelingCost: 0,
      totalOverallCost: 0,
      totalGallonsConsumed: 0,
      maintenanceLogCount: 0,
      fuelingLogCount: 0,
      kmDrivenInPeriod: null,
      costPerKm: null,
      avgFuelEfficiency: null,
      vehicleBreakdown: [],
    };
  }
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  if (!pool) {
    return {
      totalMaintenanceCost: 0,
      totalFuelingCost: 0,
      totalOverallCost: 0,
      totalGallonsConsumed: 0,
      maintenanceLogCount: 0,
      fuelingLogCount: 0,
      kmDrivenInPeriod: null,
      costPerKm: null,
      avgFuelEfficiency: null,
      vehicleBreakdown: [],
    };
  }
  const { startDate, endDate, vehicleId } = params;
  try {
    const request = pool.request();
    if (startDate) request.input("startDate", sql.Date, startDate);
    if (endDate) request.input("endDate", sql.Date, endDate);
    if (vehicleId) request.input("vehicleId", sql.NVarChar(50), vehicleId);

    const maintWhere: string[] = [];
    const fuelWhere: string[] = [];
    if (startDate) {
      maintWhere.push("executionDate >= @startDate");
      fuelWhere.push("fuelingDate >= @startDate");
    }
    if (endDate) {
      maintWhere.push("executionDate <= @endDate");
      fuelWhere.push("fuelingDate <= @endDate");
    }
    if (vehicleId) {
      maintWhere.push("vehicleId = @vehicleId");
      fuelWhere.push("vehicleId = @vehicleId");
    }
    const maintWhereClause = maintWhere.length ? `WHERE ${maintWhere.join(" AND ")}` : "";
    const fuelWhereClause = fuelWhere.length ? `WHERE ${fuelWhere.join(" AND ")}` : "";

    const query = `
      WITH maint AS (
        SELECT vehicleId, SUM(cost) AS maintenanceCost, COUNT(1) AS maintenanceLogCount
        FROM maintenance_logs
        ${maintWhereClause}
        GROUP BY vehicleId
      ), fuel AS (
        SELECT vehicleId, SUM(totalCost) AS fuelingCost, COUNT(1) AS fuelingLogCount, SUM(quantityLiters) AS totalLiters
        FROM fueling_logs
        ${fuelWhereClause}
        GROUP BY vehicleId
      ), mileage AS (
        SELECT vehicleId,
               MIN(mileage) AS minMileage,
               MAX(mileage) AS maxMileage,
               COUNT(1) AS points
        FROM (
          SELECT vehicleId, executionDate AS d, mileageAtService AS mileage
          FROM maintenance_logs
          ${maintWhereClause}
          UNION ALL
          SELECT vehicleId, fuelingDate AS d, mileageAtFueling AS mileage
          FROM fueling_logs
          ${fuelWhereClause}
        ) x
        WHERE mileage IS NOT NULL
        GROUP BY vehicleId
      )
      SELECT 
        v.id AS vehicleId,
        v.plateNumber,
        v.brand,
        v.model,
        ISNULL(m.maintenanceCost,0) AS maintenanceCost,
        ISNULL(m.maintenanceLogCount,0) AS maintenanceLogCount,
        ISNULL(f.fuelingCost,0) AS fuelingCost,
        ISNULL(f.fuelingLogCount,0) AS fuelingLogCount,
        ISNULL(f.totalLiters,0) AS totalLiters,
        CASE WHEN mi.points >= 2 THEN (mi.maxMileage - mi.minMileage) ELSE NULL END AS kmDriven
  FROM vehicles v
  LEFT JOIN maint m ON m.vehicleId = v.id
  LEFT JOIN fuel f ON f.vehicleId = v.id
  LEFT JOIN mileage mi ON mi.vehicleId = v.id
  ${vehicleId ? "WHERE v.id = @vehicleId" : ""}
  ORDER BY v.createdAt DESC
    `;

    const result = await request.query(query);
    const rows: any[] = result.recordset || [];

    const LITERS_PER_GALLON = 3.78541;
    const breakdown: ComparativeVehicleBreakdown[] = rows
      .map((row) => {
        const maintenanceCost = parseFloat(row.maintenanceCost ?? 0);
        const fuelingCost = parseFloat(row.fuelingCost ?? 0);
        const totalCost = maintenanceCost + fuelingCost;
        const kmDriven = row.kmDriven != null ? Number(row.kmDriven) : null;
        return {
          vehicleId: row.vehicleId?.toString?.() ?? String(row.vehicleId),
          plateNumber: row.plateNumber,
          brandModel: `${row.brand} ${row.model}`.trim(),
          maintenanceCost,
          fuelingCost,
          totalCost,
          kmDriven,
        };
      })
      // Mostrar sólo si hay algún costo o km estimado; se puede ajustar según preferencia
      .filter((v) => v.totalCost > 0 || (v.kmDriven != null && v.kmDriven > 0));

    const totalMaintenanceCost = breakdown.reduce((s, v) => s + v.maintenanceCost, 0);
    const totalFuelingCost = breakdown.reduce((s, v) => s + v.fuelingCost, 0);
    const totalOverallCost = totalMaintenanceCost + totalFuelingCost;

    const totalLiters = rows.reduce((s, r) => s + parseFloat(r.totalLiters ?? 0), 0);
    const totalGallonsConsumed = totalLiters / LITERS_PER_GALLON;

    const maintenanceLogCount = rows.reduce((s, r) => s + Number(r.maintenanceLogCount || 0), 0);
    const fuelingLogCount = rows.reduce((s, r) => s + Number(r.fuelingLogCount || 0), 0);

    const kmDrivenInPeriodRaw = breakdown.reduce((s, v) => s + (v.kmDriven || 0), 0);
    const kmDrivenInPeriod = kmDrivenInPeriodRaw > 0 ? kmDrivenInPeriodRaw : null;

    const costPerKm = kmDrivenInPeriod && totalOverallCost > 0 ? totalOverallCost / kmDrivenInPeriod : null;
    const avgFuelEfficiency = kmDrivenInPeriod && totalGallonsConsumed > 0 ? kmDrivenInPeriod / totalGallonsConsumed : null;

    return {
      totalMaintenanceCost,
      totalFuelingCost,
      totalOverallCost,
      totalGallonsConsumed,
      maintenanceLogCount,
      fuelingLogCount,
      kmDrivenInPeriod,
      costPerKm,
      avgFuelEfficiency,
      vehicleBreakdown: breakdown,
    };
  } catch (err) {
    console.error("[Report] getComparativeExpenseSummary error:", err);
    return {
      totalMaintenanceCost: 0,
      totalFuelingCost: 0,
      totalOverallCost: 0,
      totalGallonsConsumed: 0,
      maintenanceLogCount: 0,
      fuelingLogCount: 0,
      kmDrivenInPeriod: null,
      costPerKm: null,
      avgFuelEfficiency: null,
      vehicleBreakdown: [],
    };
  }
}

// -------- Period-over-Period (PoP) Summary --------
export type PeriodOverPeriodRow = {
  vehicleId: string;
  plateNumber: string;
  brandModel: string;
  // Current period
  currentFuelCost: number;
  currentMaintenanceCost: number;
  currentOverallCost: number;
  currentLiters: number;
  currentGallons: number;
  currentFuelLogs: number;
  currentMaintLogs: number;
  // Previous comparable period
  prevFuelCost: number;
  prevMaintenanceCost: number;
  prevOverallCost: number;
  prevLiters: number;
  prevGallons: number;
  prevFuelLogs: number;
  prevMaintLogs: number;
  // Deltas
  deltaFuelCost: number;
  deltaMaintenanceCost: number;
  deltaOverallCost: number;
  deltaGallons: number;
  deltaFuelLogs: number;
  deltaMaintLogs: number;
  // Percentages (null when baseline is 0)
  pctFuelCost: number | null;
  pctMaintenanceCost: number | null;
  pctOverallCost: number | null;
  pctGallons: number | null;
};

export type PeriodOverPeriodSummary = {
  rows: PeriodOverPeriodRow[];
  totals: {
    currentFuelCost: number;
    currentMaintenanceCost: number;
    currentOverallCost: number;
    currentGallons: number;
    prevFuelCost: number;
    prevMaintenanceCost: number;
    prevOverallCost: number;
    prevGallons: number;
    deltaFuelCost: number;
    deltaMaintenanceCost: number;
    deltaOverallCost: number;
    deltaGallons: number;
    pctFuelCost: number | null;
    pctMaintenanceCost: number | null;
    pctOverallCost: number | null;
    pctGallons: number | null;
  };
  meta: {
    startDate: string | null;
    endDate: string | null;
    prevStartDate: string | null;
    prevEndDate: string | null;
  };
};

// Helper to compute a previous period given start/end.
function getPreviousPeriod(start?: string, end?: string): { prevStart?: string; prevEnd?: string } {
  if (!start || !end) return {};
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const DAY_MS = 24 * 3600 * 1000;
  const startD = new Date(start + "T00:00:00Z");
  const endD = new Date(end + "T00:00:00Z");

  // If the selected range is an exact calendar month (1st to last day of that month),
  // compare against the full previous month (1st to last day), not just an equal-length window.
  const sameMonth = startD.getUTCFullYear() === endD.getUTCFullYear() && startD.getUTCMonth() === endD.getUTCMonth();
  const isStartFirstOfMonth = startD.getUTCDate() === 1;
  const lastDayOfThisMonth = new Date(Date.UTC(endD.getUTCFullYear(), endD.getUTCMonth() + 1, 0));
  const isEndLastOfMonth = endD.getUTCDate() === lastDayOfThisMonth.getUTCDate();
  if (sameMonth && isStartFirstOfMonth && isEndLastOfMonth) {
    const prevMonthEnd = new Date(Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth(), 0)); // last day of previous month
    const prevMonthStart = new Date(Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth() - 1, 1));
    return { prevStart: iso(prevMonthStart), prevEnd: iso(prevMonthEnd) };
  }

  // If the selected range is the full calendar year, compare against the full previous year.
  const isFullYear = startD.getUTCMonth() === 0 && startD.getUTCDate() === 1 && endD.getUTCMonth() === 11 && endD.getUTCDate() === 31 && startD.getUTCFullYear() === endD.getUTCFullYear();
  if (isFullYear) {
    const prevYear = startD.getUTCFullYear() - 1;
    const prevStart = new Date(Date.UTC(prevYear, 0, 1));
    const prevEnd = new Date(Date.UTC(prevYear, 11, 31));
    return { prevStart: iso(prevStart), prevEnd: iso(prevEnd) };
  }

  // Default: equal-length inclusive window immediately before the current period
  const diffDays = Math.round((endD.getTime() - startD.getTime()) / DAY_MS);
  const prevEnd = new Date(startD.getTime() - DAY_MS);
  const prevStart = new Date(prevEnd.getTime() - diffDays * DAY_MS);
  return { prevStart: iso(prevStart), prevEnd: iso(prevEnd) };
}

export async function getPeriodOverPeriodSummary(params: ReportParams = {}): Promise<PeriodOverPeriodSummary> {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== "SQLServer") {
    return { rows: [], totals: {
      currentFuelCost: 0, currentMaintenanceCost: 0, currentOverallCost: 0, currentGallons: 0,
      prevFuelCost: 0, prevMaintenanceCost: 0, prevOverallCost: 0, prevGallons: 0,
      deltaFuelCost: 0, deltaMaintenanceCost: 0, deltaOverallCost: 0, deltaGallons: 0,
      pctFuelCost: null, pctMaintenanceCost: null, pctOverallCost: null, pctGallons: null,
    }, meta: { startDate: null, endDate: null, prevStartDate: null, prevEndDate: null } };
  }
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  if (!pool) {
    return { rows: [], totals: {
      currentFuelCost: 0, currentMaintenanceCost: 0, currentOverallCost: 0, currentGallons: 0,
      prevFuelCost: 0, prevMaintenanceCost: 0, prevOverallCost: 0, prevGallons: 0,
      deltaFuelCost: 0, deltaMaintenanceCost: 0, deltaOverallCost: 0, deltaGallons: 0,
      pctFuelCost: null, pctMaintenanceCost: null, pctOverallCost: null, pctGallons: null,
    }, meta: { startDate: null, endDate: null, prevStartDate: null, prevEndDate: null } };
  }

  const { startDate, endDate, vehicleId } = params;
  const { prevStart, prevEnd } = getPreviousPeriod(startDate, endDate);

  try {
    const request = pool.request();
    if (startDate) request.input("startDate", sql.Date, startDate);
    if (endDate) request.input("endDate", sql.Date, endDate);
    if (prevStart) request.input("prevStart", sql.Date, prevStart);
    if (prevEnd) request.input("prevEnd", sql.Date, prevEnd);
    if (vehicleId) request.input("vehicleId", sql.NVarChar(50), vehicleId);

  // We'll apply the vehicle filter after the JOINs to keep valid SQL syntax

    const currMaintWhere: string[] = [];
    const currFuelWhere: string[] = [];
    const prevMaintWhere: string[] = [];
    const prevFuelWhere: string[] = [];
    if (startDate) { currMaintWhere.push("executionDate >= @startDate"); currFuelWhere.push("fuelingDate >= @startDate"); }
    if (endDate) { currMaintWhere.push("executionDate <= @endDate"); currFuelWhere.push("fuelingDate <= @endDate"); }
    if (prevStart) { prevMaintWhere.push("executionDate >= @prevStart"); prevFuelWhere.push("fuelingDate >= @prevStart"); }
    if (prevEnd) { prevMaintWhere.push("executionDate <= @prevEnd"); prevFuelWhere.push("fuelingDate <= @prevEnd"); }
    if (vehicleId) { currMaintWhere.push("vehicleId = @vehicleId"); currFuelWhere.push("vehicleId = @vehicleId"); prevMaintWhere.push("vehicleId = @vehicleId"); prevFuelWhere.push("vehicleId = @vehicleId"); }

    const currMaintWC = currMaintWhere.length ? `WHERE ${currMaintWhere.join(" AND ")}` : "";
    const currFuelWC = currFuelWhere.length ? `WHERE ${currFuelWhere.join(" AND ")}` : "";
    const prevMaintWC = prevMaintWhere.length ? `WHERE ${prevMaintWhere.join(" AND ")}` : "";
    const prevFuelWC = prevFuelWhere.length ? `WHERE ${prevFuelWhere.join(" AND ")}` : "";

    const query = `
      WITH curr_m AS (
        SELECT vehicleId, SUM(cost) AS maintenanceCost, COUNT(1) AS maintLogs
        FROM maintenance_logs
        ${currMaintWC}
        GROUP BY vehicleId
      ), curr_f AS (
        SELECT vehicleId, SUM(totalCost) AS fuelCost, SUM(quantityLiters) AS liters, COUNT(1) AS fuelLogs
        FROM fueling_logs
        ${currFuelWC}
        GROUP BY vehicleId
      ), prev_m AS (
        SELECT vehicleId, SUM(cost) AS maintenanceCost, COUNT(1) AS maintLogs
        FROM maintenance_logs
        ${prevMaintWC}
        GROUP BY vehicleId
      ), prev_f AS (
        SELECT vehicleId, SUM(totalCost) AS fuelCost, SUM(quantityLiters) AS liters, COUNT(1) AS fuelLogs
        FROM fueling_logs
        ${prevFuelWC}
        GROUP BY vehicleId
      )
      SELECT 
        v.id AS vehicleId,
        v.plateNumber,
        v.brand,
        v.model,
        ISNULL(cm.fuelCost,0) AS currentFuelCost,
        ISNULL(cm.liters,0) AS currentLiters,
        ISNULL(cm.fuelLogs,0) AS currentFuelLogs,
        ISNULL(pm.fuelCost,0) AS prevFuelCost,
        ISNULL(pm.liters,0) AS prevLiters,
        ISNULL(pm.fuelLogs,0) AS prevFuelLogs,
        ISNULL(cmm.maintenanceCost,0) AS currentMaintenanceCost,
        ISNULL(cmm.maintLogs,0) AS currentMaintLogs,
        ISNULL(pmm.maintenanceCost,0) AS prevMaintenanceCost,
        ISNULL(pmm.maintLogs,0) AS prevMaintLogs
      FROM vehicles v
      LEFT JOIN curr_f cm ON cm.vehicleId = v.id
      LEFT JOIN prev_f pm ON pm.vehicleId = v.id
      LEFT JOIN curr_m cmm ON cmm.vehicleId = v.id
      LEFT JOIN prev_m pmm ON pmm.vehicleId = v.id
      ${vehicleId ? "WHERE v.id = @vehicleId" : ""}
      ORDER BY v.createdAt DESC
    `;

    const result = await request.query(query);
    const rows = (result.recordset || []).map((r: any) => {
      const LITERS_PER_GALLON = 3.78541;
      const currentGallons = parseFloat(r.currentLiters ?? 0) / LITERS_PER_GALLON;
      const prevGallons = parseFloat(r.prevLiters ?? 0) / LITERS_PER_GALLON;
      const currentFuelCost = parseFloat(r.currentFuelCost ?? 0);
      const prevFuelCost = parseFloat(r.prevFuelCost ?? 0);
      const currentMaintenanceCost = parseFloat(r.currentMaintenanceCost ?? 0);
      const prevMaintenanceCost = parseFloat(r.prevMaintenanceCost ?? 0);
      const currentOverallCost = currentFuelCost + currentMaintenanceCost;
      const prevOverallCost = prevFuelCost + prevMaintenanceCost;

      const deltaFuelCost = currentFuelCost - prevFuelCost;
      const deltaMaintenanceCost = currentMaintenanceCost - prevMaintenanceCost;
      const deltaOverallCost = currentOverallCost - prevOverallCost;
      const deltaGallons = currentGallons - prevGallons;
      const deltaFuelLogs = (Number(r.currentFuelLogs||0)) - (Number(r.prevFuelLogs||0));
      const deltaMaintLogs = (Number(r.currentMaintLogs||0)) - (Number(r.prevMaintLogs||0));

      const pct = (curr: number, prev: number): number | null => {
        if (!prev || prev === 0) return null;
        return (curr - prev) / prev;
      };

      return {
        vehicleId: r.vehicleId?.toString?.() ?? String(r.vehicleId),
        plateNumber: r.plateNumber,
        brandModel: `${r.brand} ${r.model}`.trim(),
        currentFuelCost,
        currentMaintenanceCost,
        currentOverallCost,
        currentLiters: parseFloat(r.currentLiters ?? 0),
        currentGallons,
        currentFuelLogs: Number(r.currentFuelLogs || 0),
        currentMaintLogs: Number(r.currentMaintLogs || 0),
        prevFuelCost,
        prevMaintenanceCost,
        prevOverallCost,
        prevLiters: parseFloat(r.prevLiters ?? 0),
        prevGallons,
        prevFuelLogs: Number(r.prevFuelLogs || 0),
        prevMaintLogs: Number(r.prevMaintLogs || 0),
        deltaFuelCost,
        deltaMaintenanceCost,
        deltaOverallCost,
        deltaGallons,
        deltaFuelLogs,
        deltaMaintLogs,
        pctFuelCost: pct(currentFuelCost, prevFuelCost),
        pctMaintenanceCost: pct(currentMaintenanceCost, prevMaintenanceCost),
        pctOverallCost: pct(currentOverallCost, prevOverallCost),
        pctGallons: pct(currentGallons, prevGallons),
      } as PeriodOverPeriodRow;
    });

    // Aggregate totals
    const totals = rows.reduce((acc, r) => {
      acc.currentFuelCost += r.currentFuelCost;
      acc.currentMaintenanceCost += r.currentMaintenanceCost;
      acc.currentOverallCost += r.currentOverallCost;
      acc.currentGallons += r.currentGallons;
      acc.prevFuelCost += r.prevFuelCost;
      acc.prevMaintenanceCost += r.prevMaintenanceCost;
      acc.prevOverallCost += r.prevOverallCost;
      acc.prevGallons += r.prevGallons;
      acc.deltaFuelCost += r.deltaFuelCost;
      acc.deltaMaintenanceCost += r.deltaMaintenanceCost;
      acc.deltaOverallCost += r.deltaOverallCost;
      acc.deltaGallons += r.deltaGallons;
      return acc;
    }, {
      currentFuelCost: 0, currentMaintenanceCost: 0, currentOverallCost: 0, currentGallons: 0,
      prevFuelCost: 0, prevMaintenanceCost: 0, prevOverallCost: 0, prevGallons: 0,
      deltaFuelCost: 0, deltaMaintenanceCost: 0, deltaOverallCost: 0, deltaGallons: 0
    } as any);

    const pct = (curr: number, prev: number): number | null => (prev ? (curr - prev) / prev : null);
    const summary: PeriodOverPeriodSummary = {
      rows: (vehicleId
        ? rows // when a specific vehicle is requested, keep the row even with zeros
        : rows.filter(r => r.currentFuelLogs + r.currentMaintLogs + r.prevFuelLogs + r.prevMaintLogs > 0)
      ),
      totals: {
        ...totals,
        pctFuelCost: pct(totals.currentFuelCost, totals.prevFuelCost),
        pctMaintenanceCost: pct(totals.currentMaintenanceCost, totals.prevMaintenanceCost),
        pctOverallCost: pct(totals.currentOverallCost, totals.prevOverallCost),
        pctGallons: pct(totals.currentGallons, totals.prevGallons),
      },
      meta: {
        startDate: startDate ?? null,
        endDate: endDate ?? null,
        prevStartDate: prevStart ?? null,
        prevEndDate: prevEnd ?? null,
      },
    };
    return summary;
  } catch (err) {
    console.error("[Report] getPeriodOverPeriodSummary error:", err);
    return { rows: [], totals: {
      currentFuelCost: 0, currentMaintenanceCost: 0, currentOverallCost: 0, currentGallons: 0,
      prevFuelCost: 0, prevMaintenanceCost: 0, prevOverallCost: 0, prevGallons: 0,
      deltaFuelCost: 0, deltaMaintenanceCost: 0, deltaOverallCost: 0, deltaGallons: 0,
      pctFuelCost: null, pctMaintenanceCost: null, pctOverallCost: null, pctGallons: null,
    }, meta: { startDate: startDate ?? null, endDate: endDate ?? null, prevStartDate: null, prevEndDate: null } };
  }
}

// -------- Monthly costs trend (last 6 months) --------
export type MonthlyTrendPoint = {
  year: number;
  month: number; // 1-12
  label: string; // e.g., 2025-09
  maintenanceCost: number;
  fuelingCost: number;
  totalCost: number;
  kmDriven: number | null;
  avgEfficiency: number | null; // km/gal average in month
  costPerKm: number | null;
};

export async function getMonthlyCostsTrend(params: { startDate?: string; endDate?: string; vehicleId?: string } = {}): Promise<MonthlyTrendPoint[]> {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== "SQLServer") return [];
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  if (!pool) return [];

  // Determine range: default to current month and previous 5 months (6 total)
  const now = new Date();
  const firstOfCurrent = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstOfStart = new Date(Date.UTC(firstOfCurrent.getUTCFullYear(), firstOfCurrent.getUTCMonth() - 5, 1));
  const startISO = (params.startDate ?? firstOfStart.toISOString().slice(0, 10));
  // End at last day of current month by default
  const lastOfCurrent = new Date(Date.UTC(firstOfCurrent.getUTCFullYear(), firstOfCurrent.getUTCMonth() + 1, 0));
  const endISO = (params.endDate ?? lastOfCurrent.toISOString().slice(0, 10));

  try {
    const request = pool.request();
    request.input("startDate", sql.Date, startISO);
    request.input("endDate", sql.Date, endISO);
    if (params.vehicleId) request.input("vehicleId", sql.NVarChar(50), params.vehicleId);

  const vehicleFilterMaint = params.vehicleId ? "AND m.vehicleId = @vehicleId" : "";
  const vehicleFilterFuel = params.vehicleId ? "AND f.vehicleId = @vehicleId" : "";
  const vehicleFilterUnionMaint = params.vehicleId ? "AND ml.vehicleId = @vehicleId" : "";
  const vehicleFilterUnionFuel = params.vehicleId ? "AND fl.vehicleId = @vehicleId" : "";

    const query = `
      WITH months AS (
        SELECT CAST(DATEFROMPARTS(YEAR(@startDate), MONTH(@startDate), 1) AS DATE) AS monthStart
        UNION ALL
        SELECT DATEADD(MONTH, 1, monthStart) FROM months
        WHERE monthStart <= CAST(DATEFROMPARTS(YEAR(@endDate), MONTH(@endDate), 1) AS DATE)
      ), maint AS (
        SELECT YEAR(m.executionDate) AS y, MONTH(m.executionDate) AS m, SUM(m.cost) AS maintenanceCost
        FROM maintenance_logs m
        WHERE m.executionDate >= @startDate AND m.executionDate <= @endDate
        ${vehicleFilterMaint}
        GROUP BY YEAR(m.executionDate), MONTH(m.executionDate)
      ), fuel AS (
        SELECT YEAR(f.fuelingDate) AS y, MONTH(f.fuelingDate) AS m, SUM(f.totalCost) AS fuelingCost,
               AVG(CASE WHEN f.fuelEfficiencyKmPerGallon IS NOT NULL THEN f.fuelEfficiencyKmPerGallon END) AS avgEfficiency
        FROM fueling_logs f
        WHERE f.fuelingDate >= @startDate AND f.fuelingDate <= @endDate
        ${vehicleFilterFuel}
        GROUP BY YEAR(f.fuelingDate), MONTH(f.fuelingDate)
      ), month_points AS (
        SELECT YEAR(p.d) AS y, MONTH(p.d) AS m, p.vehicleId, p.mileage
        FROM (
          SELECT ml.executionDate AS d, ml.vehicleId, ml.mileageAtService AS mileage
          FROM maintenance_logs ml
          WHERE ml.executionDate >= @startDate AND ml.executionDate <= @endDate ${vehicleFilterUnionMaint}
          UNION ALL
          SELECT fl.fuelingDate AS d, fl.vehicleId, fl.mileageAtFueling AS mileage
          FROM fueling_logs fl
          WHERE fl.fuelingDate >= @startDate AND fl.fuelingDate <= @endDate ${vehicleFilterUnionFuel}
        ) p
        WHERE p.mileage IS NOT NULL
      ), monthly_mileage AS (
        SELECT y, m, vehicleId, MIN(mileage) AS minMileage, MAX(mileage) AS maxMileage, COUNT(1) AS points
        FROM month_points
        GROUP BY y, m, vehicleId
      ), km AS (
        SELECT y, m,
               SUM(CASE WHEN points >= 2 THEN (maxMileage - minMileage) ELSE 0 END) AS kmDriven
        FROM monthly_mileage
        GROUP BY y, m
      )
      SELECT 
        YEAR(months.monthStart) AS y,
        MONTH(months.monthStart) AS m,
        ISNULL(maint.maintenanceCost, 0) AS maintenanceCost,
        ISNULL(fuel.fuelingCost, 0) AS fuelingCost,
        ISNULL(km.kmDriven, 0) AS kmDriven,
        fuel.avgEfficiency AS avgEfficiency
      FROM months
      LEFT JOIN maint ON maint.y = YEAR(months.monthStart) AND maint.m = MONTH(months.monthStart)
      LEFT JOIN fuel ON fuel.y = YEAR(months.monthStart) AND fuel.m = MONTH(months.monthStart)
      LEFT JOIN km ON km.y = YEAR(months.monthStart) AND km.m = MONTH(months.monthStart)
      ORDER BY y, m
      OPTION (MAXRECURSION 100)
    `;

    const result = await request.query(query);
    const rows = (result.recordset || []) as any[];
    return rows.map((r) => {
      const year = Number(r.y);
      const month = Number(r.m);
      const label = `${year}-${String(month).padStart(2, '0')}`;
      const maintenanceCost = parseFloat(r.maintenanceCost ?? 0);
      const fuelingCost = parseFloat(r.fuelingCost ?? 0);
      const kmDriven = r.kmDriven != null ? Number(r.kmDriven) : null;
      const avgEfficiency = r.avgEfficiency != null ? parseFloat(r.avgEfficiency) : null;
      const totalCost = maintenanceCost + fuelingCost;
      const costPerKm = kmDriven && kmDriven > 0 ? totalCost / kmDriven : null;
      return {
        year,
        month,
        label,
        maintenanceCost,
        fuelingCost,
        totalCost,
        kmDriven,
        avgEfficiency,
        costPerKm,
      } as MonthlyTrendPoint;
    });
  } catch (err) {
    console.error("[Report] getMonthlyCostsTrend error:", err);
    return [];
  }
}
