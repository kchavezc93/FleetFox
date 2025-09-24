
"use server";

import type { UserSchema } from "@/lib/zod-schemas";
import type { UserProfile } from "@/types";
import { getDbClient } from "@/lib/db";
// import { revalidatePath } from "next/cache";
import sql from 'mssql';
import bcrypt from 'bcryptjs'; // npm install bcryptjs @types/bcryptjs
import { recordAuditEvent } from '@/lib/actions/audit-actions';

// PRODUCCIÓN: Consideraciones adicionales para la gestión de usuarios:
// - Validación de permisos: Asegurar que el usuario que realiza la acción tenga los permisos necesarios.
// - Auditoría: Registrar quién hizo qué cambio y cuándo.
// - Protección contra enumeración de usuarios si es un sistema público.
// - Flujo de "olvidé mi contraseña" seguro.
// - Política de contraseñas robusta.

export async function saveUser(data: UserSchema, existingId?: string): Promise<{ success: boolean; message: string; errors?: Record<string, string>; userId?: string }> {
  const dbClient = await getDbClient();

  if (!dbClient) {
    console.error("[Save User Error] Configuración de BD no encontrada.");
    // PRODUCCIÓN: logger.error({ module: 'user-actions', action: 'saveUser', email: data.email, reason: 'DB config not found' });
    return { 
      success: false, 
      message: "Error de configuración: No se pudo conectar a la base de datos. Por favor, revise la configuración de variables de entorno.",
      errors: { form: "Configuración de BD requerida." }
    };
  }
  
  if (!existingId && !data.password) {
      // PRODUCCIÓN: logger.warn({ module: 'user-actions', action: 'saveUser', email: data.email, reason: 'Password missing for new user' });
      return {
          success: false,
          message: "La contraseña es obligatoria para crear un nuevo usuario.",
          errors: { password: "La contraseña es obligatoria." }
      };
  }

  // PRODUCCIÓN: logger.info({ module: 'user-actions', action: 'saveUser', dbType: dbClient.type, email: data.email, existingId }, "Attempting to save user");

  if (dbClient.type === "SQLServer" && (dbClient as any).pool) {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    try {
      let hashedPassword = "";
      if (data.password) {
        const salt = await bcrypt.genSalt(10);
        hashedPassword = await bcrypt.hash(data.password, salt);
      }

      const permissionsJson = JSON.stringify(data.permissions || []);

      if (existingId) {
        // Verificar duplicados para otro usuario
        const checkUpdateRequest = pool.request();
        checkUpdateRequest.input('checkEmail_upd', sql.NVarChar(255), data.email);
        checkUpdateRequest.input('checkUsername_upd', sql.NVarChar(100), data.username);
        checkUpdateRequest.input('currentId_upd', sql.NVarChar(50), existingId);
        const checkUpdateResult = await checkUpdateRequest.query(
          'SELECT id, email, username FROM users WHERE (email = @checkEmail_upd OR username = @checkUsername_upd) AND id <> @currentId_upd'
        );
        if (checkUpdateResult.recordset.length > 0) {
          const errors: Record<string, string> = {};
          if (checkUpdateResult.recordset.some((u: any) => u.email === data.email)) errors.email = "Este correo electrónico ya está en uso por otro usuario.";
          if (checkUpdateResult.recordset.some((u: any) => u.username === data.username)) errors.username = "Este nombre de usuario ya está en uso por otro usuario.";
          return { success: false, message: "El correo electrónico o nombre de usuario ya existe para otro usuario.", errors };
        }

  const updateRequest = pool.request();
        updateRequest.input('id_upd_val', sql.NVarChar(50), existingId);
        updateRequest.input('email_upd_val', sql.NVarChar(255), data.email);
        updateRequest.input('username_upd_val', sql.NVarChar(100), data.username);
        updateRequest.input('fullName_upd_val', sql.NVarChar(255), data.fullName || null);
        updateRequest.input('role_upd_val', sql.NVarChar(50), data.role);
        updateRequest.input('permissions_upd_val', sql.NVarChar(sql.MAX), permissionsJson);
  updateRequest.input('active_upd_val', sql.Bit, data.active === undefined ? true : !!data.active);

        if (hashedPassword) {
          updateRequest.input('passwordHash_upd_val', sql.NVarChar(255), hashedPassword);
          await updateRequest.query(`
            UPDATE users
            SET email = @email_upd_val,
                username = @username_upd_val,
                fullName = @fullName_upd_val,
                role = @role_upd_val,
                permissions = @permissions_upd_val,
                passwordHash = @passwordHash_upd_val,
                active = @active_upd_val,
                updatedAt = GETDATE()
            WHERE id = @id_upd_val;
          `);
          // Invalidate all existing sessions for this user after password change
          const invalidateReq = pool.request();
          invalidateReq.input('userId_invalidate', sql.NVarChar(50), existingId);
          await invalidateReq.query('DELETE FROM sessions WHERE userId = @userId_invalidate');
        } else {
          await updateRequest.query(`
            UPDATE users
            SET email = @email_upd_val,
                username = @username_upd_val,
                fullName = @fullName_upd_val,
                role = @role_upd_val,
                permissions = @permissions_upd_val,
                active = @active_upd_val,
                updatedAt = GETDATE()
            WHERE id = @id_upd_val;
          `);
          if (data.active === false) {
            const invalidateReq = pool.request();
            invalidateReq.input('userId_invalidate', sql.NVarChar(50), existingId);
            await invalidateReq.query('DELETE FROM sessions WHERE userId = @userId_invalidate');
          }
        }

        // revalidatePath('/users');
  try { await recordAuditEvent({ eventType: 'USER_UPDATED', targetUserId: existingId, message: `User ${data.email} updated` }); } catch {}
  return { success: true, message: `Usuario ${data.email} actualizado exitosamente.`, userId: existingId };
      } else {
        // Crear nuevo usuario: verificar duplicados
        const checkCreateRequest = pool.request();
        checkCreateRequest.input('checkEmail_ins', sql.NVarChar(255), data.email);
        checkCreateRequest.input('checkUsername_ins', sql.NVarChar(100), data.username);
        const checkCreateResult = await checkCreateRequest.query(
          'SELECT id, email, username FROM users WHERE email = @checkEmail_ins OR username = @checkUsername_ins'
        );
        if (checkCreateResult.recordset.length > 0) {
          const errors: Record<string, string> = {};
          if (checkCreateResult.recordset.some((u: any) => u.email === data.email)) errors.email = "Este correo electrónico ya está en uso.";
          if (checkCreateResult.recordset.some((u: any) => u.username === data.username)) errors.username = "Este nombre de usuario ya está en uso.";
          return { success: false, message: "El correo electrónico o nombre de usuario ya existe.", errors };
        }

        if (!hashedPassword) {
          return { success: false, message: "Error interno: Intento de crear usuario sin contraseña hasheada." };
        }

  const insertRequest = pool.request();
        insertRequest.input('email_ins_val', sql.NVarChar(255), data.email);
        insertRequest.input('username_ins_val', sql.NVarChar(100), data.username);
        insertRequest.input('fullName_ins_val', sql.NVarChar(255), data.fullName || null);
        insertRequest.input('passwordHash_ins_val', sql.NVarChar(255), hashedPassword);
        insertRequest.input('role_ins_val', sql.NVarChar(50), data.role);
        insertRequest.input('permissions_ins_val', sql.NVarChar(sql.MAX), permissionsJson);
  insertRequest.input('active_ins_val', sql.Bit, data.active === undefined ? true : !!data.active);

        const resultInsert = await insertRequest.query(`
          INSERT INTO users (email, username, fullName, passwordHash, role, permissions, active, createdAt, updatedAt)
          OUTPUT INSERTED.id
          VALUES (@email_ins_val, @username_ins_val, @fullName_ins_val, @passwordHash_ins_val, @role_ins_val, @permissions_ins_val, @active_ins_val, GETDATE(), GETDATE());
        `);
        if (!resultInsert.recordset.length || !resultInsert.recordset[0].id) {
          throw new Error('Fallo al crear el usuario, la base de datos no devolvió un ID.');
        }
        const newUserIdFromDb = resultInsert.recordset[0].id.toString();
        // revalidatePath('/users');
  try { await recordAuditEvent({ eventType: 'USER_CREATED', targetUserId: newUserIdFromDb, message: `User ${data.email} created` }); } catch {}
  return { success: true, message: `Usuario ${data.email} creado exitosamente.`, userId: newUserIdFromDb };
      }
    } catch (error) {
      console.error(`[SQL Server Error] Error al guardar usuario ${data.email}:`, error);
      return {
        success: false,
        message: `Error del servidor al procesar usuario. Detalles: ${(error as Error).message}`,
        errors: { form: 'Error de base de datos.' }
      };
    }
  } else {
    console.warn(`[Save User] La gestión de usuarios no está implementada para el tipo de BD: ${dbClient.type} o falta el pool.`);
    return {
      success: false,
      message: `La gestión de usuarios no está implementada para ${dbClient.type} o falta el pool.`,
      errors: { form: 'Tipo de BD no soportado o error de conexión.' }
    };
  }
}

export async function getUsers(): Promise<UserProfile[]> {
    const dbClient = await getDbClient();
    if (!dbClient) {
        console.error("getUsers: Configuración de BD no encontrada. Devolviendo lista vacía.");
        // PRODUCCIÓN: logger.error({ module: 'user-actions', action: 'getUsers', reason: 'DB config not found' });
        return [];
    }
    // PRODUCCIÓN: logger.info({ module: 'user-actions', action: 'getUsers', dbType: dbClient.type }, "Attempting to fetch all users");

    if (dbClient.type === "SQLServer" && (dbClient as any).pool) {
      const pool = (dbClient as any).pool as sql.ConnectionPool;
      try {
        const request = pool.request();
        // NUNCA devolver passwordHash al listar usuarios
        const result = await request.query(
          'SELECT id, username, email, fullName, role, permissions, active, createdAt, updatedAt FROM users ORDER BY username ASC'
        );
        return result.recordset.map(row => ({
          id: row.id.toString(),
          username: row.username,
          email: row.email,
          fullName: row.fullName || "",
          passwordHash: "",
          role: row.role as "Admin" | "Standard",
          permissions: row.permissions ? JSON.parse(row.permissions) : [],
          active: (row as any).active === true || (row as any).active === 1,
          createdAt: new Date(row.createdAt).toISOString(),
          updatedAt: new Date(row.updatedAt).toISOString(),
        })) as any;
      } catch (error) {
        console.error('[SQL Server Error] Error al obtener usuarios:', error);
        return [];
      }
    } else {
      console.warn(`[Get Users] La obtención de usuarios no está implementada para el tipo de BD: ${dbClient.type} o falta el pool. Devolviendo lista vacía.`);
      return [];
    }
}

export async function deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    const dbClient = await getDbClient();
    if (!dbClient) {
        console.error(`deleteUser(${id}): Error de configuración de BD. No se pudo eliminar el usuario.`);
        // PRODUCCIÓN: logger.error({ module: 'user-actions', action: 'deleteUser', userId: id, reason: 'DB config not found' });
        return { success: false, message: "Error de configuración de BD. No se pudo eliminar el usuario."};
    }
    // PRODUCCIÓN: logger.info({ module: 'user-actions', action: 'deleteUser', dbType: dbClient.type, userId: id }, "Attempting to delete user");

    if (dbClient.type === "SQLServer" && (dbClient as any).pool) {
      const pool = (dbClient as any).pool as sql.ConnectionPool;
      const tx = new sql.Transaction(pool);
      try {
        await tx.begin();
        // Delete sessions for the user first
        const delSessionsReq = tx.request();
        delSessionsReq.input('userId_del', sql.NVarChar(50), id);
        await delSessionsReq.query('DELETE FROM sessions WHERE userId = @userId_del');

        // Then delete the user
        const delUserReq = tx.request();
        delUserReq.input('idToDelete_usr', sql.NVarChar(50), id);
        const result = await delUserReq.query('DELETE FROM users WHERE id = @idToDelete_usr;');

        await tx.commit();

        if (result.rowsAffected[0] === 0) {
          return { success: false, message: `Usuario ID: ${id} no encontrado para eliminar.` };
        }
        try { await recordAuditEvent({ eventType: 'USER_DELETED', targetUserId: id, message: `User deleted` }); } catch {}
        return { success: true, message: `Usuario ID: ${id} eliminado exitosamente (sesiones invalidadas).` };
      } catch (error) {
        try { await tx.rollback(); } catch {}
        console.error(`[SQL Server Error] Error al eliminar usuario ${id}:`, error);
        return { success: false, message: `Error al eliminar usuario. Detalles: ${(error as Error).message}` };
      }
    } else {
      console.warn(`[Delete User] La eliminación de usuarios no está implementada para el tipo de BD: ${dbClient.type} o falta el pool.`);
      return { 
        success: false, 
        message: `La eliminación de usuarios no está implementada para ${dbClient.type} o falta el pool. Implemente la lógica SQL y la conexión.` 
      };
    }
}

export async function getUserById(id: string): Promise<UserProfile & { active: boolean } | null> {
  const dbClient = await getDbClient();
  if (!dbClient) {
    console.error(`getUserById(${id}): Configuración de BD no encontrada.`);
    return null;
  }
  if (dbClient.type === "SQLServer" && (dbClient as any).pool) {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    try {
      const req = pool.request();
      req.input('id_sel', sql.NVarChar(50), id);
      const result = await req.query(
        'SELECT id, username, email, fullName, role, permissions, active, createdAt, updatedAt FROM users WHERE id = @id_sel'
      );
      if (!result.recordset.length) return null;
      const row = result.recordset[0];
      return {
        id: row.id.toString(),
        username: row.username,
        email: row.email,
        fullName: row.fullName || "",
        passwordHash: "",
        role: row.role as "Admin" | "Standard",
        permissions: row.permissions ? JSON.parse(row.permissions) : [],
        active: (row as any).active === true || (row as any).active === 1,
        createdAt: new Date(row.createdAt).toISOString(),
        updatedAt: new Date(row.updatedAt).toISOString(),
      } as any;
    } catch (error) {
      console.error(`[SQL Server Error] getUserById(${id})`, error);
      return null;
    }
  }
  console.warn(`[Get User By Id] No implementado para DB tipo: ${dbClient.type} o falta pool.`);
  return null;
}
