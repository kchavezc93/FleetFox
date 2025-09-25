
"use server";

import type { MaintenanceFormData, MaintenanceLog, AttachedDocument, NewAttachmentPayload } from "@/types";
import { maintenanceLogSchema } from "@/lib/zod-schemas";
import { revalidatePath } from "next/cache";
import { redirect } from 'next/navigation';
import { getDbClient } from "@/lib/db";
import sql from 'mssql'; // Descomentar si se instala y usa 'mssql': npm install mssql
import { getCurrentUser } from "@/lib/auth/session";

// PRODUCCIÓN: Consideraciones Generales para Acciones del Servidor en Producción:
// 1. Logging Estructurado: Reemplazar `console.log/warn/error` con un logger estructurado.
// 2. Manejo de Errores Específico: Capturar errores de BD y lógica de negocio.
// 3. Validación de Permisos: Verificar si el usuario autenticado tiene los permisos necesarios.
// 4. Transacciones de Base de Datos: Usar transacciones para operaciones de múltiples escrituras.
// 5. Pruebas exhaustivas: Pruebas unitarias, de integración y end-to-end.

export async function createMaintenanceLog(formData: MaintenanceFormData) {
  const validatedFields = maintenanceLogSchema.safeParse(formData);

  if (!validatedFields.success) {
    // PRODUCCIÓN: logger.warn({ action: 'createMaintenanceLog', validationErrors: validatedFields.error.flatten().fieldErrors }, "Validation failed");
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Datos de formulario inválidos.",
      success: false,
    };
  }
  
  const dbClient = await getDbClient();
  if (!dbClient) {
    console.error("[Create Maintenance Log Error] Configuración de BD no encontrada.");
    return { 
      message: "Error: Configuración de base de datos no encontrada. No se pudo crear el registro. Por favor, revise la página de Configuración.", 
      errors: { form: "Configuración de BD requerida." }, 
      success: false 
    };
  }
  const data = validatedFields.data;
  
  // PRODUCCIÓN: logger.info({ action: 'createMaintenanceLog', dbType: dbClient.type, vehicleId: data.vehicleId }, "Attempting to create maintenance log");
  
  // --- Ejemplo de Implementación para SQL Server ---
  // 1. Asegúrate de haber instalado 'mssql': npm install mssql
  // 2. Configura la conexión real en src/lib/db.ts y descomenta la lógica de conexión para SQLServer.
  // 3. Adapta los nombres de tabla/columna y tipos de datos SQL a tu esquema de BD.
  
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool; 
    if (!pool) {
      return { message: "Pool de SQL Server no disponible. Verifique la configuración de la base de datos.", success: false, errors: { form: "Error de conexión a BD."} };
    }
    
    const transaction = new sql.Transaction(pool);
    try {
      const currentUser = await getCurrentUser();
      const userIdInt = currentUser ? parseInt(currentUser.id, 10) : null;
      await transaction.begin(); 

      // Obtener plateNumber del vehículo para denormalización (opcional, pero simplifica listados)
      let vehiclePlateNumber = "N/A";
  const vehicleRequest = transaction.request(); 
  vehicleRequest.input('vehicleIdForMeta', sql.Int, parseInt(data.vehicleId as unknown as string, 10));
      const vehicleResult = await vehicleRequest.query('SELECT plateNumber, currentMileage, nextPreventiveMaintenanceMileage, nextPreventiveMaintenanceDate FROM vehicles WHERE id = @vehicleIdForMeta');
      
      if (vehicleResult.recordset.length > 0) {
          vehiclePlateNumber = vehicleResult.recordset[0].plateNumber;
      } else {
          await transaction.rollback();
          // PRODUCCIÓN: logger.warn({ action: 'createMaintenanceLog', vehicleId: data.vehicleId, reason: "Vehicle not found for association" });
          return { message: "Vehículo asociado no encontrado. No se puede crear el registro de mantenimiento.", errors: { vehicleId: "ID de vehículo no válido." }, success: false };
      }
      
      // Insertar el registro de mantenimiento principal
  const logRequest = transaction.request(); 
  logRequest.input('ml_vehicleId', sql.Int, parseInt(data.vehicleId as unknown as string, 10));
      logRequest.input('ml_vehiclePlateNumber', sql.NVarChar(50), vehiclePlateNumber); 
      logRequest.input('ml_maintenanceType', sql.NVarChar(50), data.maintenanceType);
      logRequest.input('ml_executionDate', sql.Date, data.executionDate);
      logRequest.input('ml_mileageAtService', sql.Int, data.mileageAtService);
      logRequest.input('ml_activitiesPerformed', sql.NVarChar(sql.MAX), data.activitiesPerformed);
      logRequest.input('ml_cost', sql.Decimal(10, 2), data.cost);
      logRequest.input('ml_provider', sql.NVarChar(100), data.provider);
      logRequest.input('ml_nextMaintenanceDateScheduled', sql.Date, data.nextMaintenanceDateScheduled);
      logRequest.input('ml_nextMaintenanceMileageScheduled', sql.Int, data.nextMaintenanceMileageScheduled);
      
      const resultLog = await logRequest.query(`
        INSERT INTO maintenance_logs (
          vehicleId, vehiclePlateNumber, maintenanceType, executionDate, mileageAtService, 
          activitiesPerformed, cost, provider, nextMaintenanceDateScheduled, 
          nextMaintenanceMileageScheduled, createdByUserId, updatedByUserId, createdAt, updatedAt
        )
        OUTPUT INSERTED.id, INSERTED.createdAt, INSERTED.updatedAt
        VALUES (
          @ml_vehicleId, @ml_vehiclePlateNumber, @ml_maintenanceType, @ml_executionDate, @ml_mileageAtService,
          @ml_activitiesPerformed, @ml_cost, @ml_provider, @ml_nextMaintenanceDateScheduled,
          @ml_nextMaintenanceMileageScheduled, ${userIdInt !== null ? userIdInt : 'NULL'}, ${userIdInt !== null ? userIdInt : 'NULL'}, GETDATE(), GETDATE()
        );
      `);
        
      if (resultLog.recordset.length === 0 || !resultLog.recordset[0].id) {
        await transaction.rollback();
        // PRODUCCIÓN: logger.error({ action: 'createMaintenanceLog', data, reason: 'No ID returned from DB for maintenance_log' });
        throw new Error("Fallo al crear el registro de mantenimiento, la base de datos no devolvió un ID.");
      }
      const newLogId = resultLog.recordset[0].id.toString();
      const newLogCreatedAt = new Date(resultLog.recordset[0].createdAt).toISOString();
      const newLogUpdatedAt = new Date(resultLog.recordset[0].updatedAt).toISOString();

      // Insertar adjuntos en la tabla 'attached_documents'
      // Asumiendo que 'attached_documents' tiene: id (PK, autogen), maintenance_log_id (FK), file_name, file_type, file_content (VARBINARY(MAX)), created_at
      if (data.newAttachments && data.newAttachments.length > 0) {
        for (const attachment of data.newAttachments) {
          // El 'content' viene como Data URI (ej. "data:image/png;base64,iVBORw0KGgo...")
          // Necesitamos extraer la parte Base64 pura.
          const base64Data = attachment.content.substring(attachment.content.indexOf(',') + 1);
          const fileBuffer = Buffer.from(base64Data, 'base64');
          const attachmentRequest = transaction.request(); 
          attachmentRequest.input('ad_maintenance_log_id', sql.Int, parseInt(newLogId, 10)); // Usar newLogId
          attachmentRequest.input('ad_file_name', sql.NVarChar(255), attachment.name);
          attachmentRequest.input('ad_file_type', sql.NVarChar(100), attachment.type);
          attachmentRequest.input('ad_file_content', sql.VarBinary(sql.MAX), fileBuffer);
          await attachmentRequest.query(`
            INSERT INTO attached_documents (maintenance_log_id, file_name, file_type, file_content, created_at)
            VALUES (@ad_maintenance_log_id, @ad_file_name, @ad_file_type, @ad_file_content, GETDATE());
          `);
        }
      }

      // Actualizar el vehículo con el nuevo kilometraje y las próximas fechas/kilometrajes de mantenimiento
      const vehicleDataFromDb = vehicleResult.recordset[0];
  const updateVehicleRequest = transaction.request(); 
  updateVehicleRequest.input('upd_v_id', sql.Int, parseInt(data.vehicleId as unknown as string, 10));
      // Solo actualizar currentMileage si el kilometraje del servicio es mayor
      const newCurrentMileage = Math.max(data.mileageAtService, vehicleDataFromDb.currentMileage);
      updateVehicleRequest.input('upd_v_currentMileage', sql.Int, newCurrentMileage); 
      updateVehicleRequest.input('upd_v_nextMaintDate', sql.Date, data.nextMaintenanceDateScheduled);
      updateVehicleRequest.input('upd_v_nextMaintMileage', sql.Int, data.nextMaintenanceMileageScheduled);
      await updateVehicleRequest.query(`
        UPDATE vehicles 
        SET 
          currentMileage = @upd_v_currentMileage, 
          nextPreventiveMaintenanceDate = @upd_v_nextMaintDate, 
          nextPreventiveMaintenanceMileage = @upd_v_nextMaintMileage,
          updatedByUserId = ${userIdInt !== null ? userIdInt : 'NULL'},
          updatedAt = GETDATE()
        WHERE id = @upd_v_id;
      `);
      
      await transaction.commit();
      
      // Obtener los adjuntos recién creados para incluirlos en la respuesta (opcional)
      const createdAttachments: AttachedDocument[] = [];
      if (data.newAttachments && data.newAttachments.length > 0) {
          const getAttachmentsReq = pool.request(); // Nueva request fuera de la transacción ya commiteada
          getAttachmentsReq.input('ga_log_id', sql.Int, parseInt(newLogId, 10));
          const attachmentsResult = await getAttachmentsReq.query(`
            SELECT id, maintenance_log_id, file_name, file_type, file_content, created_at 
            FROM attached_documents WHERE maintenance_log_id = @ga_log_id
          `);
          attachmentsResult.recordset.forEach(attRow => {
              let fileContentBase64 = '';
              if (attRow.file_content && Buffer.isBuffer(attRow.file_content)) {
                const prefix = attRow.file_type ? `data:${attRow.file_type};base64,` : 'data:application/octet-stream;base64,';
                fileContentBase64 = prefix + attRow.file_content.toString('base64');
              }
              createdAttachments.push({
                  id: attRow.id.toString(),
                  maintenanceLogId: attRow.maintenance_log_id.toString(),
                  fileName: attRow.file_name,
                  fileType: attRow.file_type,
                  fileContent: fileContentBase64,
                  createdAt: new Date(attRow.created_at).toISOString(),
              });
          });
      }
      
      const createdLog: MaintenanceLog = { 
          id: newLogId, 
          ...data,
          vehiclePlateNumber: vehiclePlateNumber,
          executionDate: data.executionDate.toISOString().split('T')[0], 
          nextMaintenanceDateScheduled: data.nextMaintenanceDateScheduled.toISOString().split('T')[0], 
          createdAt: newLogCreatedAt,
          // updatedAt: newLogUpdatedAt, // Asegúrate que este valor se obtenga del OUTPUT si la BD lo maneja
          attachments: createdAttachments 
      };
      
      // PRODUCCIÓN: logger.info({ action: 'createMaintenanceLog', logId: newLogId, vehicleId: data.vehicleId }, "Maintenance log created successfully");
      revalidatePath("/maintenance");
      revalidatePath("/vehicles"); 
      revalidatePath(`/vehicles/${data.vehicleId}`);
      revalidatePath(`/maintenance/${newLogId}`); // Para la página de detalles del log
      return { message: `Registro de mantenimiento creado exitosamente para ${vehiclePlateNumber}.`, log: createdLog, success: true };
    } catch (error) {
      try { await transaction.rollback(); } catch (rbErr) { console.warn('[TX] rollback failed or already aborted', rbErr); }

      // PRODUCCIÓN: logger.error({ action: 'createMaintenanceLog', data, error: (error as Error).message, stack: (error as Error).stack }, "Error creating maintenance log");
      console.error(`[SQL Server Error] Error al crear registro de mantenimiento:`, error);
      return { 
        message: `Error al crear registro de mantenimiento. Detalles: ${(error as Error).message}`, 
        errors: { form: "Error de base de datos al crear." }, 
        success: false
      };
    }
  } else {
     console.warn(`[Create Maintenance Log] La creación de registros de mantenimiento no está implementada para el tipo de BD: ${dbClient.type}.`);
     return { 
        message: `La creación de registros de mantenimiento no está implementada para el tipo de BD: ${dbClient.type}. Por favor, implemente la lógica SQL.`, 
        errors: { form: "Tipo de BD no soportado para esta acción." }, 
        success: false 
      };
  }
  
  
  // console.log(`[Create Maintenance Log] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Registro no creado.`);
  // return { 
  //   message: `Creación de registro de mantenimiento pendiente de implementación SQL para ${dbClient.type}.`, 
  //   log: null, 
  //   success: false,
  //   errors: { form: `Implementación SQL pendiente para ${dbClient.type}.` }
  // };
}

export async function updateMaintenanceLog(id: string, formData: MaintenanceFormData) {
  const validatedFields = maintenanceLogSchema.safeParse(formData);

  if (!validatedFields.success) {
    // PRODUCCIÓN: logger.warn({ action: 'updateMaintenanceLog', logId: id, validationErrors: validatedFields.error.flatten().fieldErrors }, "Validation failed");
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Datos de formulario inválidos.",
      success: false,
    };
  }

  const dbClient = await getDbClient();
  if (!dbClient) {
    console.error(`[Update Maintenance Log Error] ID: ${id}. Configuración de BD no encontrada.`);
    return { 
      message: "Error: Configuración de base de datos no encontrada. No se pudo actualizar. Por favor, revise la página de Configuración.", 
      errors: { form: "Configuración de BD requerida." }, 
      success: false 
    };
  }
  const data = validatedFields.data;
  
  // PRODUCCIÓN: logger.info({ action: 'updateMaintenanceLog', dbType: dbClient.type, logId: id }, "Attempting to update maintenance log");
  
  // --- Ejemplo de Implementación para SQL Server ---
  // 1. Asegúrate de haber instalado 'mssql': npm install mssql
  // 2. Configura la conexión real en src/lib/db.ts y descomenta la lógica de conexión para SQLServer.
  // 3. Adapta los nombres de tabla/columna y tipos de datos SQL a tu esquema de BD.
  
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) {
      return { message: "Pool de SQL Server no disponible. Verifique la configuración de la base de datos.", success: false, errors: { form: "Error de conexión a BD."} };
    }
    
    const transaction = new sql.Transaction(pool);
    try {
      const currentUser = await getCurrentUser();
      const userIdInt = currentUser ? parseInt(currentUser.id, 10) : null;
      await transaction.begin();

      // Obtener el vehicleId del log existente para actualizar el vehículo después
  const getLogRequest = transaction.request(); 
  getLogRequest.input('logIdForVehicleInfo', sql.Int, parseInt(id, 10));
      const logInfoResult = await getLogRequest.query('SELECT vehicleId, vehiclePlateNumber FROM maintenance_logs WHERE id = @logIdForVehicleInfo');
      if (logInfoResult.recordset.length === 0) {
          await transaction.rollback();
          // PRODUCCIÓN: logger.warn({ action: 'updateMaintenanceLog', logId: id, reason: "Original log not found" });
          return { message: "Registro de mantenimiento original no encontrado.", errors: { form: "ID de registro no válido." }, success: false };
      }
      const existingLogVehicleId = logInfoResult.recordset[0].vehicleId;
      const existingLogPlateNumber = logInfoResult.recordset[0].vehiclePlateNumber;

      // Actualizar el registro de mantenimiento principal
  const logUpdateRequest = transaction.request(); 
  logUpdateRequest.input('ml_id', sql.Int, parseInt(id, 10));
      logUpdateRequest.input('ml_maintenanceType', sql.NVarChar(50), data.maintenanceType);
      logUpdateRequest.input('ml_executionDate', sql.Date, data.executionDate);
      logUpdateRequest.input('ml_mileageAtService', sql.Int, data.mileageAtService);
      logUpdateRequest.input('ml_activitiesPerformed', sql.NVarChar(sql.MAX), data.activitiesPerformed);
      logUpdateRequest.input('ml_cost', sql.Decimal(10, 2), data.cost);
      logUpdateRequest.input('ml_provider', sql.NVarChar(100), data.provider);
      logUpdateRequest.input('ml_nextMaintenanceDateScheduled', sql.Date, data.nextMaintenanceDateScheduled);
      logUpdateRequest.input('ml_nextMaintenanceMileageScheduled', sql.Int, data.nextMaintenanceMileageScheduled);
      
      const resultLogUpdate = await logUpdateRequest.query(`
        UPDATE maintenance_logs 
        SET 
          maintenanceType = @ml_maintenanceType, 
          executionDate = @ml_executionDate, 
          mileageAtService = @ml_mileageAtService, 
          activitiesPerformed = @ml_activitiesPerformed, 
          cost = @ml_cost, 
          provider = @ml_provider, 
          nextMaintenanceDateScheduled = @ml_nextMaintenanceDateScheduled, 
          nextMaintenanceMileageScheduled = @ml_nextMaintenanceMileageScheduled,
          updatedByUserId = ${userIdInt !== null ? userIdInt : 'NULL'},
          updatedAt = GETDATE()
        OUTPUT INSERTED.id, INSERTED.createdAt, INSERTED.updatedAt 
        WHERE id = @ml_id;
      `);
      
      if (resultLogUpdate.recordset.length === 0) {
        await transaction.rollback();
        // PRODUCCIÓN: logger.warn({ action: 'updateMaintenanceLog', logId: id, reason: 'Not found for update' });
        return { message: "Registro de mantenimiento no encontrado para actualizar.", errors: { form: "ID de registro no válido." }, success: false };
      }
      const updatedDbRecord = resultLogUpdate.recordset[0];

      // Manejar adjuntos: eliminar los marcados y agregar los nuevos
      if (data.attachmentsToRemove && data.attachmentsToRemove.length > 0) {
        for (const attachmentIdToRemove of data.attachmentsToRemove) {
          const deleteAttachmentRequest = transaction.request(); 
          deleteAttachmentRequest.input('ad_id_to_remove', sql.Int, parseInt(attachmentIdToRemove, 10));
          deleteAttachmentRequest.input('ad_log_id_check', sql.Int, parseInt(id, 10)); // Asegurar que el adjunto pertenece al log
          await deleteAttachmentRequest.query('DELETE FROM attached_documents WHERE id = @ad_id_to_remove AND maintenance_log_id = @ad_log_id_check;');
        }
      }

      if (data.newAttachments && data.newAttachments.length > 0) {
        for (const attachment of data.newAttachments) {
          const base64Data = attachment.content.substring(attachment.content.indexOf(',') + 1);
          const fileBuffer = Buffer.from(base64Data, 'base64');
          const attachmentRequest = transaction.request(); 
          attachmentRequest.input('ad_maintenance_log_id', sql.Int, parseInt(id, 10)); // Usar el ID del log que se está actualizando
          attachmentRequest.input('ad_file_name', sql.NVarChar(255), attachment.name);
          attachmentRequest.input('ad_file_type', sql.NVarChar(100), attachment.type);
          attachmentRequest.input('ad_file_content', sql.VarBinary(sql.MAX), fileBuffer);
          await attachmentRequest.query(`
            INSERT INTO attached_documents (maintenance_log_id, file_name, file_type, file_content, created_at)
            VALUES (@ad_maintenance_log_id, @ad_file_name, @ad_file_type, @ad_file_content, GETDATE());
          `);
        }
      }

      // Actualizar el vehículo (asegurándose de tener el vehicleId correcto)
  const vehicleOriginalDataRequest = transaction.request(); 
  vehicleOriginalDataRequest.input('v_id_for_update', sql.Int, existingLogVehicleId);
      const vehicleOriginalDataResult = await vehicleOriginalDataRequest.query('SELECT currentMileage FROM vehicles WHERE id = @v_id_for_update');
      if (vehicleOriginalDataResult.recordset.length === 0) {
          await transaction.rollback();
          // PRODUCCIÓN: logger.error({ action: 'updateMaintenanceLog', logId: id, vehicleId: existingLogVehicleId, reason: "Associated vehicle not found" });
          return { message: "Vehículo asociado al registro de mantenimiento no encontrado.", errors: {form: "Error de integridad de datos."}, success: false};
      }
      const originalVehicleMileage = vehicleOriginalDataResult.recordset[0].currentMileage;

  const updateVehicleRequest = transaction.request(); 
  updateVehicleRequest.input('upd_v_id', sql.Int, existingLogVehicleId);
      const newCurrentMileageForVehicle = Math.max(data.mileageAtService, originalVehicleMileage);
      updateVehicleRequest.input('upd_v_currentMileage', sql.Int, newCurrentMileageForVehicle); 
      updateVehicleRequest.input('upd_v_nextMaintDate', sql.Date, data.nextMaintenanceDateScheduled);
      updateVehicleRequest.input('upd_v_nextMaintMileage', sql.Int, data.nextMaintenanceMileageScheduled);
      await updateVehicleRequest.query(`
        UPDATE vehicles 
        SET 
          currentMileage = @upd_v_currentMileage, 
          nextPreventiveMaintenanceDate = @upd_v_nextMaintDate, 
          nextPreventiveMaintenanceMileage = @upd_v_nextMaintMileage,
          updatedByUserId = ${userIdInt !== null ? userIdInt : 'NULL'},
          updatedAt = GETDATE()
        WHERE id = @upd_v_id;
      `);
      
  await transaction.commit();
      
       // Obtener todos los adjuntos (existentes + nuevos) para la respuesta (opcional)
      const allAttachments: AttachedDocument[] = [];
  const getAllAttachmentsReq = pool.request(); // Nueva request fuera de la transacción
  getAllAttachmentsReq.input('ga_log_id_updated', sql.Int, parseInt(id, 10));
      const attachmentsResultUpdated = await getAllAttachmentsReq.query(`
        SELECT id, maintenance_log_id, file_name, file_type, file_content, created_at 
        FROM attached_documents WHERE maintenance_log_id = @ga_log_id_updated
      `);
      attachmentsResultUpdated.recordset.forEach(attRow => {
          let fileContentBase64 = '';
          if (attRow.file_content && Buffer.isBuffer(attRow.file_content)) {
            const prefix = attRow.file_type ? `data:${attRow.file_type};base64,` : 'data:application/octet-stream;base64,';
            fileContentBase64 = prefix + attRow.file_content.toString('base64');
          }
          allAttachments.push({
              id: attRow.id.toString(),
              maintenanceLogId: attRow.maintenance_log_id.toString(),
              fileName: attRow.file_name,
              fileType: attRow.file_type,
              fileContent: fileContentBase64,
              createdAt: new Date(attRow.created_at).toISOString(),
          });
      });

      const updatedLog: MaintenanceLog = {
        id, // El ID del log que se actualizó
        ...data, 
        vehicleId: existingLogVehicleId, 
        vehiclePlateNumber: existingLogPlateNumber, 
        executionDate: data.executionDate.toISOString().split('T')[0],
        nextMaintenanceDateScheduled: data.nextMaintenanceDateScheduled.toISOString().split('T')[0],
        createdAt: new Date(updatedDbRecord.createdAt).toISOString(), // Podría ser el createdAt original si no se actualiza
        // updatedAt: new Date(updatedDbRecord.updatedAt).toISOString(),
        attachments: allAttachments
      };
      
      // PRODUCCIÓN: logger.info({ action: 'updateMaintenanceLog', logId: id }, "Maintenance log updated successfully");
      revalidatePath("/maintenance");
      revalidatePath(`/maintenance/${id}`);
      revalidatePath(`/maintenance/${id}/edit`);
      revalidatePath("/vehicles");
      revalidatePath(`/vehicles/${updatedLog.vehicleId}`);
      return { message: `Registro de mantenimiento para ${updatedLog.vehiclePlateNumber} actualizado exitosamente.`, log: updatedLog, success: true };
    } catch (error) {
      try { await transaction.rollback(); } catch (rbErr) { console.warn('[TX] rollback failed or already aborted', rbErr); }

      // PRODUCCIÓN: logger.error({ action: 'updateMaintenanceLog', logId: id, error: (error as Error).message, stack: (error as Error).stack }, "Error updating maintenance log");
      console.error(`[SQL Server Error] Error al actualizar registro de mantenimiento ${id}:`, error);
      return { 
        message: `Error al actualizar registro de mantenimiento. Detalles: ${(error as Error).message}`, 
        errors: { form: "Error de base de datos al actualizar." }, 
        success: false
      };
    }
  } else {
    console.warn(`[Update Maintenance Log] La actualización de registros de mantenimiento no está implementada para el tipo de BD: ${dbClient.type}.`);
    return { 
      message: `La actualización de registros de mantenimiento no está implementada para el tipo de BD: ${dbClient.type}. Por favor, implemente la lógica SQL.`, 
      errors: { form: "Tipo de BD no soportado para esta acción." }, 
      success: false 
    };
  }
  
  // console.log(`[Update Maintenance Log] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Registro ID: ${id} no actualizado.`);
  // return { 
  //   message: `Actualización de registro de mantenimiento ID ${id} pendiente de implementación SQL para ${dbClient.type}.`, 
  //   log: null, 
  //   success: false,
  //   errors: { form: `Implementación SQL pendiente para ${dbClient.type}.` }
  // };
}

export async function deleteMaintenanceLog(id: string) {
  const dbClient = await getDbClient();
  if (!dbClient) {
    console.error(`deleteMaintenanceLog(${id}): Error de configuración de BD. No se pudo eliminar.`);
    // PRODUCCIÓN: logger.error({ action: 'deleteMaintenanceLog', logId: id, reason: 'DB config not found' });
    throw new Error("Configuración de base de datos no encontrada. No se pudo eliminar el registro.");
  }
  
  // PRODUCCIÓN: logger.info({ action: 'deleteMaintenanceLog', dbType: dbClient.type, logId: id }, "Attempting to delete maintenance log and its attachments");
  
  // --- Ejemplo de Implementación para SQL Server ---
  // 1. Asegúrate de haber instalado 'mssql': npm install mssql
  // 2. Configura la conexión real en src/lib/db.ts y descomenta la lógica de conexión para SQLServer.
  // 3. Adapta los nombres de tabla/columna y tipos de datos SQL a tu esquema de BD.
  // 4. Considera usar una transacción para asegurar que ambas eliminaciones (adjuntos y log) sean atómicas.
  
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) {
      // PRODUCCIÓN: logger.error({ action: 'deleteMaintenanceLog', logId: id, reason: 'SQL Server pool not available' });
      throw new Error("Pool de SQL Server no disponible para eliminar el registro.");
    }
    
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();
      
      // Primero eliminar adjuntos asociados de la tabla 'attached_documents'
      const deleteAttachmentsRequest = transaction.request(); 
      deleteAttachmentsRequest.input('logIdToDeleteAttachments', sql.NVarChar(50), id);
      await deleteAttachmentsRequest.query('DELETE FROM attached_documents WHERE maintenance_log_id = @logIdToDeleteAttachments;');
      // PRODUCCIÓN: logger.info({ action: 'deleteMaintenanceLog', logId: id, subAction: 'attachmentsDeleted' });

      // Luego eliminar el registro de mantenimiento principal de 'maintenance_logs'
      const deleteLogRequest = transaction.request(); 
      deleteLogRequest.input('logIdToDelete', sql.NVarChar(50), id);
      const result = await deleteLogRequest.query('DELETE FROM maintenance_logs WHERE id = @logIdToDelete;');
      
      await transaction.commit();

      if (result.rowsAffected[0] === 0) {
        // No se encontró el log principal.
        console.warn(`[Delete Maintenance Log] Maintenance log ID: ${id} no encontrado para eliminar, o ya estaba eliminado.`);
        // PRODUCCIÓN: logger.warn({ action: 'deleteMaintenanceLog', logId: id, reason: 'Log not found for deletion or already deleted' });
      } else {
        // PRODUCCIÓN: logger.info({ action: 'deleteMaintenanceLog', logId: id, status: 'success' });
      }
    } catch (error) {

            await transaction.rollback();

      // PRODUCCIÓN: logger.error({ action: 'deleteMaintenanceLog', logId: id, error: (error as Error).message, stack: (error as Error).stack }, "Error deleting maintenance log");
      console.error(`[SQL Server Error] Error al eliminar registro de mantenimiento ${id}:`, error);
      throw new Error(`Error al eliminar registro de mantenimiento: ${(error as Error).message}`);
    }
  } else {
    console.warn(`[Delete Maintenance Log] La eliminación de registros de mantenimiento no está implementada para el tipo de BD: ${dbClient.type}.`);
    // PRODUCCIÓN: logger.warn({ action: 'deleteMaintenanceLog', logId: id, dbType: dbClient.type, reason: 'Unsupported DB type for deletion' });
    throw new Error(`Eliminación no soportada para el tipo de BD: ${dbClient.type}`);
  }
  
  
  console.log(`[Delete Maintenance Log] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Registro ID: ${id} no eliminado.`);
  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${id}`); 
  redirect("/maintenance?message=delete_sql_needed_for_maintenance_log");
}


export async function getMaintenanceLogs(): Promise<MaintenanceLog[]> {
  const dbClient = await getDbClient();
  if (!dbClient) {
    console.warn("getMaintenanceLogs: Configuración de BD no encontrada. Devolviendo lista vacía.");
    return [];
  }
  
  // PRODUCCIÓN: logger.info({ action: 'getMaintenanceLogs', dbType: dbClient.type }, "Attempting to fetch all maintenance logs");
  
  // --- Ejemplo de Implementación para SQL Server ---
  // 1. Asegúrate de haber instalado 'mssql': npm install mssql
  // 2. Configura la conexión real en src/lib/db.ts y descomenta la lógica de conexión para SQLServer.
  // 3. Adapta los nombres de tabla/columna y tipos de datos SQL a tu esquema de BD.
  
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) {
      console.error("getMaintenanceLogs: Pool de SQL Server no disponible.");
      // PRODUCCIÓN: logger.error({ action: 'getMaintenanceLogs', reason: 'SQL Server pool not available' });
      return [];
    }
    try {
      const request = pool.request();
      // Para la lista general, no traeremos el contenido de los adjuntos para mantener el rendimiento.
      // Podríamos traer una cuenta de adjuntos o una bandera si tiene adjuntos.
      const result = await request.query(`
        SELECT 
          ml.id, ml.vehicleId, ml.vehiclePlateNumber, ml.maintenanceType, ml.executionDate, ml.mileageAtService,
          ml.activitiesPerformed, ml.cost, ml.provider, ml.nextMaintenanceDateScheduled,
          ml.nextMaintenanceMileageScheduled, ml.createdAt, ml.updatedAt,
          ml.createdByUserId, ml.updatedByUserId,
          cu.username AS createdByUsername, uu.username AS updatedByUsername,
          (SELECT COUNT(*) FROM attached_documents ad WHERE ad.maintenance_log_id = ml.id) AS attachmentCount 
        FROM maintenance_logs ml
        LEFT JOIN users cu ON ml.createdByUserId = cu.id
        LEFT JOIN users uu ON ml.updatedByUserId = uu.id
        ORDER BY ml.executionDate DESC, ml.createdAt DESC
      `);
      return result.recordset.map(row => ({
        id: row.id.toString(),
        vehicleId: row.vehicleId,
        vehiclePlateNumber: row.vehiclePlateNumber,
        maintenanceType: row.maintenanceType,
        executionDate: new Date(row.executionDate).toISOString().split('T')[0],
        mileageAtService: row.mileageAtService,
        activitiesPerformed: row.activitiesPerformed,
        cost: parseFloat(row.cost),
        provider: row.provider,
        nextMaintenanceDateScheduled: row.nextMaintenanceDateScheduled ? new Date(row.nextMaintenanceDateScheduled).toISOString().split('T')[0] : "",
        nextMaintenanceMileageScheduled: row.nextMaintenanceMileageScheduled,
  createdAt: new Date(row.createdAt).toISOString(),
  // updatedAt: new Date(row.updatedAt).toISOString(), // Descomentar si se usa y se devuelve
  attachments: [], // Para la lista general, no cargamos los adjuntos detallados.
  // Podrías usar row.attachmentCount para mostrar un indicador si es necesario.
  createdByUserId: row.createdByUserId ? row.createdByUserId.toString() : undefined,
  updatedByUserId: row.updatedByUserId ? row.updatedByUserId.toString() : undefined,
  createdByUsername: row.createdByUsername || undefined,
  updatedByUsername: row.updatedByUsername || undefined,
      })) as MaintenanceLog[];
    } catch (error) {
      // PRODUCCIÓN: logger.error({ action: 'getMaintenanceLogs', error: (error as Error).message, stack: (error as Error).stack }, "Error fetching maintenance logs");
      console.error('[SQL Server Error] Error al obtener registros de mantenimiento:', error);
      return [];
    }
  } else {
    console.warn(`[Get Maintenance Logs] La obtención de registros de mantenimiento no está implementada para el tipo de BD: ${dbClient.type}.`);
    // PRODUCCIÓN: logger.warn({ action: 'getMaintenanceLogs', dbType: dbClient.type, reason: 'Unsupported DB type' });
    return [];
  }
  
  
  // console.log(`[Get Maintenance Logs] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Devolviendo lista vacía.`);
  // return [];
}

export async function getMaintenanceLogsFiltered({ vehicleId, from, to }: { vehicleId?: string; from?: string; to?: string; }): Promise<MaintenanceLog[]> {
  const dbClient = await getDbClient();
  if (!dbClient) {
    console.warn("getMaintenanceLogsFiltered: Configuración de BD no encontrada. Devolviendo lista vacía.");
    return [];
  }

  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) {
      console.error("getMaintenanceLogsFiltered: Pool de SQL Server no disponible.");
      return [];
    }
    try {
      const request = pool.request();
      let whereParts: string[] = [];
      if (vehicleId) {
        request.input('vehicleId', sql.NVarChar(50), vehicleId);
        whereParts.push('ml.vehicleId = @vehicleId');
      }
      if (from) {
        request.input('fromDate', sql.Date, new Date(from + 'T00:00:00'));
        whereParts.push('ml.executionDate >= @fromDate');
      }
      if (to) {
        request.input('toDate', sql.Date, new Date(to + 'T00:00:00'));
        whereParts.push('ml.executionDate <= @toDate');
      }
      const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
      const query = `
        SELECT 
          ml.id, ml.vehicleId, ml.vehiclePlateNumber, ml.maintenanceType, ml.executionDate, ml.mileageAtService,
          ml.activitiesPerformed, ml.cost, ml.provider, ml.nextMaintenanceDateScheduled,
          ml.nextMaintenanceMileageScheduled, ml.createdAt, ml.updatedAt,
          ml.createdByUserId, ml.updatedByUserId,
          cu.username AS createdByUsername, uu.username AS updatedByUsername,
          (SELECT COUNT(*) FROM attached_documents ad WHERE ad.maintenance_log_id = ml.id) AS attachmentCount 
        FROM maintenance_logs ml
        LEFT JOIN users cu ON ml.createdByUserId = cu.id
        LEFT JOIN users uu ON ml.updatedByUserId = uu.id
        ${whereClause}
        ORDER BY ml.executionDate DESC, ml.createdAt DESC`;
      const result = await request.query(query);
      return result.recordset.map(row => ({
        id: row.id.toString(),
        vehicleId: row.vehicleId,
        vehiclePlateNumber: row.vehiclePlateNumber,
        maintenanceType: row.maintenanceType,
        executionDate: new Date(row.executionDate).toISOString().split('T')[0],
        mileageAtService: row.mileageAtService,
        activitiesPerformed: row.activitiesPerformed,
        cost: parseFloat(row.cost),
        provider: row.provider,
        nextMaintenanceDateScheduled: row.nextMaintenanceDateScheduled ? new Date(row.nextMaintenanceDateScheduled).toISOString().split('T')[0] : "",
        nextMaintenanceMileageScheduled: row.nextMaintenanceMileageScheduled,
        createdAt: new Date(row.createdAt).toISOString(),
        attachments: [],
        createdByUserId: row.createdByUserId ? row.createdByUserId.toString() : undefined,
        updatedByUserId: row.updatedByUserId ? row.updatedByUserId.toString() : undefined,
        createdByUsername: row.createdByUsername || undefined,
        updatedByUsername: row.updatedByUsername || undefined,
      })) as MaintenanceLog[];
    } catch (error) {
      console.error('[SQL Server Error] Error al obtener registros de mantenimiento filtrados:', error);
      return [];
    }
  } else {
    console.warn(`[Get Maintenance Logs Filtered] No implementado para tipo de BD: ${dbClient.type}.`);
    return [];
  }
}

export async function getMaintenanceLogById(id: string): Promise<MaintenanceLog | null> {
  const dbClient = await getDbClient();
  if (!dbClient) {
    console.warn(`getMaintenanceLogById(${id}): Configuración de BD no encontrada. Devolviendo null.`);
    return null;
  }
  
  // PRODUCCIÓN: logger.info({ action: 'getMaintenanceLogById', dbType: dbClient.type, logId: id }, "Attempting to fetch maintenance log by ID with attachments");
  
  // --- Ejemplo de Implementación para SQL Server ---
  // 1. Asegúrate de haber instalado 'mssql': npm install mssql
  // 2. Configura la conexión real en src/lib/db.ts y descomenta la lógica de conexión para SQLServer.
  // 3. Adapta los nombres de tabla/columna y tipos de datos SQL a tu esquema de BD.
  
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) {
      console.error("getMaintenanceLogById: Pool de SQL Server no disponible.");
      // PRODUCCIÓN: logger.error({ action: 'getMaintenanceLogById', logId: id, reason: 'SQL Server pool not available' });
      return null;
    }
    try {
      // Obtener el registro de mantenimiento principal
      const logRequest = pool.request();
      logRequest.input('logIdToFind', sql.NVarChar(50), id);
      const logResult = await logRequest.query(`
        SELECT 
          ml.id, ml.vehicleId, ml.vehiclePlateNumber, ml.maintenanceType, ml.executionDate, ml.mileageAtService,
          ml.activitiesPerformed, ml.cost, ml.provider, ml.nextMaintenanceDateScheduled,
          ml.nextMaintenanceMileageScheduled, ml.createdAt, ml.updatedAt,
          ml.createdByUserId, ml.updatedByUserId,
          cu.username AS createdByUsername,
          uu.username AS updatedByUsername
        FROM maintenance_logs ml
        LEFT JOIN users cu ON ml.createdByUserId = cu.id
        LEFT JOIN users uu ON ml.updatedByUserId = uu.id
        WHERE ml.id = @logIdToFind
      `);
      
      if (logResult.recordset.length === 0) {
        // PRODUCCIÓN: logger.warn({ action: 'getMaintenanceLogById', logId: id, reason: 'Log not found' });
        return null; // Log no encontrado
      }
      const rowLog = logResult.recordset[0];

      // Obtener los adjuntos asociados
      const attachmentsRequest = pool.request();
      attachmentsRequest.input('logIdForAttachments', sql.NVarChar(50), id);
      const attachmentsResult = await attachmentsRequest.query(`
        SELECT id, maintenance_log_id, file_name, file_type, file_content, created_at
        FROM attached_documents
        WHERE maintenance_log_id = @logIdForAttachments
        ORDER BY created_at DESC
      `);

      const attachments: AttachedDocument[] = attachmentsResult.recordset.map(rowAtt => {
        let fileContentBase64: string = ''; // Default
        if (rowAtt.file_content && Buffer.isBuffer(rowAtt.file_content)) {
          // Crear el Data URI completo para el frontend
          const prefix = rowAtt.file_type ? `data:${rowAtt.file_type};base64,` : 'data:application/octet-stream;base64,';
          fileContentBase64 = prefix + rowAtt.file_content.toString('base64');
        }
        return {
          id: rowAtt.id.toString(),
          maintenanceLogId: rowAtt.maintenance_log_id.toString(),
          fileName: rowAtt.file_name,
          fileType: rowAtt.file_type,
          fileContent: fileContentBase64, // Este es el Data URI completo
          createdAt: new Date(rowAtt.created_at).toISOString(),
        };
      });
      
      return {
        id: rowLog.id.toString(),
        vehicleId: rowLog.vehicleId,
        vehiclePlateNumber: rowLog.vehiclePlateNumber,
        maintenanceType: rowLog.maintenanceType,
        executionDate: new Date(rowLog.executionDate).toISOString().split('T')[0],
        mileageAtService: rowLog.mileageAtService,
        activitiesPerformed: rowLog.activitiesPerformed,
        cost: parseFloat(rowLog.cost),
        provider: rowLog.provider,
        nextMaintenanceDateScheduled: rowLog.nextMaintenanceDateScheduled ? new Date(rowLog.nextMaintenanceDateScheduled).toISOString().split('T')[0] : "",
        nextMaintenanceMileageScheduled: rowLog.nextMaintenanceMileageScheduled,
        createdAt: new Date(rowLog.createdAt).toISOString(),
        updatedAt: rowLog.updatedAt ? new Date(rowLog.updatedAt).toISOString() : undefined,
        attachments: attachments,
        createdByUserId: rowLog.createdByUserId ? rowLog.createdByUserId.toString() : undefined,
        updatedByUserId: rowLog.updatedByUserId ? rowLog.updatedByUserId.toString() : undefined,
        createdByUsername: rowLog.createdByUsername || undefined,
        updatedByUsername: rowLog.updatedByUsername || undefined
      } as MaintenanceLog;

    } catch (error) {
      // PRODUCCIÓN: logger.error({ action: 'getMaintenanceLogById', logId: id, error: (error as Error).message, stack: (error as Error).stack }, "Error fetching maintenance log by ID");
      console.error(`[SQL Server Error] Error al obtener registro de mantenimiento por ID ${id}:`, error);
      return null;
    }
  } else {
    console.warn(`[Get Maintenance Log By ID] La obtención de registro de mantenimiento por ID no está implementada para el tipo de BD: ${dbClient.type}.`);
    // PRODUCCIÓN: logger.warn({ action: 'getMaintenanceLogById', logId: id, dbType: dbClient.type, reason: 'Unsupported DB type' });
    return null;
  }
  
  
  // console.log(`[Get Maintenance Log By ID] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Log ID: ${id}. Devolviendo null.`);
  // return null;
}

export async function getMaintenanceLogsByVehicleId(vehicleId: string): Promise<MaintenanceLog[]> {
    const dbClient = await getDbClient();
    if (!dbClient) {
        console.warn(`getMaintenanceLogsByVehicleId(${vehicleId}): Configuración de BD no encontrada. Devolviendo lista vacía.`);
        return [];
    }
    
    // PRODUCCIÓN: logger.info({ action: 'getMaintenanceLogsByVehicleId', dbType: dbClient.type, vehicleId }, "Attempting to fetch maintenance logs for vehicle");
    // --- Ejemplo de Implementación para SQL Server ---
    
    if (dbClient.type === "SQLServer") {
      const pool = (dbClient as any).pool as sql.ConnectionPool;
      if (!pool) {
        console.error("getMaintenanceLogsByVehicleId: Pool de SQL Server no disponible.");
        // PRODUCCIÓN: logger.error({ action: 'getMaintenanceLogsByVehicleId', vehicleId, reason: 'SQL Server pool not available' });
        return [];
      }
      try {
        const request = pool.request();
        request.input('targetVehicleId', sql.NVarChar(50), vehicleId);
        // Similar a getMaintenanceLogs, no traer adjuntos completos aquí por rendimiento.
        // Podrías considerar traer un conteo de adjuntos si es necesario para la UI.
        const result = await request.query(`
          SELECT 
            id, vehicleId, vehiclePlateNumber, maintenanceType, executionDate, mileageAtService,
            activitiesPerformed, cost, provider, nextMaintenanceDateScheduled,
            nextMaintenanceMileageScheduled, createdAt, updatedAt
            -- (SELECT COUNT(*) FROM attached_documents ad WHERE ad.maintenance_log_id = ml.id) AS attachmentCount 
          FROM maintenance_logs ml
          WHERE vehicleId = @targetVehicleId 
          ORDER BY executionDate DESC, createdAt DESC
        `);
        return result.recordset.map(row => ({
          id: row.id.toString(),
          vehicleId: row.vehicleId,
          vehiclePlateNumber: row.vehiclePlateNumber,
          maintenanceType: row.maintenanceType,
          executionDate: new Date(row.executionDate).toISOString().split('T')[0],
          mileageAtService: row.mileageAtService,
          activitiesPerformed: row.activitiesPerformed,
          cost: parseFloat(row.cost),
          provider: row.provider,
          nextMaintenanceDateScheduled: row.nextMaintenanceDateScheduled ? new Date(row.nextMaintenanceDateScheduled).toISOString().split('T')[0] : "",
          nextMaintenanceMileageScheduled: row.nextMaintenanceMileageScheduled,
          createdAt: new Date(row.createdAt).toISOString(),
          // updatedAt: new Date(row.updatedAt).toISOString(), // Descomentar si se usa y se devuelve
          attachments: [] // Los adjuntos completos se cargan por separado (ej. en getMaintenanceLogById)
        })) as MaintenanceLog[];
      } catch (error) {
        // PRODUCCIÓN: logger.error({ action: 'getMaintenanceLogsByVehicleId', vehicleId, error: (error as Error).message, stack: (error as Error).stack }, "Error fetching maintenance logs for vehicle");
        console.error(`[SQL Server Error] Error al obtener registros de mantenimiento para vehículo ID ${vehicleId}:`, error);
        return [];
      }
    } else {
      console.warn(`[Get Maintenance Logs By Vehicle ID] La obtención de registros por ID de vehículo no está implementada para: ${dbClient.type}.`);
      // PRODUCCIÓN: logger.warn({ action: 'getMaintenanceLogsByVehicleId', vehicleId, dbType: dbClient.type, reason: 'Unsupported DB type' });
      return [];
    }
    
    
    // console.log(`[Get Maintenance Logs By Vehicle ID] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Vehículo ID: ${vehicleId}. Devolviendo lista vacía.`);
    // return [];
}

