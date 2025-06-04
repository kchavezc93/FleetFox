
"use server";

import type { FuelingFormData, FuelingLog } from "@/types";
import { fuelingLogSchema } from "@/lib/zod-schemas";
import { revalidatePath } from "next/cache";
import { getDbClient } from "@/lib/db";
import sql from 'mssql'; // Descomentar si se instala y usa 'mssql'

const LITERS_PER_GALLON = 3.78541;

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
  // PRODUCCIÓN: logger.info({ action: 'createFuelingLog', dbType: dbClient.type, vehicleId: data.vehicleId }, "Attempting to create fueling log");
  
  // --- EJEMPLO DE LÓGICA DE PRODUCCIÓN PARA SQL SERVER (IMPLEMENTACIÓN REAL NECESARIA) ---
  
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) return { message: "Pool de SQL Server no disponible.", success: false };
    
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();

      let vehiclePlateNumber = "N/A";
      let originalVehicleMileage = 0; 
      
      const vehicleRequest = transaction.request(); 
      vehicleRequest.input('vehicleIdForMeta', sql.NVarChar(50), data.vehicleId);
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
      prevLogRequest.input('prev_vehicleId_eff', sql.NVarChar(50), data.vehicleId);
      prevLogRequest.input('prev_fuelingDate_eff', sql.Date, data.fuelingDate); 
      const prevLogResult = await prevLogRequest.query(`
          SELECT TOP 1 mileageAtFueling, quantityLiters 
          FROM fueling_logs 
          WHERE vehicleId = @prev_vehicleId_eff AND fuelingDate < @prev_fuelingDate_eff 
          ORDER BY fuelingDate DESC, createdAt DESC
      `);

      if (prevLogResult.recordset.length > 0) {
          const prevLog = prevLogResult.recordset[0];
          const mileageDifference = data.mileageAtFueling - prevLog.mileageAtFueling;
          const gallonsUsedCurrent = data.quantityLiters / LITERS_PER_GALLON; 
          if (gallonsUsedCurrent > 0 && mileageDifference > 0) {
              fuelEfficiencyKmPerGallon = parseFloat((mileageDifference / gallonsUsedCurrent).toFixed(1));
          }
      }
      
      const logRequest = transaction.request(); 
      logRequest.input('fl_vehicleId', sql.NVarChar(50), data.vehicleId);
      logRequest.input('fl_vehiclePlateNumber', sql.NVarChar(50), vehiclePlateNumber); 
      logRequest.input('fl_fuelingDate', sql.Date, data.fuelingDate); 
      logRequest.input('fl_mileageAtFueling', sql.Int, data.mileageAtFueling);
      logRequest.input('fl_quantityLiters', sql.Decimal(10, 2), data.quantityLiters);
      logRequest.input('fl_costPerLiter', sql.Decimal(10, 2), data.costPerLiter);
      logRequest.input('fl_totalCost', sql.Decimal(10, 2), data.totalCost);
      logRequest.input('fl_station', sql.NVarChar(100), data.station);
      logRequest.input('fl_imageUrl', sql.NVarChar(255), data.imageUrl || null); // Guardar null si no se provee
      logRequest.input('fl_fuelEfficiency', fuelEfficiencyKmPerGallon !== null ? sql.Decimal(10,1) : sql.Decimal(10,1), fuelEfficiencyKmPerGallon);
      
      const result = await logRequest.query(`
          INSERT INTO fueling_logs (
            vehicleId, vehiclePlateNumber, fuelingDate, mileageAtFueling, quantityLiters, 
            costPerLiter, totalCost, station, imageUrl, fuelEfficiencyKmPerGallon, 
            createdAt, updatedAt
          )
          OUTPUT INSERTED.id, INSERTED.createdAt, INSERTED.updatedAt, INSERTED.imageUrl
          VALUES (
            @fl_vehicleId, @fl_vehiclePlateNumber, @fl_fuelingDate, @fl_mileageAtFueling, @fl_quantityLiters,
            @fl_costPerLiter, @fl_totalCost, @fl_station, @fl_imageUrl, @fl_fuelEfficiency,
            GETDATE(), GETDATE()
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
          fuelingDate: data.fuelingDate.toISOString().split('T')[0],
          imageUrl: newDbRecord.imageUrl,
          createdAt: new Date(newDbRecord.createdAt).toISOString(),
          // updatedAt: new Date(newDbRecord.updatedAt).toISOString()
      };

      if (data.mileageAtFueling > originalVehicleMileage) {
          const updateVehicleRequest = transaction.request(); 
          updateVehicleRequest.input('upd_v_id_mileage', sql.NVarChar(50), data.vehicleId);
          updateVehicleRequest.input('upd_v_mileage_val', sql.Int, data.mileageAtFueling);
          await updateVehicleRequest.query('UPDATE vehicles SET currentMileage = @upd_v_mileage_val, updatedAt = GETDATE() WHERE id = @upd_v_id_mileage');
      }
      
      await transaction.commit();
      // PRODUCCIÓN: logger.info({ action: 'createFuelingLog', logId: newLog.id, vehicleId: newLog.vehicleId }, "Fueling log created successfully");
      revalidatePath("/fueling");
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
          id, vehicleId, vehiclePlateNumber, fuelingDate, mileageAtFueling, quantityLiters,
          costPerLiter, totalCost, station, imageUrl, fuelEfficiencyKmPerGallon, createdAt, updatedAt
        FROM fueling_logs 
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
        imageUrl: row.imageUrl,
        fuelEfficiencyKmPerGallon: row.fuelEfficiencyKmPerGallon ? parseFloat(row.fuelEfficiencyKmPerGallon) : undefined,
        createdAt: new Date(row.createdAt).toISOString(),
        // updatedAt: new Date(row.updatedAt).toISOString()
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
            id, vehicleId, vehiclePlateNumber, fuelingDate, mileageAtFueling, quantityLiters,
            costPerLiter, totalCost, station, imageUrl, fuelEfficiencyKmPerGallon, createdAt, updatedAt
          FROM fueling_logs 
          WHERE vehicleId = @targetVehicleId 
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
          imageUrl: row.imageUrl,
          fuelEfficiencyKmPerGallon: row.fuelEfficiencyKmPerGallon ? parseFloat(row.fuelEfficiencyKmPerGallon) : undefined,
          createdAt: new Date(row.createdAt).toISOString(),
          // updatedAt: new Date(row.updatedAt).toISOString()
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
