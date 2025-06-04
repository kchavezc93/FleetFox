
"use server";

import type { Vehicle, VehicleFormData } from "@/types";
import { vehicleSchema } from "@/lib/zod-schemas";
import { revalidatePath } from "next/cache";
import { getDbClient } from "@/lib/db"; 
// import sql from 'mssql'; // Descomentar si se instala y usa 'mssql'
// import bcrypt from 'bcryptjs'; // Para ejemplos de hashing si fuera necesario aquí

// PRODUCCIÓN: Consideraciones Generales para Acciones del Servidor en Producción:
// 1. Logging Estructurado: (ej. Winston, Pino) para logs centralizados.
//    Ej: logger.info({ action: 'createVehicle', plateNumber: data.plateNumber, status: 'attempt' });
// 2. Manejo de Errores Específico: Capturar errores de BD, lógica de negocio.
// 3. Validación de Permisos: Verificar si el usuario autenticado tiene permisos (requiere sistema de autenticación).
// 4. Transacciones de Base de Datos: Para operaciones de múltiples escrituras (ej. crear un log y actualizar el vehículo).
// 5. Pruebas exhaustivas: Unitarias, de integración y end-to-end.

export async function createVehicle(formData: VehicleFormData) {
  const validatedFields = vehicleSchema.safeParse(formData);

  if (!validatedFields.success) {
    // PRODUCCIÓN: logger.warn({ action: 'createVehicle', validationErrors: validatedFields.error.flatten().fieldErrors }, "Validation failed");
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Datos de formulario inválidos.",
      success: false,
    };
  }

  const dbClient = await getDbClient();
  if (!dbClient) {
    console.error("[Create Vehicle Error] Configuración de BD no encontrada.");
    // PRODUCCIÓN: logger.error({ action: 'createVehicle', reason: 'DB config not found' });
    return { 
      message: "Error: Configuración de base de datos no encontrada o inválida. No se pudo crear el vehículo. Por favor, revise la página de Configuración.", 
      errors: { form: "Configuración de BD requerida." },
      success: false,
    };
  }
  
  const data = validatedFields.data;
  // PRODUCCIÓN: logger.info({ action: 'createVehicle', dbType: dbClient.type, plateNumber: data.plateNumber }, "Attempting to create vehicle");

  // --- EJEMPLO DE LÓGICA DE SQL SERVER (IMPLEMENTACIÓN REAL NECESARIA) ---
  /*
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) {
      // PRODUCCIÓN: logger.error({ action: 'createVehicle', reason: 'SQL Server pool not available' });
      return { message: "Pool de SQL Server no disponible. Verifique configuración.", success: false, errors: { form: "Error de conexión BD." } };
    }
    
    try {
      const request = pool.request();
      // Se genera una URL de imagen de marcador de posición. En producción, esto podría ser null
      // o gestionarse a través de un sistema de subida de archivos.
      const imageUrl = `https://placehold.co/600x400.png?text=${encodeURIComponent(data.brand + ' ' + data.model)}`;
      
      // Verificar si ya existe un vehículo con la misma matrícula o VIN para evitar duplicados.
      // Esto debe hacerse ANTES de intentar la inserción.
      request.input('checkPlateNumber', sql.NVarChar(50), data.plateNumber);
      request.input('checkVin', sql.NVarChar(50), data.vin);
      const checkResult = await request.query('SELECT id FROM vehicles WHERE plateNumber = @checkPlateNumber OR vin = @checkVin');

      if (checkResult.recordset.length > 0) {
        const errors: Record<string, string> = {};
        if (checkResult.recordset.some(v => v.plateNumber === data.plateNumber)) {
          errors.plateNumber = "Esta matrícula ya está registrada.";
        }
        if (checkResult.recordset.some(v => v.vin === data.vin)) {
          errors.vin = "Este VIN ya está registrado.";
        }
        // PRODUCCIÓN: logger.warn({ action: 'createVehicle', plateNumber: data.plateNumber, vin: data.vin, reason: 'Duplicate plate/VIN' }, "Attempt to create duplicate vehicle");
        return { success: false, message: "La matrícula o VIN ya existen.", errors };
      }
      
      // Limpiar inputs para la inserción o usar una nueva request
      const insertRequest = pool.request(); 
      insertRequest.input('plateNumber_ins', sql.NVarChar(50), data.plateNumber);
      insertRequest.input('vin_ins', sql.NVarChar(50), data.vin);
      insertRequest.input('brand_ins', sql.NVarChar(100), data.brand);
      insertRequest.input('model_ins', sql.NVarChar(100), data.model);
      insertRequest.input('year_ins', sql.Int, data.year);
      insertRequest.input('fuelType_ins', sql.NVarChar(50), data.fuelType);
      insertRequest.input('currentMileage_ins', sql.Int, data.currentMileage);
      insertRequest.input('nextPreventiveMaintenanceMileage_ins', sql.Int, data.nextPreventiveMaintenanceMileage);
      insertRequest.input('nextPreventiveMaintenanceDate_ins', sql.Date, data.nextPreventiveMaintenanceDate);
      insertRequest.input('status_ins', sql.NVarChar(50), data.status);
      insertRequest.input('imageUrl_ins', sql.NVarChar(255), imageUrl);
      // createdAt y updatedAt se manejan con GETDATE() en la consulta SQL.
      const result = await insertRequest.query(\`
        INSERT INTO vehicles (
          plateNumber, vin, brand, model, year, fuelType, currentMileage, 
          nextPreventiveMaintenanceMileage, nextPreventiveMaintenanceDate, status, 
          createdAt, updatedAt, imageUrl
        )
        OUTPUT INSERTED.id, INSERTED.createdAt, INSERTED.updatedAt, INSERTED.imageUrl 
        VALUES (
          @plateNumber_ins, @vin_ins, @brand_ins, @model_ins, @year_ins, @fuelType_ins, @currentMileage_ins, 
          @nextPreventiveMaintenanceMileage_ins, @nextPreventiveMaintenanceDate_ins, @status_ins, 
          GETDATE(), GETDATE(), @imageUrl_ins
        );
      \`);
      
      if (result.recordset.length === 0 || !result.recordset[0].id) {
        // PRODUCCIÓN: logger.error({ action: 'createVehicle', data }, "Failed to create vehicle, no ID returned from DB");
        throw new Error("Fallo al crear el vehículo, la base de datos no devolvió un ID.");
      }
      const newDbRecord = result.recordset[0];
      const newVehicle: Vehicle = { 
        id: newDbRecord.id.toString(), 
        ...data, 
        nextPreventiveMaintenanceDate: data.nextPreventiveMaintenanceDate.toISOString().split('T')[0], // Asegurar formato YYYY-MM-DD
        createdAt: new Date(newDbRecord.createdAt).toISOString(), 
        updatedAt: new Date(newDbRecord.updatedAt).toISOString(), 
        imageUrl: newDbRecord.imageUrl 
      };
      
      // PRODUCCIÓN: logger.info({ action: 'createVehicle', vehicleId: newVehicle.id, plateNumber: newVehicle.plateNumber }, "Vehicle created successfully");
      revalidatePath("/vehicles"); // Revalida el caché de la página de lista de vehículos.
      return { message: \`Vehículo \${newVehicle.plateNumber} creado exitosamente.\`, vehicle: newVehicle, success: true };
    } catch (error) {
      // PRODUCCIÓN: logger.error({ action: 'createVehicle', data, error: (error as Error).message, stack: (error as Error).stack }, "Error creating vehicle in SQL Server");
      console.error(\`[SQL Server Error] Error al crear vehículo:\`, error);
      return { 
        message: \`Error al crear vehículo. Verifique los datos e inténtelo de nuevo. Detalles: \${(error as Error).message}\`, 
        errors: { form: "Error de base de datos al crear." }, 
        success: false 
      };
    }
  } else {
    // PRODUCCIÓN: logger.warn({ action: 'createVehicle', dbType: dbClient.type, reason: 'DB type not implemented' });
    console.warn(\`[Create Vehicle] La creación de vehículos no está implementada para el tipo de BD: \${dbClient.type}. Por favor, implemente la lógica SQL.\`);
    return { 
      message: \`Creación de vehículo (${data.plateNumber}) pendiente de implementación SQL para ${dbClient.type}.`, 
      vehicle: null,
      success: false,
      errors: { form: \`Implementación SQL pendiente para \${dbClient.type}.\` },
    };
  }
  */
  
  // Bloque de marcador de posición si la lógica SQL está comentada o no implementada
  console.log(`[Create Vehicle] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Vehículo no creado.`);
  return { 
    message: `Creación de vehículo (${data.plateNumber}) pendiente de implementación SQL para ${dbClient.type}.`, 
    vehicle: null,
    success: false,
    errors: { form: `Implementación SQL pendiente para ${dbClient.type}.` },
  };
}

export async function updateVehicle(id: string, formData: VehicleFormData) {
  const validatedFields = vehicleSchema.safeParse(formData);

  if (!validatedFields.success) {
    // PRODUCCIÓN: logger.warn({ action: 'updateVehicle', vehicleId: id, validationErrors: validatedFields.error.flatten().fieldErrors }, "Validation failed");
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Datos de formulario inválidos.",
      success: false,
    };
  }
  
  const dbClient = await getDbClient();
  if (!dbClient) {
     console.error(`[Update Vehicle Error] ID: ${id}. Configuración de BD no encontrada.`);
     // PRODUCCIÓN: logger.error({ action: 'updateVehicle', vehicleId: id, reason: 'DB config not found' });
     return { 
      message: "Error: Configuración de base de datos no encontrada o inválida. No se pudo actualizar el vehículo. Por favor, revise la página de Configuración.", 
      errors: { form: "Configuración de BD requerida." },
      success: false,
    };
  }
  
  const data = validatedFields.data;
  // PRODUCCIÓN: logger.info({ action: 'updateVehicle', dbType: dbClient.type, vehicleId: id }, "Attempting to update vehicle");

  // --- EJEMPLO DE LÓGICA DE SQL SERVER (IMPLEMENTACIÓN REAL NECESARIA) ---
  /*
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) {
      // PRODUCCIÓN: logger.error({ action: 'updateVehicle', vehicleId: id, reason: 'SQL Server pool not available' });
      return { message: "Pool de SQL Server no disponible. Verifique configuración.", success: false, errors: { form: "Error de conexión BD." } };
    }

    try {
      const request = pool.request();
      
      // Verificar si ya existe OTRO vehículo con la misma matrícula o VIN
      request.input('currentId_chk', sql.NVarChar(50), id);
      request.input('checkPlateNumber_upd', sql.NVarChar(50), data.plateNumber);
      request.input('checkVin_upd', sql.NVarChar(50), data.vin);
      const checkResult = await request.query('SELECT id FROM vehicles WHERE (plateNumber = @checkPlateNumber_upd OR vin = @checkVin_upd) AND id <> @currentId_chk');

      if (checkResult.recordset.length > 0) {
        const errors: Record<string, string> = {};
        if (checkResult.recordset.some(v => v.plateNumber === data.plateNumber)) {
          errors.plateNumber = "Esta matrícula ya está registrada para otro vehículo.";
        }
        if (checkResult.recordset.some(v => v.vin === data.vin)) {
          errors.vin = "Este VIN ya está registrado para otro vehículo.";
        }
        // PRODUCCIÓN: logger.warn({ action: 'updateVehicle', vehicleId: id, plateNumber: data.plateNumber, vin: data.vin, reason: 'Duplicate plate/VIN on update' }, "Attempt to update vehicle to duplicate plate/VIN");
        return { success: false, message: "La matrícula o VIN ya existen para otro vehículo.", errors };
      }
      
      const updateRequest = pool.request();
      updateRequest.input('id_upd', sql.NVarChar(50), id); 
      updateRequest.input('plateNumber_upd_val', sql.NVarChar(50), data.plateNumber);
      updateRequest.input('vin_upd_val', sql.NVarChar(50), data.vin);
      updateRequest.input('brand_upd_val', sql.NVarChar(100), data.brand);
      updateRequest.input('model_upd_val', sql.NVarChar(100), data.model);
      updateRequest.input('year_upd_val', sql.Int, data.year);
      updateRequest.input('fuelType_upd_val', sql.NVarChar(50), data.fuelType);
      updateRequest.input('currentMileage_upd_val', sql.Int, data.currentMileage);
      updateRequest.input('nextPreventiveMaintenanceMileage_upd_val', sql.Int, data.nextPreventiveMaintenanceMileage);
      updateRequest.input('nextPreventiveMaintenanceDate_upd_val', sql.Date, data.nextPreventiveMaintenanceDate);
      updateRequest.input('status_upd_val', sql.NVarChar(50), data.status);
      // No actualizamos imageUrl aquí a menos que se provea un mecanismo para cambiarla.
      // updatedAt se maneja con GETDATE() en la consulta SQL.
      const result = await updateRequest.query(\`
        UPDATE vehicles 
        SET 
          plateNumber = @plateNumber_upd_val, 
          vin = @vin_upd_val, 
          brand = @brand_upd_val, 
          model = @model_upd_val, 
          year = @year_upd_val, 
          fuelType = @fuelType_upd_val, 
          currentMileage = @currentMileage_upd_val, 
          nextPreventiveMaintenanceMileage = @nextPreventiveMaintenanceMileage_upd_val, 
          nextPreventiveMaintenanceDate = @nextPreventiveMaintenanceDate_upd_val, 
          status = @status_upd_val, 
          updatedAt = GETDATE()
        OUTPUT INSERTED.id, INSERTED.plateNumber, INSERTED.vin, INSERTED.brand, INSERTED.model, INSERTED.year, INSERTED.fuelType, INSERTED.currentMileage, INSERTED.nextPreventiveMaintenanceMileage, INSERTED.nextPreventiveMaintenanceDate, INSERTED.status, INSERTED.createdAt, INSERTED.updatedAt, INSERTED.imageUrl
        WHERE id = @id_upd;
      \`);

      if (result.recordset.length === 0) {
        // PRODUCCIÓN: logger.warn({ action: 'updateVehicle', vehicleId: id, reason: 'Not found or no changes' }, "Vehicle not found for update or no changes made");
        return { message: "Vehículo no encontrado para actualizar o no se realizaron cambios.", errors: { form: "ID de vehículo no válido o sin cambios." }, success: false };
      }
      const updatedDbRecord = result.recordset[0];
      const updatedVehicle: Vehicle = { 
        id: updatedDbRecord.id.toString(),
        plateNumber: updatedDbRecord.plateNumber,
        vin: updatedDbRecord.vin,
        brand: updatedDbRecord.brand,
        model: updatedDbRecord.model,
        year: updatedDbRecord.year,
        fuelType: updatedDbRecord.fuelType,
        currentMileage: updatedDbRecord.currentMileage,
        nextPreventiveMaintenanceMileage: updatedDbRecord.nextPreventiveMaintenanceMileage,
        nextPreventiveMaintenanceDate: new Date(updatedDbRecord.nextPreventiveMaintenanceDate).toISOString().split('T')[0], // Asegurar formato YYYY-MM-DD
        status: updatedDbRecord.status,
        createdAt: new Date(updatedDbRecord.createdAt).toISOString(), 
        updatedAt: new Date(updatedDbRecord.updatedAt).toISOString(),
        imageUrl: updatedDbRecord.imageUrl 
      };
      
      // PRODUCCIÓN: logger.info({ action: 'updateVehicle', vehicleId: id }, "Vehicle updated successfully");
      revalidatePath("/vehicles");
      revalidatePath(\`/vehicles/\${id}\`);
      revalidatePath(\`/vehicles/\${id}/edit\`);
      return { message: \`Vehículo \${updatedVehicle.plateNumber} actualizado exitosamente.\`, vehicle: updatedVehicle, success: true };
    } catch (error) {
      // PRODUCCIÓN: logger.error({ action: 'updateVehicle', vehicleId: id, error: (error as Error).message, stack: (error as Error).stack }, "Error updating vehicle in SQL Server");
      console.error(\`[SQL Server Error] Error al actualizar vehículo ${id}:\`, error);
      return { 
        message: \`Error al actualizar vehículo. Detalles: \${(error as Error).message}\`, 
        errors: { form: "Error de base de datos al actualizar." }, 
        success: false 
      };
    }
  } else {
    // PRODUCCIÓN: logger.warn({ action: 'updateVehicle', vehicleId: id, dbType: dbClient.type, reason: 'DB type not implemented' });
    console.warn(\`[Update Vehicle] La actualización de vehículos no está implementada para el tipo de BD: \${dbClient.type}.\`);
    return { 
      message: \`La actualización de vehículos no está implementada para el tipo de BD: \${dbClient.type}. Por favor, implemente la lógica SQL.\`, 
      errors: { form: "Tipo de BD no soportado para esta acción." },
      success: false,
    };
  }
  */
  
  // Bloque de marcador de posición si la lógica SQL está comentada o no implementada
  console.log(`[Update Vehicle] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Vehículo ID: ${id} no actualizado.`);
  return { 
    message: `Actualización de vehículo ID ${id} pendiente de implementación SQL para ${dbClient.type}.`, 
    vehicle: null,
    success: false,
    errors: { form: `Implementación SQL pendiente para ${dbClient.type}.` },
  };
}

export async function deleteVehicle(id: string) { // This action marks as inactive
  const dbClient = await getDbClient();
  if (!dbClient) {
    console.error(`[Delete Vehicle Error] ID: ${id}. Configuración de BD no encontrada.`);
    // PRODUCCIÓN: logger.error({ action: 'deleteVehicle', vehicleId: id, reason: 'DB config not found' });
    return { 
      message: "Error: Configuración de base de datos no encontrada. No se pudo marcar como inactivo el vehículo.", 
      success: false 
    };
  }
  // PRODUCCIÓN: logger.info({ action: 'deleteVehicle', dbType: dbClient.type, vehicleId: id }, "Attempting to mark vehicle as inactive (soft delete)");

  // --- EJEMPLO DE LÓGICA DE SQL SERVER (IMPLEMENTACIÓN REAL NECESARIA) ---
  /*
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) {
      // PRODUCCIÓN: logger.error({ action: 'deleteVehicle', vehicleId: id, reason: 'SQL Server pool not available' });
      return { message: "Pool de SQL Server no disponible. Verifique configuración.", success: false };
    }

    try {
      const request = pool.request();
      request.input('id_del', sql.NVarChar(50), id);
      // Esta es una "soft delete", solo cambia el estado.
      const result = await request.query(\`UPDATE vehicles SET status = 'Inactivo', updatedAt = GETDATE() WHERE id = @id_del;\`);
      
      if (result.rowsAffected[0] === 0) {
        // PRODUCCIÓN: logger.warn({ action: 'deleteVehicle', vehicleId: id, reason: 'Not found for deactivation' }, "Vehicle not found to mark as inactive");
        return { message: \`Vehículo ID: \${id} no encontrado para marcar como inactivo.\`, success: false };
      }
      // PRODUCCIÓN: logger.info({ action: 'deleteVehicle', vehicleId: id, status: 'marked_inactive' }, "Vehicle marked as inactive");
      revalidatePath("/vehicles");
      revalidatePath(\`/vehicles/\${id}\`);
      return { message: \`Vehículo \${id} marcado como inactivo exitosamente.\`, success: true };
    } catch (error) {
      // PRODUCCIÓN: logger.error({ action: 'deleteVehicle', vehicleId: id, error: (error as Error).message, stack: (error as Error).stack }, "Error marking vehicle as inactive in SQL Server");
      console.error(\`[SQL Server Error] Error al marcar como inactivo vehículo ${id}:\`, error);
      return { message: \`Error al marcar vehículo como inactivo. Detalles: \${(error as Error).message}\`, success: false };
    }
  } else {
    // PRODUCCIÓN: logger.warn({ action: 'deleteVehicle', vehicleId: id, dbType: dbClient.type, reason: 'DB type not implemented' });
    console.warn(\`[Delete Vehicle] La desactivación de vehículos no está implementada para el tipo de BD: \${dbClient.type}.\`);
    return { 
      message: \`La desactivación de vehículos no está implementada para el tipo de BD: \${dbClient.type}. Por favor, implemente la lógica SQL.\`, 
      success: false 
    };
  }
  */
  
  // Bloque de marcador de posición si la lógica SQL está comentada o no implementada
  console.log(`[Delete Vehicle] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Vehículo ID: ${id} no marcado como inactivo.`);
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}`);
  return { 
    message: `Marcar vehículo ID ${id} como inactivo pendiente de implementación SQL para ${dbClient.type}. (Simulado, revalidando rutas)`, 
    success: true // Simular éxito para que la UI se actualice
  };
}

export async function activateVehicle(id: string) {
  const dbClient = await getDbClient();
  if (!dbClient) {
    console.error(`[Activate Vehicle Error] ID: ${id}. Configuración de BD no encontrada.`);
    // PRODUCCIÓN: logger.error({ action: 'activateVehicle', vehicleId: id, reason: 'DB config not found' });
    return { 
      message: "Error: Configuración de base de datos no encontrada. No se pudo activar el vehículo.", 
      success: false 
    };
  }
  // PRODUCCIÓN: logger.info({ action: 'activateVehicle', dbType: dbClient.type, vehicleId: id }, "Attempting to activate vehicle");

  // --- EJEMPLO DE LÓGICA DE SQL SERVER (IMPLEMENTACIÓN REAL NECESARIA) ---
  /*
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) {
      // PRODUCCIÓN: logger.error({ action: 'activateVehicle', vehicleId: id, reason: 'SQL Server pool not available' });
      return { message: "Pool de SQL Server no disponible. Verifique configuración.", success: false };
    }

    try {
      const request = pool.request();
      request.input('id_act', sql.NVarChar(50), id);
      const result = await request.query(\`UPDATE vehicles SET status = 'Activo', updatedAt = GETDATE() WHERE id = @id_act;\`);

      if (result.rowsAffected[0] === 0) {
        // PRODUCCIÓN: logger.warn({ action: 'activateVehicle', vehicleId: id, reason: 'Not found for activation' }, "Vehicle not found to activate");
        return { message: \`Vehículo ID: \${id} no encontrado para activar.\`, success: false };
      }
      // PRODUCCIÓN: logger.info({ action: 'activateVehicle', vehicleId: id, status: 'activated' }, "Vehicle activated");
      revalidatePath("/vehicles");
      revalidatePath(\`/vehicles/\${id}\`);
      return { message: \`Vehículo \${id} activado exitosamente.\`, success: true };
    } catch (error) {
      // PRODUCCIÓN: logger.error({ action: 'activateVehicle', vehicleId: id, error: (error as Error).message, stack: (error as Error).stack }, "Error activating vehicle in SQL Server");
      console.error(\`[SQL Server Error] Error al activar vehículo ${id}:\`, error);
      return { message: \`Error al activar vehículo. Detalles: \${(error as Error).message}\`, success: false };
    }
  } else {
    // PRODUCCIÓN: logger.warn({ action: 'activateVehicle', vehicleId: id, dbType: dbClient.type, reason: 'DB type not implemented' });
    console.warn(\`[Activate Vehicle] La activación de vehículos no está implementada para el tipo de BD: \${dbClient.type}.\`);
    return { 
      message: \`La activación de vehículos no está implementada para el tipo de BD: \${dbClient.type}. Por favor, implemente la lógica SQL.\`, 
      success: false 
    };
  }
  */
  
  // Bloque de marcador de posición si la lógica SQL está comentada o no implementada
  console.log(`[Activate Vehicle] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Vehículo ID: ${id} no activado.`);
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}`);
  return { 
    message: `Activación de vehículo ID ${id} pendiente de implementación SQL para ${dbClient.type}. (Simulado, revalidando rutas)`, 
    success: true // Simular éxito para que la UI se actualice
  };
}

export async function getVehicles(): Promise<Vehicle[]> {
  const dbClient = await getDbClient();
  if (!dbClient) {
    console.warn("getVehicles: Configuración de BD no encontrada. Devolviendo lista vacía.");
    // PRODUCCIÓN: logger.error({ action: 'getVehicles', reason: 'DB config not found' });
    return [];
  }
  // PRODUCCIÓN: logger.info({ action: 'getVehicles', dbType: dbClient.type }, "Attempting to fetch all vehicles");
  
  // --- EJEMPLO DE LÓGICA DE SQL SERVER (IMPLEMENTACIÓN REAL NECESARIA) ---
  /*
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) {
      // PRODUCCIÓN: logger.error({ action: 'getVehicles', reason: 'SQL Server pool not available' });
      console.error("getVehicles: Pool de SQL Server no disponible.");
      return [];
    }
    try {
      const request = pool.request();
      // PRODUCCIÓN: Considerar paginación para grandes cantidades de datos.
      // SELECT * FROM vehicles ORDER BY createdAt DESC OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY;
      const result = await request.query("SELECT id, plateNumber, vin, brand, model, year, fuelType, currentMileage, nextPreventiveMaintenanceMileage, nextPreventiveMaintenanceDate, status, createdAt, updatedAt, imageUrl FROM vehicles ORDER BY createdAt DESC");
      
      return result.recordset.map(row => ({ 
        id: row.id.toString(),
        plateNumber: row.plateNumber,
        vin: row.vin,
        brand: row.brand,
        model: row.model,
        year: row.year,
        fuelType: row.fuelType,
        currentMileage: row.currentMileage,
        nextPreventiveMaintenanceMileage: row.nextPreventiveMaintenanceMileage,
        nextPreventiveMaintenanceDate: row.nextPreventiveMaintenanceDate ? new Date(row.nextPreventiveMaintenanceDate).toISOString().split('T')[0] : "", // Asegurar formato YYYY-MM-DD
        status: row.status,
        createdAt: new Date(row.createdAt).toISOString(),
        updatedAt: new Date(row.updatedAt).toISOString(),
        imageUrl: row.imageUrl
      })) as Vehicle[];
    } catch (error) {
      // PRODUCCIÓN: logger.error({ action: 'getVehicles', error: (error as Error).message, stack: (error as Error).stack }, "Error fetching vehicles from SQL Server");
      console.error(\`[SQL Server Error] Error al obtener vehículos:\`, error);
      return []; // Devolver vacío en caso de error para no romper la UI
    }
  } else {
    // PRODUCCIÓN: logger.warn({ action: 'getVehicles', dbType: dbClient.type, reason: 'DB type not implemented' });
    console.warn(\`[Get Vehicles] La obtención de vehículos no está implementada para el tipo de BD: \${dbClient.type}.\`);
    return [];
  }
  */
  
  // Bloque de marcador de posición si la lógica SQL está comentada o no implementada
  console.log(`[Get Vehicles] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Devolviendo lista vacía.`);
  return [];
}

export async function getVehicleById(id: string): Promise<Vehicle | null> {
  const dbClient = await getDbClient();
  if (!dbClient) {
    console.warn(`getVehicleById(${id}): Configuración de BD no encontrada. Devolviendo null.`);
    // PRODUCCIÓN: logger.error({ action: 'getVehicleById', vehicleId: id, reason: 'DB config not found' });
    return null;
  }
  // PRODUCCIÓN: logger.info({ action: 'getVehicleById', dbType: dbClient.type, vehicleId: id }, "Attempting to fetch vehicle by ID");

  // --- EJEMPLO DE LÓGICA DE SQL SERVER (IMPLEMENTACIÓN REAL NECESARIA) ---
  /*
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
     if (!pool) {
      // PRODUCCIÓN: logger.error({ action: 'getVehicleById', vehicleId: id, reason: 'SQL Server pool not available' });
      console.error("getVehicleById: Pool de SQL Server no disponible.");
      return null;
    }
    try {
      const request = pool.request();
      request.input('idToFind_get', sql.NVarChar(50), id); 
      const result = await request.query("SELECT id, plateNumber, vin, brand, model, year, fuelType, currentMileage, nextPreventiveMaintenanceMileage, nextPreventiveMaintenanceDate, status, createdAt, updatedAt, imageUrl FROM vehicles WHERE id = @idToFind_get");
      
      if (result.recordset.length > 0) {
        const row = result.recordset[0];
        return { 
          id: row.id.toString(),
          plateNumber: row.plateNumber,
          vin: row.vin,
          brand: row.brand,
          model: row.model,
          year: row.year,
          fuelType: row.fuelType,
          currentMileage: row.currentMileage,
          nextPreventiveMaintenanceMileage: row.nextPreventiveMaintenanceMileage,
          nextPreventiveMaintenanceDate: row.nextPreventiveMaintenanceDate ? new Date(row.nextPreventiveMaintenanceDate).toISOString().split('T')[0] : "", // Asegurar formato YYYY-MM-DD
          status: row.status,
          createdAt: new Date(row.createdAt).toISOString(),
          updatedAt: new Date(row.updatedAt).toISOString(),
          imageUrl: row.imageUrl
        } as Vehicle;
      }
      // PRODUCCIÓN: logger.warn({ action: 'getVehicleById', vehicleId: id, reason: 'Not found' }, "Vehicle not found by ID");
      return null; // Vehículo no encontrado
    } catch (error) {
      // PRODUCCIÓN: logger.error({ action: 'getVehicleById', vehicleId: id, error: (error as Error).message, stack: (error as Error).stack }, "Error fetching vehicle by ID from SQL Server");
      console.error(\`[SQL Server Error] Error al obtener vehículo por ID ${id}:\`, error);
      return null; // Devolver null en caso de error
    }
  } else {
    // PRODUCCIÓN: logger.warn({ action: 'getVehicleById', vehicleId: id, dbType: dbClient.type, reason: 'DB type not implemented' });
    console.warn(\`[Get Vehicle By ID] La obtención de vehículo por ID no está implementada para el tipo de BD: \${dbClient.type}.\`);
    return null;
  }
  */
  
  // Bloque de marcador de posición si la lógica SQL está comentada o no implementada
  console.log(`[Get Vehicle By ID] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Vehículo ID: ${id}. Devolviendo null.`);
  return null;
}

// Nueva función para obtener el conteo de mantenimientos próximos para el dashboard
export async function getUpcomingMaintenanceCount(): Promise<number> {
  const dbClient = await getDbClient();
  if (!dbClient) {
    console.warn("getUpcomingMaintenanceCount: Configuración de BD no encontrada. Devolviendo 0.");
    // PRODUCCIÓN: logger.error({ action: 'getUpcomingMaintenanceCount', reason: 'DB config not found' });
    return 0;
  }
  // PRODUCCIÓN: logger.info({ action: 'getUpcomingMaintenanceCount', dbType: dbClient.type }, "Attempting to fetch upcoming maintenance count");

  // --- EJEMPLO DE LÓGICA DE SQL SERVER (IMPLEMENTACIÓN REAL NECESARIA) ---
  /*
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) {
      // PRODUCCIÓN: logger.error({ action: 'getUpcomingMaintenanceCount', reason: 'SQL Server pool not available' });
      console.error("getUpcomingMaintenanceCount: Pool de SQL Server no disponible.");
      return 0;
    }
    try {
      const request = pool.request();
      const DAYS_THRESHOLD = 7; // Mantenimiento en los próximos 7 días
      const MILEAGE_THRESHOLD = 1000; // Mantenimiento en los próximos 1000 km

      // No es necesario pasar los umbrales como parámetros SQL si son constantes aquí,
      // pero si fueran dinámicos, sí lo harías con request.input().
      // Para DATEDIFF, GETDATE() obtiene la fecha actual del servidor SQL.
      const query = \`
        SELECT COUNT(*) AS upcomingCount
        FROM vehicles
        WHERE status = 'Activo' AND (
          (nextPreventiveMaintenanceDate IS NOT NULL AND DATEDIFF(day, GETDATE(), nextPreventiveMaintenanceDate) BETWEEN 0 AND ${DAYS_THRESHOLD})
          OR
          (nextPreventiveMaintenanceMileage IS NOT NULL AND currentMileage IS NOT NULL AND (nextPreventiveMaintenanceMileage - currentMileage) BETWEEN 0 AND ${MILEAGE_THRESHOLD})
        )
      \`;
      const result = await request.query(query);
      
      return result.recordset[0]?.upcomingCount || 0;
    } catch (error) {
      // PRODUCCIÓN: logger.error({ action: 'getUpcomingMaintenanceCount', error: (error as Error).message, stack: (error as Error).stack }, "Error fetching upcoming maintenance count");
      console.error('[SQL Server Error] Error al obtener conteo de mantenimientos próximos:', error);
      return 0;
    }
  } else {
    // PRODUCCIÓN: logger.warn({ action: 'getUpcomingMaintenanceCount', dbType: dbClient.type, reason: 'DB type not implemented' });
    console.warn(\`[Get Upcoming Maintenance Count] La obtención de conteo no está implementada para el tipo de BD: \${dbClient.type}.\`);
    return 0;
  }
  */

  // Bloque de marcador de posición si la lógica SQL está comentada o no implementada
  console.log(`[Get Upcoming Maintenance Count] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Devolviendo 0.`);
  return 0;
}
