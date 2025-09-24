"use server";

import { getDbClient } from "@/lib/db";
import sql from "mssql";

export type VehicleDocumentExpiry = {
  documentId: string;
  vehicleId: string;
  plateNumber: string;
  documentType: string;
  documentNumber?: string;
  expiryDate: string; // YYYY-MM-DD
  daysToExpiry: number;
};

// Returns vehicle documents that expire within the next `windowDays` days.
// Safe if table doesn't exist: returns an empty array.
export async function getExpiringDocuments(windowDays = 30): Promise<VehicleDocumentExpiry[]> {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== "SQLServer" || !(dbClient as any).pool) return [];
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  try {
    // Check if the expected table exists; if not, feature is simply inactive.
    const existsRes = await pool.request().query(
      "SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'vehicle_documents'"
    );
    if (!existsRes.recordset.length) return [];

    const req = pool.request();
    req.input("windowDays", sql.Int, windowDays);
    const result = await req.query(`
      SELECT 
        d.id AS documentId,
        d.vehicleId,
        v.plateNumber,
        d.documentType,
        d.documentNumber,
        CAST(d.expiryDate AS DATE) AS expiryDate,
        DATEDIFF(DAY, CAST(GETDATE() AS DATE), CAST(d.expiryDate AS DATE)) AS daysToExpiry
      FROM vehicle_documents d
      INNER JOIN vehicles v ON v.id = d.vehicleId
      WHERE d.expiryDate IS NOT NULL
        AND DATEDIFF(DAY, CAST(GETDATE() AS DATE), CAST(d.expiryDate AS DATE)) BETWEEN 0 AND @windowDays
        AND (d.status IS NULL OR d.status <> N'Inactivo')
      ORDER BY d.expiryDate ASC;
    `);

    return (result.recordset || []).map((r: any) => ({
      documentId: r.documentId?.toString?.() ?? String(r.documentId),
      vehicleId: r.vehicleId?.toString?.() ?? String(r.vehicleId),
      plateNumber: r.plateNumber,
      documentType: r.documentType,
      documentNumber: r.documentNumber || undefined,
      expiryDate: r.expiryDate ? new Date(r.expiryDate).toISOString().split("T")[0] : undefined,
      daysToExpiry: r.daysToExpiry != null ? Number(r.daysToExpiry) : 0,
    })) as VehicleDocumentExpiry[];
  } catch (err) {
    console.error("[Document Actions] getExpiringDocuments error:", err);
    return [];
  }
}
