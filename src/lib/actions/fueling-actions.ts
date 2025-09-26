
"use server";

import type { FuelingFormData, FuelingLog } from "@/types";
import { fuelingLogSchema } from "@/lib/zod-schemas";
import { revalidatePath } from "next/cache";
import { getDbClient } from "@/lib/db";
import sql from 'mssql'; // Descomentar si se instala y usa 'mssql'
import { toUtcMidnight } from "@/lib/utils";
import { VOUCHER_MAX_PER_FUELING } from "@/lib/config";
import { getVoucherMaxPerFueling } from "@/lib/server-config";
import { getCurrentUser } from "@/lib/auth/session";

const LITERS_PER_GALLON = 3.78541;

// Recalcula en cascada la eficiencia (km/gal) desde una fecha dada hacia adelante para un vehículo.
// Usa como base el último registro ANTERIOR a la fecha de inicio, y recorre
// los registros a partir de esa fecha en orden ascendente (fecha, createdAt, id),
// actualizando fuelEfficiencyKmPerGallon para cada uno según (km recorridos / galones de la carga actual).
async function recalcEfficienciesFrom(
  transaction: sql.Transaction,
  vehicleId: string,
  startingDateUtc: Date
): Promise<void> {
  // Normalizar vehicleId a string válida
  const vehicleIdNorm = (vehicleId != null) ? String(vehicleId).trim() : '';
  if (!vehicleIdNorm) return;
  // Buscar el último registro anterior a la fecha de inicio para establecer la base de kilometraje
  const prevReq = transaction.request();
  prevReq.input('vId_prev', sql.NVarChar(50), vehicleIdNorm);
  prevReq.input('startDate', sql.Date, startingDateUtc);
  const prevRes = await prevReq.query(`
    SELECT TOP 1 id, mileageAtFueling, fuelingDate, createdAt
    FROM fueling_logs
    WHERE vehicleId = @vId_prev AND fuelingDate < @startDate
    ORDER BY fuelingDate DESC, createdAt DESC, id DESC
  `);
  let prevMileage: number | null = prevRes.recordset.length > 0 ? Number(prevRes.recordset[0].mileageAtFueling) : null;

  // Obtener todos los registros desde la fecha de inicio en adelante, en orden ascendente para calcular sobre la marcha
  const seqReq = transaction.request();
  seqReq.input('vId', sql.NVarChar(50), vehicleIdNorm);
  seqReq.input('startDate', sql.Date, startingDateUtc);
  const seqRes = await seqReq.query(`
    SELECT id, mileageAtFueling, quantityLiters, fuelingDate, createdAt
    FROM fueling_logs
    WHERE vehicleId = @vId AND fuelingDate >= @startDate
    ORDER BY fuelingDate ASC, createdAt ASC, id ASC
  `);

  for (const row of seqRes.recordset) {
    let eff: number | null = null;
    if (prevMileage != null) {
      const mileageDiff = Number(row.mileageAtFueling) - prevMileage;
      const gallons = parseFloat(row.quantityLiters) / LITERS_PER_GALLON;
      if (gallons > 0 && mileageDiff > 0) {
        eff = parseFloat((mileageDiff / gallons).toFixed(1));
      }
    }
    const updReq = transaction.request();
    updReq.input('id_upd_eff', sql.Int, Number(row.id));
    // Si eff es null, guardamos NULL
    if (eff === null) {
      await updReq.query(`
        UPDATE fueling_logs SET fuelEfficiencyKmPerGallon = NULL WHERE id = @id_upd_eff;
      `);
    } else {
      updReq.input('eff_val', sql.Decimal(10, 1), eff);
      await updReq.query(`
        UPDATE fueling_logs SET fuelEfficiencyKmPerGallon = @eff_val WHERE id = @id_upd_eff;
      `);
    }
    // Avanzar la base
    prevMileage = Number(row.mileageAtFueling);
  }
}

export async function createFuelingLog(formData: FuelingFormData) {
  const validatedFields = fuelingLogSchema.safeParse(formData);

  if (!validatedFields.success) {
    // PRODUCCIÓN: logger.warn({ action: 'createFuelingLog', validationErrors: validatedFields.error.flatten().fieldErrors }, "Validation failed");
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Datos de formulario inválidos.",
      success: false,
    };
  }

  const dbClient = await getDbClient();
  if (!dbClient) {
    console.error("[Create Fueling Log Error] Configuración de BD no encontrada.");
    return { 
      message: "Error: Configuración de base de datos no encontrada. No se pudo crear el registro. Por favor, revise la página de Configuración.", 
      errors: { form: "Configuración de BD requerida." }, 
      success: false 
    };
  }
  const data = validatedFields.data;
  // Normalizar fecha a medianoche UTC y bloquear fechas futuras
  const fuelingDateUtc = toUtcMidnight(data.fuelingDate);
  const todayUtc = toUtcMidnight(new Date());
  if (fuelingDateUtc > todayUtc) {
    return {
      errors: { fuelingDate: "La fecha de carga no puede ser futura." },
      message: "Fecha inválida: no se permiten fechas futuras.",
      success: false,
    };
  }
  // PRODUCCIÓN: logger.info({ action: 'createFuelingLog', dbType: dbClient.type, vehicleId: data.vehicleId }, "Attempting to create fueling log");
  
  // --- EJEMPLO DE LÓGICA DE PRODUCCIÓN PARA SQL SERVER (IMPLEMENTACIÓN REAL NECESARIA) ---
  
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) return { message: "Pool de SQL Server no disponible.", success: false };
    
    const transaction = new sql.Transaction(pool);
    try {
      const currentUser = await getCurrentUser();
      const userIdInt = currentUser ? parseInt(currentUser.id, 10) : null;
      await transaction.begin();

  const vehicleIdNorm = String(data.vehicleId).trim();
      let vehiclePlateNumber = "N/A";
      let originalVehicleMileage = 0; 
      
      const vehicleRequest = transaction.request(); 
  vehicleRequest.input('vehicleIdForMeta', sql.NVarChar(50), vehicleIdNorm);
      const vehicleResult = await vehicleRequest.query('SELECT plateNumber, currentMileage FROM vehicles WHERE id = @vehicleIdForMeta');
      
      if (vehicleResult.recordset.length > 0) {
          vehiclePlateNumber = vehicleResult.recordset[0].plateNumber;
          originalVehicleMileage = vehicleResult.recordset[0].currentMileage;
      } else {
          // PRODUCCIÓN: logger.warn({ action: 'createFuelingLog', vehicleId: data.vehicleId, reason: 'Vehicle not found for plate/mileage association' });
          await transaction.rollback();
          return { message: "Vehículo asociado no encontrado. No se puede crear el registro de combustible.", errors: { vehicleId: "ID de vehículo no válido." }, success: false };
      }

  let fuelEfficiencyKmPerGallon: number | null = null;
      
      const prevLogRequest = transaction.request(); 
      prevLogRequest.input('prev_vehicleId_eff', sql.NVarChar(50), vehicleIdNorm);
  prevLogRequest.input('prev_fuelingDate_eff', sql.Date, fuelingDateUtc); 
    const prevLogResult = await prevLogRequest.query(`
      SELECT TOP 1 mileageAtFueling, quantityLiters 
      FROM fueling_logs 
      WHERE vehicleId = @prev_vehicleId_eff AND fuelingDate <= @prev_fuelingDate_eff 
      ORDER BY fuelingDate DESC, createdAt DESC, id DESC
    `);

      if (prevLogResult.recordset.length > 0) {
          const prevLog = prevLogResult.recordset[0];
          // Validación: el kilometraje nuevo no puede ser menor que el último previo a la fecha
          if (data.mileageAtFueling <= prevLog.mileageAtFueling) {
            await transaction.rollback();
            return {
              message: `El kilometraje (${data.mileageAtFueling}) no puede ser menor que el último registro previo (${prevLog.mileageAtFueling}).`,
              errors: { mileageAtFueling: 'El kilometraje debe ser mayor o igual al del registro anterior.' },
              success: false,
            };
          }
          const mileageDifference = data.mileageAtFueling - prevLog.mileageAtFueling;
          const gallonsUsedCurrent = data.quantityLiters / LITERS_PER_GALLON; 
          if (gallonsUsedCurrent > 0 && mileageDifference > 0) {
              fuelEfficiencyKmPerGallon = parseFloat((mileageDifference / gallonsUsedCurrent).toFixed(1));
          }
      }

      // Validación contra el siguiente registro (si existe): debe ser estrictamente menor al siguiente
      const nextLogRequest = transaction.request();
      nextLogRequest.input('next_vehicleId_eff', sql.NVarChar(50), vehicleIdNorm);
      nextLogRequest.input('next_fuelingDate_eff', sql.Date, fuelingDateUtc);
      const nextLogResult = await nextLogRequest.query(`
          SELECT TOP 1 mileageAtFueling
          FROM fueling_logs
          WHERE vehicleId = @next_vehicleId_eff AND fuelingDate > @next_fuelingDate_eff
          ORDER BY fuelingDate ASC, createdAt ASC, id ASC
      `);
      if (nextLogResult.recordset.length > 0) {
        const nextLog = nextLogResult.recordset[0];
        if (data.mileageAtFueling >= nextLog.mileageAtFueling) {
          await transaction.rollback();
          return {
            message: `El kilometraje (${data.mileageAtFueling}) debe ser menor que el registro siguiente (${nextLog.mileageAtFueling}).`,
            errors: { mileageAtFueling: 'El kilometraje debe ser menor que el siguiente registro existente.' },
            success: false,
          };
        }
      }
      
      const logRequest = transaction.request(); 
  logRequest.input('fl_vehicleId', sql.NVarChar(50), vehicleIdNorm);
      logRequest.input('fl_vehiclePlateNumber', sql.NVarChar(50), vehiclePlateNumber); 
  logRequest.input('fl_fuelingDate', sql.Date, fuelingDateUtc); 
      logRequest.input('fl_mileageAtFueling', sql.Int, data.mileageAtFueling);
      logRequest.input('fl_quantityLiters', sql.Decimal(10, 2), data.quantityLiters);
      logRequest.input('fl_costPerLiter', sql.Decimal(10, 2), data.costPerLiter);
      logRequest.input('fl_totalCost', sql.Decimal(10, 2), data.totalCost);
      logRequest.input('fl_station', sql.NVarChar(100), data.station);
      logRequest.input('fl_responsible', sql.NVarChar(100), (data as any).responsible);
      logRequest.input('fl_imageUrl', sql.NVarChar(255), data.imageUrl || null); // Guardar null si no se provee
      logRequest.input('fl_fuelEfficiency', fuelEfficiencyKmPerGallon !== null ? sql.Decimal(10,1) : sql.Decimal(10,1), fuelEfficiencyKmPerGallon);
      
      const result = await logRequest.query(`
          INSERT INTO fueling_logs (
            vehicleId, vehiclePlateNumber, fuelingDate, mileageAtFueling, quantityLiters, 
            costPerLiter, totalCost, station, responsible, imageUrl, fuelEfficiencyKmPerGallon, 
            createdByUserId, updatedByUserId, createdAt, updatedAt
          )
          OUTPUT INSERTED.id, INSERTED.createdAt, INSERTED.updatedAt, INSERTED.imageUrl, INSERTED.createdByUserId, INSERTED.updatedByUserId
          VALUES (
            @fl_vehicleId, @fl_vehiclePlateNumber, @fl_fuelingDate, @fl_mileageAtFueling, @fl_quantityLiters,
            @fl_costPerLiter, @fl_totalCost, @fl_station, @fl_responsible, @fl_imageUrl, @fl_fuelEfficiency,
            ${userIdInt !== null ? userIdInt : 'NULL'}, ${userIdInt !== null ? userIdInt : 'NULL'}, GETDATE(), GETDATE()
          );
      `);
      
      if (result.recordset.length === 0 || !result.recordset[0].id) {
        // PRODUCCIÓN: logger.error({ action: 'createFuelingLog', data }, "Failed to create fueling log, no ID returned");
        await transaction.rollback();
        throw new Error("Fallo al crear el registro de combustible, la base de datos no devolvió un ID.");
      }
      const newDbRecord = result.recordset[0];
    const newLog: FuelingLog = { 
          id: newDbRecord.id.toString(), 
          ...data,
          vehiclePlateNumber: vehiclePlateNumber,
          fuelEfficiencyKmPerGallon: fuelEfficiencyKmPerGallon === null ? undefined : fuelEfficiencyKmPerGallon,
          fuelingDate: fuelingDateUtc.toISOString().split('T')[0],
          imageUrl: newDbRecord.imageUrl,
          createdAt: new Date(newDbRecord.createdAt).toISOString(),
      updatedAt: new Date(newDbRecord.updatedAt).toISOString(),
      createdByUserId: newDbRecord.createdByUserId ? newDbRecord.createdByUserId.toString() : undefined,
      updatedByUserId: newDbRecord.updatedByUserId ? newDbRecord.updatedByUserId.toString() : undefined,
      };

      if (data.mileageAtFueling > originalVehicleMileage) {
          const updateVehicleRequest = transaction.request(); 
          updateVehicleRequest.input('upd_v_id_mileage', sql.NVarChar(50), vehicleIdNorm);
          updateVehicleRequest.input('upd_v_mileage_val', sql.Int, data.mileageAtFueling);
          await updateVehicleRequest.query(`UPDATE vehicles SET currentMileage = @upd_v_mileage_val, updatedByUserId = ${userIdInt !== null ? userIdInt : 'NULL'}, updatedAt = GETDATE() WHERE id = @upd_v_id_mileage`);
      }

      // Guardar vouchers si vienen en el payload (múltiples o legado)
      const newVouchers = (formData as any).newVouchers as { name: string; type: string; content: string }[] | undefined;
      // Seguridad: limitar máximo de vouchers totales a 2 por registro
      if (Array.isArray(newVouchers) && newVouchers.length > 0) {
        const MAX = await getVoucherMaxPerFueling().catch(() => VOUCHER_MAX_PER_FUELING);
        const cntReq = transaction.request();
        cntReq.input('logIdCount', sql.Int, parseInt(newLog.id, 10));
        const cntRes = await cntReq.query(`
          SELECT COUNT(1) AS c FROM fueling_vouchers WHERE fueling_log_id = @logIdCount
        `);
        const existingCount = cntRes.recordset?.[0]?.c ? parseInt(cntRes.recordset[0].c, 10) : 0;
        const allowed = Math.max(0, MAX - existingCount);
        if (allowed <= 0) {
          // Ignorar adicionales
        } else if (newVouchers.length > allowed) {
          newVouchers.splice(allowed); // recortar
        }
      }
      if (Array.isArray(newVouchers) && newVouchers.length > 0) {
        for (const nv of newVouchers) {
          const base64 = (nv.content || '').split(',')[1] || '';
          const buffer = Buffer.from(base64, 'base64');
          const voucherReq = transaction.request();
          voucherReq.input('v_log_id', sql.Int, parseInt(newLog.id, 10));
          voucherReq.input('v_name', sql.NVarChar(200), nv.name);
          voucherReq.input('v_type', sql.NVarChar(100), nv.type);
          voucherReq.input('v_content', sql.VarBinary(sql.MAX), buffer);
          await voucherReq.query(`
            IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fueling_vouchers]') AND type in (N'U'))
            BEGIN
              RAISERROR('Tabla fueling_vouchers no existe. Aplique la migración SQL.', 16, 1);
            END
            INSERT INTO fueling_vouchers (fueling_log_id, file_name, file_type, file_content, created_at)
            VALUES (@v_log_id, @v_name, @v_type, @v_content, GETDATE());
          `);
        }
      } else if ((formData as any).newVoucher?.content) {
        // Compatibilidad hacia atrás con un solo voucher
        const nv = (formData as any).newVoucher as { name: string; type: string; content: string };
        const base64 = nv.content.split(',')[1] || '';
        const buffer = Buffer.from(base64, 'base64');
        const voucherReq = transaction.request();
        voucherReq.input('v_log_id', sql.Int, parseInt(newLog.id, 10));
        voucherReq.input('v_name', sql.NVarChar(200), nv.name);
        voucherReq.input('v_type', sql.NVarChar(100), nv.type);
        voucherReq.input('v_content', sql.VarBinary(sql.MAX), buffer);
        await voucherReq.query(`
          IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fueling_vouchers]') AND type in (N'U'))
          BEGIN
            RAISERROR('Tabla fueling_vouchers no existe. Aplique la migración SQL.', 16, 1);
          END
          INSERT INTO fueling_vouchers (fueling_log_id, file_name, file_type, file_content, created_at)
          VALUES (@v_log_id, @v_name, @v_type, @v_content, GETDATE());
        `);
      }
      
  // Recalcular en cascada desde la fecha del nuevo registro para asegurar trazabilidad
  await recalcEfficienciesFrom(transaction, vehicleIdNorm, fuelingDateUtc);

  await transaction.commit();
      // PRODUCCIÓN: logger.info({ action: 'createFuelingLog', logId: newLog.id, vehicleId: newLog.vehicleId }, "Fueling log created successfully");
  revalidatePath("/fueling");
  revalidatePath("/fueling/mobile");
      revalidatePath("/vehicles"); 
      revalidatePath(`/vehicles/${data.vehicleId}`);
      revalidatePath("/reports/fuel-consumption"); 
      return { message: `Registro de combustible creado exitosamente.`, log: newLog, success: true };
    } catch (error) {
      await transaction.rollback();
      // PRODUCCIÓN: logger.error({ action: 'createFuelingLog', data, error: (error as Error).message, stack: (error as Error).stack }, "Error creating fueling log");
      console.error(`[SQL Server Error] Error al crear registro de combustible:`, error);
      return { 
        message: `Error al crear registro de combustible. Detalles: ${(error as Error).message}`, 
        errors: { form: "Error de base de datos al crear." }, 
        success: false
      };
    }
  } else {
    console.warn(`[Create Fueling Log] La creación de registros de combustible no está implementada para el tipo de BD: ${dbClient.type}.`);
    return { 
      message: `La creación de registros de combustible no está implementada para el tipo de BD: ${dbClient.type}. Por favor, implemente la lógica SQL.`, 
      errors: { form: "Tipo de BD no soportado para esta acción." }, 
      success: false 
    };
  }
  
  
  // console.log(`[Create Fueling Log] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Registro no creado.`);
  // return { 
  //   message: `Creación de registro de combustible pendiente de implementación SQL para ${dbClient.type}.`, 
  //   log: null, 
  //   success: false,
  //   errors: { form: `Implementación SQL pendiente para ${dbClient.type}.` }
  // };
}

export async function getFuelingLogs(): Promise<FuelingLog[]> {
  const dbClient = await getDbClient();
  if (!dbClient) {
    console.warn("getFuelingLogs: Configuración de BD no encontrada. Devolviendo lista vacía.");
    return [];
  }
  // PRODUCCIÓN: logger.info({ action: 'getFuelingLogs', dbType: dbClient.type }, "Attempting to fetch all fueling logs");
  
  // --- EJEMPLO DE LÓGICA DE PRODUCCIÓN PARA SQL SERVER (IMPLEMENTACIÓN REAL NECESARIA) ---
  
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) {
      console.error("getFuelingLogs: Pool de SQL Server no disponible.");
      return [];
    }
    try {
      const request = pool.request();
      const result = await request.query(`
        SELECT 
          fl.id, fl.vehicleId, fl.vehiclePlateNumber, fl.fuelingDate, fl.mileageAtFueling, fl.quantityLiters,
          fl.costPerLiter, fl.totalCost, fl.station, fl.responsible, fl.imageUrl, fl.fuelEfficiencyKmPerGallon, fl.createdAt, fl.updatedAt,
          fl.createdByUserId, fl.updatedByUserId, cu.username AS createdByUsername, uu.username AS updatedByUsername
        FROM fueling_logs fl
        LEFT JOIN users cu ON fl.createdByUserId = cu.id
        LEFT JOIN users uu ON fl.updatedByUserId = uu.id
        ORDER BY fuelingDate DESC, createdAt DESC
      `);
      return result.recordset.map(row => ({
        id: row.id.toString(),
        vehicleId: row.vehicleId,
        vehiclePlateNumber: row.vehiclePlateNumber,
        fuelingDate: new Date(row.fuelingDate).toISOString().split('T')[0],
        mileageAtFueling: row.mileageAtFueling,
        quantityLiters: parseFloat(row.quantityLiters),
        costPerLiter: parseFloat(row.costPerLiter),
        totalCost: parseFloat(row.totalCost),
        station: row.station,
        responsible: row.responsible,
        imageUrl: row.imageUrl,
        fuelEfficiencyKmPerGallon: row.fuelEfficiencyKmPerGallon ? parseFloat(row.fuelEfficiencyKmPerGallon) : undefined,
        createdAt: new Date(row.createdAt).toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
        createdByUserId: row.createdByUserId ? row.createdByUserId.toString() : undefined,
        updatedByUserId: row.updatedByUserId ? row.updatedByUserId.toString() : undefined,
        createdByUsername: row.createdByUsername || undefined,
        updatedByUsername: row.updatedByUsername || undefined,
      })) as FuelingLog[];
    } catch (error) {
      // PRODUCCIÓN: logger.error({ action: 'getFuelingLogs', error: (error as Error).message, stack: (error as Error).stack }, "Error fetching fueling logs");
      console.error('[SQL Server Error] Error al obtener registros de combustible:', error);
      return [];
    }
  } else {
    console.warn(`[Get Fueling Logs] La obtención de registros de combustible no está implementada para el tipo de BD: ${dbClient.type}.`);
    return [];
  }
  
  
  // console.log(`[Get Fueling Logs] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Devolviendo lista vacía.`);
  // return [];
}

export async function getFuelingLogsByVehicleId(vehicleId: string): Promise<FuelingLog[]> {
    const dbClient = await getDbClient();
    if (!dbClient) {
        console.warn(`getFuelingLogsByVehicleId(${vehicleId}): Configuración de BD no encontrada. Devolviendo lista vacía.`);
        return [];
    }
    // PRODUCCIÓN: logger.info({ action: 'getFuelingLogsByVehicleId', dbType: dbClient.type, vehicleId }, "Attempting to fetch fueling logs for vehicle");
    
    // --- EJEMPLO DE LÓGICA DE PRODUCCIÓN PARA SQL SERVER (IMPLEMENTACIÓN REAL NECESARIA) ---
    
    if (dbClient.type === "SQLServer") {
      const pool = (dbClient as any).pool as sql.ConnectionPool;
      if (!pool) {
        console.error("getFuelingLogsByVehicleId: Pool de SQL Server no disponible.");
        return [];
      }
      try {
        const request = pool.request();
        request.input('targetVehicleId', sql.NVarChar(50), vehicleId);
        const result = await request.query(`
          SELECT 
            fl.id, fl.vehicleId, fl.vehiclePlateNumber, fl.fuelingDate, fl.mileageAtFueling, fl.quantityLiters,
            fl.costPerLiter, fl.totalCost, fl.station, fl.responsible, fl.imageUrl, fl.fuelEfficiencyKmPerGallon, fl.createdAt, fl.updatedAt,
            fl.createdByUserId, fl.updatedByUserId, cu.username AS createdByUsername, uu.username AS updatedByUsername
          FROM fueling_logs fl
          LEFT JOIN users cu ON fl.createdByUserId = cu.id
          LEFT JOIN users uu ON fl.updatedByUserId = uu.id
          WHERE fl.vehicleId = @targetVehicleId 
          ORDER BY fl.fuelingDate DESC, fl.createdAt DESC
        `);
        return result.recordset.map(row => ({
          id: row.id.toString(),
          vehicleId: row.vehicleId,
          vehiclePlateNumber: row.vehiclePlateNumber,
          fuelingDate: new Date(row.fuelingDate).toISOString().split('T')[0],
          mileageAtFueling: row.mileageAtFueling,
          quantityLiters: parseFloat(row.quantityLiters),
          costPerLiter: parseFloat(row.costPerLiter),
          totalCost: parseFloat(row.totalCost),
          station: row.station,
          responsible: row.responsible,
          imageUrl: row.imageUrl,
          fuelEfficiencyKmPerGallon: row.fuelEfficiencyKmPerGallon ? parseFloat(row.fuelEfficiencyKmPerGallon) : undefined,
          createdAt: new Date(row.createdAt).toISOString(),
          updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
          createdByUserId: row.createdByUserId ? row.createdByUserId.toString() : undefined,
          updatedByUserId: row.updatedByUserId ? row.updatedByUserId.toString() : undefined,
          createdByUsername: row.createdByUsername || undefined,
          updatedByUsername: row.updatedByUsername || undefined,
        })) as FuelingLog[];
      } catch (error) {
        // PRODUCCIÓN: logger.error({ action: 'getFuelingLogsByVehicleId', vehicleId, error: (error as Error).message, stack: (error as Error).stack }, "Error fetching fueling logs for vehicle");
        console.error(`[SQL Server Error] Error al obtener registros de combustible para vehículo ID ${vehicleId}:`, error);
        return [];
      }
    } else {
      console.warn(`[Get Fueling Logs By Vehicle ID] La obtención de registros por ID de vehículo no está implementada para: ${dbClient.type}.`);
      return [];
    }
    
    
    // console.log(`[Get Fueling Logs By Vehicle ID] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Vehículo ID: ${vehicleId}. Devolviendo lista vacía.`);
    // return [];
}

// Obtener un registro de combustible por ID
export async function getFuelingLogById(id: string): Promise<FuelingLog | null> {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== 'SQLServer' || !(dbClient as any).pool) {
    console.warn(`[Get Fueling Log By Id] DB no disponible o tipo no soportado.`);
    return null;
  }
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  try {
    const request = pool.request();
    request.input('id_find', sql.NVarChar(50), id);
    const result = await request.query(`
      SELECT TOP 1 
        fl.id, fl.vehicleId, fl.vehiclePlateNumber, fl.fuelingDate, fl.mileageAtFueling, fl.quantityLiters,
        fl.costPerLiter, fl.totalCost, fl.station, fl.responsible, fl.imageUrl, fl.fuelEfficiencyKmPerGallon, fl.createdAt, fl.updatedAt,
        fl.createdByUserId, fl.updatedByUserId, cu.username AS createdByUsername, uu.username AS updatedByUsername
      FROM fueling_logs fl
      LEFT JOIN users cu ON fl.createdByUserId = cu.id
      LEFT JOIN users uu ON fl.updatedByUserId = uu.id
      WHERE fl.id = @id_find
    `);
    if (!result.recordset.length) return null;
    const row = result.recordset[0];
    const log: FuelingLog = {
      id: row.id.toString(),
      vehicleId: row.vehicleId,
      vehiclePlateNumber: row.vehiclePlateNumber,
      fuelingDate: new Date(row.fuelingDate).toISOString().split('T')[0],
      mileageAtFueling: row.mileageAtFueling,
      quantityLiters: parseFloat(row.quantityLiters),
      costPerLiter: parseFloat(row.costPerLiter),
      totalCost: parseFloat(row.totalCost),
      station: row.station,
      responsible: row.responsible,
      imageUrl: row.imageUrl || undefined,
      fuelEfficiencyKmPerGallon: row.fuelEfficiencyKmPerGallon ? parseFloat(row.fuelEfficiencyKmPerGallon) : undefined,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
      createdByUserId: row.createdByUserId ? row.createdByUserId.toString() : undefined,
      updatedByUserId: row.updatedByUserId ? row.updatedByUserId.toString() : undefined,
      createdByUsername: row.createdByUsername || undefined,
      updatedByUsername: row.updatedByUsername || undefined,
    };

    // Obtener vouchers asociados, si la tabla existe
    try {
      const vReq = pool.request();
      vReq.input('id_find', sql.NVarChar(50), id);
      const vRes = await vReq.query(`
        IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fueling_vouchers]') AND type in (N'U'))
        BEGIN
          SELECT id, fueling_log_id, file_name, file_type, file_content, created_at
          FROM fueling_vouchers
          WHERE fueling_log_id = @id_find
          ORDER BY created_at DESC
        END
        ELSE
        BEGIN
          SELECT CAST(NULL AS INT) AS id, CAST(NULL AS INT) AS fueling_log_id, CAST(NULL AS NVARCHAR(1)) AS file_name, CAST(NULL AS NVARCHAR(1)) AS file_type, CAST(NULL AS VARBINARY(MAX)) AS file_content, CAST(NULL AS DATETIME2) AS created_at WHERE 1=0
        END
      `);
      if (vRes.recordset && vRes.recordset.length) {
        log.vouchers = vRes.recordset.map((vr: any) => {
          const buf: Buffer = Buffer.isBuffer(vr.file_content) ? vr.file_content : Buffer.from(vr.file_content || '');
          const dataUri = `data:${vr.file_type};base64,${buf.toString('base64')}`;
          return {
            id: vr.id.toString(),
            fuelingLogId: vr.fueling_log_id.toString(),
            fileName: vr.file_name,
            fileType: vr.file_type,
            fileContent: dataUri,
            createdAt: vr.created_at ? new Date(vr.created_at).toISOString() : new Date().toISOString(),
          };
        });
      }
    } catch (e) {
      // Tabla no existe u otro error, continuar sin vouchers
    }
    return log;
  } catch (err) {
    console.error(`[SQL Server Error] getFuelingLogById`, err);
    return null;
  }
}

// Actualizar un registro de combustible existente
export async function updateFuelingLog(id: string, formData: FuelingFormData) {
  const validatedFields = fuelingLogSchema.safeParse(formData);
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Datos de formulario inválidos.',
      success: false,
    };
  }

  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== 'SQLServer' || !(dbClient as any).pool) {
    return { message: 'Tipo de BD no soportado o pool no disponible.', success: false };
  }
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  const data = validatedFields.data;
  // Normalizar fecha a medianoche UTC y bloquear fechas futuras
  const fuelingDateUtc = toUtcMidnight(data.fuelingDate);
  const todayUtc = toUtcMidnight(new Date());
  if (fuelingDateUtc > todayUtc) {
    return {
      errors: { fuelingDate: "La fecha de carga no puede ser futura." },
      message: 'Fecha inválida: no se permiten fechas futuras.',
      success: false,
    };
  }

  const transaction = new sql.Transaction(pool);
  try {
    const currentUser = await getCurrentUser();
    const userIdInt = currentUser ? parseInt(currentUser.id, 10) : null;
    await transaction.begin();

    // Obtener el registro actual para detectar cambios de vehículo/fecha
    const beforeReq = transaction.request();
    beforeReq.input('id_find_before', sql.NVarChar(50), id);
    const beforeRes = await beforeReq.query(`
      SELECT TOP 1 vehicleId AS oldVehicleId, fuelingDate AS oldFuelingDate
      FROM fueling_logs WHERE id = @id_find_before
    `);
  const oldVehicleId: string | null = beforeRes.recordset?.[0]?.oldVehicleId ? String(beforeRes.recordset[0].oldVehicleId).trim() : null;
    const oldFuelingDate: Date | null = beforeRes.recordset?.[0]?.oldFuelingDate ?? null;

    // Recalcular eficiencia usando registro previo
    let fuelEfficiencyKmPerGallon: number | null = null;
    const prevLogRequest = transaction.request();
    // Normalizar vehicleId para búsqueda del registro previo
    prevLogRequest.input('prev_vehicleId_eff', sql.NVarChar(50), String(data.vehicleId).trim());
  prevLogRequest.input('prev_fuelingDate_eff', sql.Date, fuelingDateUtc);
    prevLogRequest.input('currentId', sql.NVarChar(50), id);
    const prevLogResult = await prevLogRequest.query(`
      SELECT TOP 1 mileageAtFueling, quantityLiters
      FROM fueling_logs
      WHERE vehicleId = @prev_vehicleId_eff AND fuelingDate <= @prev_fuelingDate_eff AND id <> @currentId
      ORDER BY fuelingDate DESC, createdAt DESC, id DESC
    `);
    if (prevLogResult.recordset.length > 0) {
      const prevLog = prevLogResult.recordset[0];
      // Validación: el kilometraje nuevo no puede ser menor o igual al último previo a la fecha
      if (data.mileageAtFueling <= prevLog.mileageAtFueling) {
        await transaction.rollback();
        return {
          message: `El kilometraje (${data.mileageAtFueling}) no puede ser menor que el último registro previo (${prevLog.mileageAtFueling}).`,
          errors: { mileageAtFueling: 'El kilometraje debe ser mayor o igual al del registro anterior.' },
          success: false,
        };
      }
      const mileageDifference = data.mileageAtFueling - prevLog.mileageAtFueling;
      const gallonsUsedCurrent = data.quantityLiters / LITERS_PER_GALLON;
      if (gallonsUsedCurrent > 0 && mileageDifference > 0) {
        fuelEfficiencyKmPerGallon = parseFloat((mileageDifference / gallonsUsedCurrent).toFixed(1));
      }
    }

    // Validación contra el siguiente registro existente
    const nextLogReq = transaction.request();
    nextLogReq.input('n_vehicleId', sql.NVarChar(50), String(data.vehicleId).trim());
    nextLogReq.input('n_date', sql.Date, fuelingDateUtc);
    nextLogReq.input('currentId2', sql.NVarChar(50), id);
    const nextLogRes = await nextLogReq.query(`
      SELECT TOP 1 mileageAtFueling
      FROM fueling_logs
      WHERE vehicleId = @n_vehicleId AND fuelingDate > @n_date AND id <> @currentId2
      ORDER BY fuelingDate ASC, createdAt ASC, id ASC
    `);
    if (nextLogRes.recordset.length > 0) {
      const nextLog = nextLogRes.recordset[0];
      if (data.mileageAtFueling >= nextLog.mileageAtFueling) {
        await transaction.rollback();
        return {
          message: `El kilometraje (${data.mileageAtFueling}) debe ser menor que el registro siguiente (${nextLog.mileageAtFueling}).`,
          errors: { mileageAtFueling: 'El kilometraje debe ser menor que el siguiente registro existente.' },
          success: false,
        };
      }
    }

    // Metadatos del vehículo
    const vehicleMetaReq = transaction.request();
  vehicleMetaReq.input('vId_meta', sql.NVarChar(50), String(data.vehicleId).trim());
    const vehicleMeta = await vehicleMetaReq.query('SELECT plateNumber, currentMileage FROM vehicles WHERE id = @vId_meta');
    const vehiclePlateNumber = vehicleMeta.recordset[0]?.plateNumber || 'N/A';
    const originalVehicleMileage = vehicleMeta.recordset[0]?.currentMileage || 0;

    const updReq = transaction.request();
    updReq.input('id_upd', sql.NVarChar(50), id);
  updReq.input('vId', sql.NVarChar(50), String(data.vehicleId).trim());
  updReq.input('date', sql.Date, fuelingDateUtc);
    updReq.input('mileage', sql.Int, data.mileageAtFueling);
    updReq.input('liters', sql.Decimal(10, 2), data.quantityLiters);
    updReq.input('cpl', sql.Decimal(10, 2), data.costPerLiter);
    updReq.input('total', sql.Decimal(10, 2), data.totalCost);
    updReq.input('station', sql.NVarChar(100), data.station);
  updReq.input('imageUrl', sql.NVarChar(255), data.imageUrl || null);
  updReq.input('responsible', sql.NVarChar(100), (data as any).responsible);
    updReq.input('eff', sql.Decimal(10, 1), fuelEfficiencyKmPerGallon);

    await updReq.query(`
      UPDATE fueling_logs
      SET 
        vehicleId = @vId,
        vehiclePlateNumber = '${vehiclePlateNumber}',
        fuelingDate = @date,
        mileageAtFueling = @mileage,
        quantityLiters = @liters,
        costPerLiter = @cpl,
        totalCost = @total,
        station = @station,
        responsible = @responsible,
        imageUrl = @imageUrl,
        fuelEfficiencyKmPerGallon = @eff,
        updatedByUserId = ${userIdInt !== null ? userIdInt : 'NULL'},
        updatedAt = GETDATE()
      WHERE id = @id_upd;
    `);

    if (data.mileageAtFueling > originalVehicleMileage) {
      const updateVehicleRequest = transaction.request();
  updateVehicleRequest.input('vId', sql.NVarChar(50), String(data.vehicleId).trim());
      updateVehicleRequest.input('mileageVal', sql.Int, data.mileageAtFueling);
      await updateVehicleRequest.query(`
        UPDATE vehicles 
        SET currentMileage = @mileageVal, updatedByUserId = ${userIdInt !== null ? userIdInt : 'NULL'}, updatedAt = GETDATE()
        WHERE id = @vId;
      `);
    }

    // Eliminar vouchers existentes marcados
    const vouchersToRemove = (formData as any).vouchersToRemove as string[] | undefined;
    if (Array.isArray(vouchersToRemove) && vouchersToRemove.length > 0) {
      const delReq = transaction.request();
      delReq.input('ids_csv', sql.NVarChar(sql.MAX), vouchersToRemove.join(','));
      await delReq.query(`
        IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fueling_vouchers]') AND type in (N'U'))
        BEGIN
          DELETE FROM fueling_vouchers WHERE id IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@ids_csv, ',') WHERE TRY_CAST(value AS INT) IS NOT NULL);
        END
      `);
    }

    // Guardar vouchers nuevos si vienen en el payload (múltiples o legado)
    const newVouchers = (formData as any).newVouchers as { name: string; type: string; content: string }[] | undefined;
    // Seguridad: respetar máximo 2 incluyendo los existentes restantes
    if (Array.isArray(newVouchers) && newVouchers.length > 0) {
      const MAX = await getVoucherMaxPerFueling().catch(() => VOUCHER_MAX_PER_FUELING);
      const cntReq = transaction.request();
      cntReq.input('logIdCount', sql.Int, parseInt(id, 10));
      const cntRes = await cntReq.query(`SELECT COUNT(1) AS c FROM fueling_vouchers WHERE fueling_log_id = @logIdCount`);
  const existingCount = cntRes.recordset?.[0]?.c ? parseInt(cntRes.recordset[0].c, 10) : 0;
      const allowed = Math.max(0, MAX - existingCount);
      if (allowed <= 0) {
        newVouchers.length = 0;
      } else if (newVouchers.length > allowed) {
        newVouchers.splice(allowed);
      }
    }
    if (Array.isArray(newVouchers) && newVouchers.length > 0) {
      for (const nv of newVouchers) {
        const base64 = (nv.content || '').split(',')[1] || '';
        const buffer = Buffer.from(base64, 'base64');
        const voucherReq = transaction.request();
        voucherReq.input('v_log_id', sql.Int, parseInt(id, 10));
        voucherReq.input('v_name', sql.NVarChar(200), nv.name);
        voucherReq.input('v_type', sql.NVarChar(100), nv.type);
        voucherReq.input('v_content', sql.VarBinary(sql.MAX), buffer);
        await voucherReq.query(`
          IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fueling_vouchers]') AND type in (N'U'))
          BEGIN
            RAISERROR('Tabla fueling_vouchers no existe. Aplique la migración SQL.', 16, 1);
          END
          INSERT INTO fueling_vouchers (fueling_log_id, file_name, file_type, file_content, created_at)
          VALUES (@v_log_id, @v_name, @v_type, @v_content, GETDATE());
        `);
      }
    } else if ((formData as any).newVoucher?.content) {
      // Compatibilidad hacia atrás
      const nv = (formData as any).newVoucher as { name: string; type: string; content: string };
      const base64 = nv.content.split(',')[1] || '';
      const buffer = Buffer.from(base64, 'base64');
      const voucherReq = transaction.request();
      voucherReq.input('v_log_id', sql.Int, parseInt(id, 10));
      voucherReq.input('v_name', sql.NVarChar(200), nv.name);
      voucherReq.input('v_type', sql.NVarChar(100), nv.type);
      voucherReq.input('v_content', sql.VarBinary(sql.MAX), buffer);
      await voucherReq.query(`
        IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fueling_vouchers]') AND type in (N'U'))
        BEGIN
          RAISERROR('Tabla fueling_vouchers no existe. Aplique la migración SQL.', 16, 1);
        END
        INSERT INTO fueling_vouchers (fueling_log_id, file_name, file_type, file_content, created_at)
        VALUES (@v_log_id, @v_name, @v_type, @v_content, GETDATE());
      `);
    }

    // Recalcular eficiencias a partir del punto de impacto
    if (oldVehicleId && oldFuelingDate) {
      if (oldVehicleId === data.vehicleId) {
        const minDate = oldFuelingDate < fuelingDateUtc ? oldFuelingDate : fuelingDateUtc;
        await recalcEfficienciesFrom(transaction, data.vehicleId, minDate);
      } else {
        // Se movió a otro vehículo: recalcular cadenas en ambos
        await recalcEfficienciesFrom(transaction, oldVehicleId, oldFuelingDate);
        await recalcEfficienciesFrom(transaction, data.vehicleId, fuelingDateUtc);
      }
    } else {
      // Seguridad: si no pudimos leer el anterior, al menos recalcular desde la nueva fecha
      await recalcEfficienciesFrom(transaction, data.vehicleId, fuelingDateUtc);
    }

    await transaction.commit();
    revalidatePath('/fueling');
    // Revalidate detail view and mobile route to reflect latest vouchers
    revalidatePath(`/fueling/${id}`);
  revalidatePath(`/fueling/mobile/${id}`);
    revalidatePath('/fueling/mobile');
    revalidatePath('/reports/fuel-consumption');
    revalidatePath(`/vehicles/${data.vehicleId}`);
    return { message: 'Registro de combustible actualizado.', success: true };
  } catch (err) {
    await transaction.rollback();
    console.error(`[SQL Server Error] updateFuelingLog`, err);
    return { message: 'Error al actualizar el registro.', success: false };
  }
}

// Eliminar un voucher individual
export async function deleteFuelingVoucher(voucherId: string, logId: string) {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== 'SQLServer' || !(dbClient as any).pool) {
    return { message: 'Tipo de BD no soportado o pool no disponible.', success: false };
  }
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  try {
    const req = pool.request();
    req.input('vid', sql.Int, parseInt(voucherId, 10));
    await req.query(`
      IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fueling_vouchers]') AND type in (N'U'))
      BEGIN
        DELETE FROM fueling_vouchers WHERE id = @vid;
      END
    `);
    revalidatePath('/fueling');
    revalidatePath(`/fueling/${logId}`);
    revalidatePath('/fueling/mobile');
    return { message: 'Voucher eliminado.', success: true };
  } catch (err) {
    console.error(`[SQL Server Error] deleteFuelingVoucher`, err);
    return { message: 'Error al eliminar el voucher.', success: false };
  }
}

// Eliminar un registro de combustible
export async function deleteFuelingLog(id: string) {
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== 'SQLServer' || !(dbClient as any).pool) {
    return { message: 'Tipo de BD no soportado o pool no disponible.', success: false };
  }
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    // Obtener datos previos para recalcular cadena luego del borrado
    const beforeReq = transaction.request();
    beforeReq.input('id_find_before', sql.NVarChar(50), id);
    const beforeRes = await beforeReq.query(`
      SELECT TOP 1 vehicleId AS vId, fuelingDate AS fDate FROM fueling_logs WHERE id = @id_find_before
    `);
    const oldVehicleId: string | null = beforeRes.recordset?.[0]?.vId ?? null;
    const oldFuelingDate: Date | null = beforeRes.recordset?.[0]?.fDate ?? null;

    const req = transaction.request();
    req.input('id_del', sql.NVarChar(50), id);
    await req.query('DELETE FROM fueling_logs WHERE id = @id_del');

    if (oldVehicleId && oldFuelingDate) {
      await recalcEfficienciesFrom(transaction, oldVehicleId, oldFuelingDate);
    }

    await transaction.commit();
    revalidatePath('/fueling');
    revalidatePath('/reports/fuel-consumption');
    return { message: 'Registro de combustible eliminado.', success: true };
  } catch (err) {
    try { await transaction.rollback(); } catch {}
    console.error(`[SQL Server Error] deleteFuelingLog`, err);
    return { message: 'Error al eliminar el registro.', success: false };
  }
}

// Listar con filtros de vehículo y fecha
export async function getFuelingLogsFiltered(params: { vehicleId?: string; from?: string; to?: string }): Promise<FuelingLog[]> {
  const { vehicleId, from, to } = params;
  const dbClient = await getDbClient();
  if (!dbClient || dbClient.type !== 'SQLServer' || !(dbClient as any).pool) {
    console.warn(`[Get Fueling Logs Filtered] DB no disponible o tipo no soportado.`);
    return [];
  }
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  try {
    const request = pool.request();
    if (vehicleId) request.input('vId', sql.NVarChar(50), vehicleId);
    // Build UTC date-only objects to avoid timezone shifts
    const toUtcDate = (s: string) => {
      const [yy, mm, dd] = s.split('-').map((n) => parseInt(n, 10));
      return new Date(Date.UTC(yy, (mm || 1) - 1, dd || 1));
    };
    if (from) request.input('fromDate', sql.Date, toUtcDate(from));
    if (to) request.input('toDate', sql.Date, toUtcDate(to));
    const where: string[] = [];
    if (vehicleId) where.push('vehicleId = @vId');
    if (from) where.push('fuelingDate >= @fromDate');
    if (to) where.push('fuelingDate <= @toDate');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await request.query(`
      SELECT 
        fl.id, fl.vehicleId, fl.vehiclePlateNumber, fl.fuelingDate, fl.mileageAtFueling, fl.quantityLiters,
        fl.costPerLiter, fl.totalCost, fl.station, fl.responsible, fl.imageUrl, fl.fuelEfficiencyKmPerGallon, fl.createdAt, fl.updatedAt,
        fl.createdByUserId, fl.updatedByUserId, cu.username AS createdByUsername, uu.username AS updatedByUsername
      FROM fueling_logs fl
      LEFT JOIN users cu ON fl.createdByUserId = cu.id
      LEFT JOIN users uu ON fl.updatedByUserId = uu.id
      ${whereSql}
      ORDER BY fl.fuelingDate DESC, fl.createdAt DESC
    `);
    return result.recordset.map((row: any) => ({
      id: row.id.toString(),
      vehicleId: row.vehicleId,
      vehiclePlateNumber: row.vehiclePlateNumber,
      fuelingDate: new Date(row.fuelingDate).toISOString().split('T')[0],
      mileageAtFueling: row.mileageAtFueling,
      quantityLiters: parseFloat(row.quantityLiters),
      costPerLiter: parseFloat(row.costPerLiter),
      totalCost: parseFloat(row.totalCost),
      station: row.station,
      responsible: row.responsible,
      imageUrl: row.imageUrl || undefined,
      fuelEfficiencyKmPerGallon: row.fuelEfficiencyKmPerGallon ? parseFloat(row.fuelEfficiencyKmPerGallon) : undefined,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
      createdByUserId: row.createdByUserId ? row.createdByUserId.toString() : undefined,
      updatedByUserId: row.updatedByUserId ? row.updatedByUserId.toString() : undefined,
      createdByUsername: row.createdByUsername || undefined,
      updatedByUsername: row.updatedByUsername || undefined,
    }));
  } catch (err) {
    console.error(`[SQL Server Error] getFuelingLogsFiltered`, err);
    return [];
  }
}
