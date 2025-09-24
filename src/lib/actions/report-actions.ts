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
      ORDER BY v.createdAt DESC
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
      ORDER BY v.createdAt DESC
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
