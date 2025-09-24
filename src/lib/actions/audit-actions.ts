"use server";

import { getDbClient } from "@/lib/db";
import sql from "mssql";
import type { AuditEvent } from "@/types";

export async function recordAuditEvent(evt: Omit<AuditEvent, "id" | "createdAt">): Promise<void> {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== "SQLServer" || !(dbClient as any).pool) return;
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  const req = pool.request();
  req.input("eventType", sql.NVarChar(50), evt.eventType);
  req.input("actorUserId", sql.NVarChar(50), evt.actorUserId ?? null);
  req.input("actorUsername", sql.NVarChar(100), evt.actorUsername ?? null);
  req.input("targetUserId", sql.NVarChar(50), evt.targetUserId ?? null);
  req.input("targetUsername", sql.NVarChar(100), evt.targetUsername ?? null);
  req.input("message", sql.NVarChar(sql.MAX), evt.message ?? null);
  req.input("detailsJson", sql.NVarChar(sql.MAX), evt.detailsJson ?? null);
  await req.query(`
    INSERT INTO audit_events (eventType, actorUserId, actorUsername, targetUserId, targetUsername, message, detailsJson, createdAt)
    VALUES (@eventType, @actorUserId, @actorUsername, @targetUserId, @targetUsername, @message, @detailsJson, GETDATE());
  `);
}

export async function getAuditEvents(limit = 100): Promise<AuditEvent[]> {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== "SQLServer" || !(dbClient as any).pool) return [];
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  const req = pool.request();
  req.input("limit", sql.Int, limit);
  const res = await req.query(`
    SELECT TOP (@limit) id, eventType, actorUserId, actorUsername, targetUserId, targetUsername, message, detailsJson, createdAt
    FROM audit_events
    ORDER BY createdAt DESC;
  `);
  return res.recordset.map((r: any) => ({
    id: r.id?.toString?.() ?? String(r.id),
    eventType: r.eventType,
    actorUserId: r.actorUserId ?? undefined,
    actorUsername: r.actorUsername ?? undefined,
    targetUserId: r.targetUserId ?? undefined,
    targetUsername: r.targetUsername ?? undefined,
    message: r.message ?? undefined,
    detailsJson: r.detailsJson ?? undefined,
    createdAt: new Date(r.createdAt).toISOString(),
  }));
}
