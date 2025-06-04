
"use server";

import type { UserSchema } from "@/lib/zod-schemas";
import type { UserProfile } from "@/types";
import { getDbClient } from "@/lib/db";
// import { revalidatePath } from "next/cache";
// import sql from 'mssql';
// import bcrypt from 'bcryptjs'; // npm install bcryptjs @types/bcryptjs

// PRODUCCIÓN: Consideraciones adicionales para la gestión de usuarios:
// - Validación de permisos: Asegurar que el usuario que realiza la acción tenga los permisos necesarios.
// - Auditoría: Registrar quién hizo qué cambio y cuándo.
// - Protección contra enumeración de usuarios si es un sistema público.
// - Flujo de "olvidé mi contraseña" seguro.
// - Política de contraseñas robusta.

export async function saveUser(data: UserSchema, existingId?: string): Promise<{ success: boolean; message: string; errors?: Record<string, string>; userId?: string }> {
  const dbClient = await getDbClient();

  if (!dbClient) {
    console.error("[Save User Error] Configuración de BD no encontrada o conexión fallida.");
    // PRODUCCIÓN: logger.error({ module: 'user-actions', action: 'saveUser', email: data.email, reason: 'DB client not available' });
    return { 
      success: false, 
      message: "Error: Cliente de base de datos no disponible o conexión fallida. No se pudo guardar el usuario. Por favor, revise la configuración de variables de entorno.",
      errors: { form: "Error de conexión a BD." }
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

  // --- EJEMPLO DE LÓGICA DE PRODUCCIÓN PARA SQL SERVER (IMPLEMENTACIÓN REAL NECESARIA) ---
  /*
  if (dbClient.type === "SQLServer" && dbClient.pool) {
    const pool = dbClient.pool;
    
    try {
      let hashedPassword = "";
      if (data.password) {
        // const salt = await bcrypt.genSalt(10); // Costo de hashing (usualmente 10-12)
        // hashedPassword = await bcrypt.hash(data.password, salt);
        // Para demostración, NO USAR EN PRODUCCIÓN:
        hashedPassword = "hashed_" + data.password + "_example_NO_USAR_EN_PROD"; 
        // PRODUCCIÓN: logger.info({ module: 'user-actions', action: 'saveUser', email: data.email }, "Password provided, proceeding with hashing.");
      }
      
      // Guardar permisos como una cadena JSON. SQL Server tiene soporte JSON.
      // Podrías usar NVARCHAR(MAX) para esta columna.
      const permissionsJson = JSON.stringify(data.permissions || []);

      if (existingId) { // Actualizar usuario existente
        // PRODUCCIÓN: logger.info({ module: 'user-actions', action: 'saveUser', subAction: 'update', userId: existingId, email: data.email });
        
        // Verificar si el email o username ya existen para OTRO usuario
        const checkUpdateRequest = pool.request();
        checkUpdateRequest.input('checkEmail_upd', sql.NVarChar(255), data.email);
        checkUpdateRequest.input('checkUsername_upd', sql.NVarChar(100), data.username);
        checkUpdateRequest.input('currentId_upd', sql.NVarChar(50), existingId);
        const checkUpdateResult = await checkUpdateRequest.query(
          'SELECT id, email, username FROM users WHERE (email = @checkEmail_upd OR username = @checkUsername_upd) AND id <> @currentId_upd'
        );
        
        if (checkUpdateResult.recordset.length > 0) {
            const errors: Record<string, string> = {};
            if (checkUpdateResult.recordset.some(u => u.email === data.email)) errors.email = "Este correo electrónico ya está en uso por otro usuario.";
            if (checkUpdateResult.recordset.some(u => u.username === data.username)) errors.username = "Este nombre de usuario ya está en uso por otro usuario.";
            // PRODUCCIÓN: logger.warn({ module: 'user-actions', action: 'saveUser', subAction: 'update', userId: existingId, reason: 'Duplicate email/username for other user' });
            return { success: false, message: "El correo electrónico o nombre de usuario ya existe para otro usuario.", errors };
        }

        const updateRequest = pool.request();
        updateRequest.input('id_upd_val', sql.NVarChar(50), existingId);
        updateRequest.input('email_upd_val', sql.NVarChar(255), data.email);
        updateRequest.input('username_upd_val', sql.NVarChar(100), data.username);
        updateRequest.input('fullName_upd_val', sql.NVarChar(255), data.fullName || null); // Permitir null para fullName
        updateRequest.input('role_upd_val', sql.NVarChar(50), data.role);
        updateRequest.input('permissions_upd_val', sql.NVarChar(sql.MAX), permissionsJson);

        let queryUpdate = \`
          UPDATE users 
          SET email = @email_upd_val, username = @username_upd_val, fullName = @fullName_upd_val, 
              role = @role_upd_val, permissions = @permissions_upd_val, updatedAt = GETDATE()
        \`;
        if (hashedPassword) { // Solo actualizar hash si se proveyó nueva contraseña
          queryUpdate += \`, passwordHash = @passwordHash_upd_val\`;
          updateRequest.input('passwordHash_upd_val', sql.NVarChar(255), hashedPassword); // Ajustar longitud según hash bcrypt
        }
        queryUpdate += \` WHERE id = @id_upd_val;\`;
        
        await updateRequest.query(queryUpdate);
        // PRODUCCIÓN: logger.info({ module: 'user-actions', action: 'saveUser', subAction: 'update', userId: existingId, status: 'success' });
        // revalidatePath("/users");
        // revalidatePath(\`/users/\${existingId}\`); // Si tienes una página de perfil de usuario
        return { success: true, message: \`Usuario \${data.email} actualizado exitosamente.\`, userId: existingId };

      } else { // Crear nuevo usuario
        // PRODUCCIÓN: logger.info({ module: 'user-actions', action: 'saveUser', subAction: 'create', email: data.email });
        
        // Verificar si el email o username ya existen
        const checkCreateRequest = pool.request();
        checkCreateRequest.input('checkEmail_ins', sql.NVarChar(255), data.email);
        checkCreateRequest.input('checkUsername_ins', sql.NVarChar(100), data.username);
        const checkCreateResult = await checkCreateRequest.query(
          'SELECT id FROM users WHERE email = @checkEmail_ins OR username = @checkUsername_ins'
        );

        if (checkCreateResult.recordset.length > 0) {
            const errors: Record<string, string> = {};
            if (checkCreateResult.recordset.some(u => u.email === data.email)) errors.email = "Este correo electrónico ya está en uso.";
            if (checkCreateResult.recordset.some(u => u.username === data.username)) errors.username = "Este nombre de usuario ya está en uso.";
            // PRODUCCIÓN: logger.warn({ module: 'user-actions', action: 'saveUser', subAction: 'create', email: data.email, reason: 'Duplicate email/username' });
            return { success: false, message: "El correo electrónico o nombre de usuario ya existe.", errors };
        }

        if (!hashedPassword) {
            // PRODUCCIÓN: logger.error({ module: 'user-actions', action: 'saveUser', subAction: 'create', email: data.email, reason: 'Hashed password missing for new user' });
            return { success: false, message: "Error interno: Intento de crear usuario sin contraseña hasheada."};
        }

        const insertRequest = pool.request();
        // ID: Generalmente autogenerado por la BD (IDENTITY o UNIQUEIDENTIFIER con NEWID()).
        // Si usas GUID generado por la app:
        // const newUserId = uuidv4(); // npm install uuid
        // insertRequest.input('id_ins_val', sql.NVarChar(50), newUserId); 
        insertRequest.input('email_ins_val', sql.NVarChar(255), data.email);
        insertRequest.input('username_ins_val', sql.NVarChar(100), data.username);
        insertRequest.input('fullName_ins_val', sql.NVarChar(255), data.fullName || null);
        insertRequest.input('passwordHash_ins_val', sql.NVarChar(255), hashedPassword); // Ajustar longitud para bcrypt
        insertRequest.input('role_ins_val', sql.NVarChar(50), data.role); // Ej: 'Standard' por defecto, luego el primer admin se actualiza manualmente.
        insertRequest.input('permissions_ins_val', sql.NVarChar(sql.MAX), permissionsJson);
        
        // Nota sobre el primer usuario administrador:
        // Generalmente, el primer usuario se crea con un rol estándar, y luego se
        // actualiza manualmente en la base de datos a 'Admin'. O se usa un script de "seed"
        // para crear el administrador inicial.
        // Si 'role_ins_val' es 'Admin' aquí, asegúrate de que esto sea una acción controlada.

        const resultInsert = await insertRequest.query(\`
          INSERT INTO users (email, username, fullName, passwordHash, role, permissions, createdAt, updatedAt)
          OUTPUT INSERTED.id -- Importante para obtener el ID generado por la BD si es IDENTITY
          VALUES (@email_ins_val, @username_ins_val, @fullName_ins_val, @passwordHash_ins_val, @role_ins_val, @permissions_ins_val, GETDATE(), GETDATE());
        \`);
        
        if (resultInsert.recordset.length === 0 || !resultInsert.recordset[0].id) {
            // PRODUCCIÓN: logger.error({ module: 'user-actions', action: 'saveUser', subAction: 'create', email: data.email, reason: 'No ID returned from DB' });
            throw new Error("Fallo al crear el usuario, la base de datos no devolvió un ID.");
        }
        const newUserIdFromDb = resultInsert.recordset[0].id.toString();
        // PRODUCCIÓN: logger.info({ module: 'user-actions', action: 'saveUser', subAction: 'create', newUserId: newUserIdFromDb, email: data.email, status: 'success' });
        // revalidatePath("/users");
        return { success: true, message: \`Usuario \${data.email} creado exitosamente.\`, userId: newUserIdFromDb };
      }
    } catch (error) {
      // PRODUCCIÓN: logger.error({ module: 'user-actions', action: 'saveUser', email: data.email, existingId, error: (error as Error).message, stack: (error as Error).stack }, "Server error during user save");
      console.error(\`[SQL Server Error] Error al guardar usuario \${data.email}:\`, error);
      // Manejar errores específicos de BD, ej. violación de constraint UNIQUE para email/username
      // if ((error as sql.MSSQLError).number === 2627 || (error as sql.MSSQLError).number === 2601) { 
      //   return { success: false, message: "El correo electrónico o nombre de usuario ya existe.", errors: { form: "Conflicto de datos únicos." } };
      // }
      return { 
        success: false, 
        message: \`Error del servidor al procesar usuario. Detalles: \${(error as Error).message}\`,
        errors: { form: "Error de base de datos." }
      };
    }
  } else {
    // PRODUCCIÓN: logger.warn({ module: 'user-actions', action: 'saveUser', dbType: dbClient.type, reason: 'DB type not implemented or pool missing' });
    console.warn(\`[Save User] La gestión de usuarios no está implementada para el tipo de BD: \${dbClient.type} o el pool de conexión no está disponible. Usuario no guardado.\`);
    return { 
        success: false, 
        message: \`La gestión de usuarios no está implementada para el tipo de BD: \${dbClient.type} o falta el pool. Implemente la lógica SQL y la conexión.\`,
        errors: { form: "Tipo de BD no soportado o error de conexión." }
    };
  }
  */
  
  // Bloque de marcador de posición si la lógica SQL está comentada o no implementada
  const actionType = existingId ? 'actualizado' : 'creado';
  console.log(`[Save User] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Usuario ${actionType} (simulado).`);
  return { 
    success: true, // Simulado
    message: `Usuario ${data.email} ${actionType} (simulado). Implementación SQL pendiente para ${dbClient.type}.`,
    userId: existingId || "simulated-new-user-id" 
  };
}

export async function getUsers(): Promise<UserProfile[]> {
    const dbClient = await getDbClient();
    if (!dbClient) {
        console.error("getUsers: Configuración de BD no encontrada o conexión fallida. Devolviendo lista vacía.");
        // PRODUCCIÓN: logger.error({ module: 'user-actions', action: 'getUsers', reason: 'DB client not available' });
        return [];
    }
    // PRODUCCIÓN: logger.info({ module: 'user-actions', action: 'getUsers', dbType: dbClient.type }, "Attempting to fetch all users");

    // --- EJEMPLO DE LÓGICA DE PRODUCCIÓN PARA SQL SERVER (IMPLEMENTACIÓN REAL NECESARIA) ---
    /*
    if (dbClient.type === "SQLServer" && dbClient.pool) {
        const pool = dbClient.pool;
        try {
            const request = pool.request();
            // NUNCA SE DEVUELVE passwordHash al listar usuarios
            const result = await request.query(
                'SELECT id, username, email, fullName, role, permissions, createdAt, updatedAt FROM users ORDER BY username ASC'
            );
            return result.recordset.map(row => ({
                id: row.id.toString(),
                username: row.username,
                email: row.email,
                fullName: row.fullName || "", // Asegurar que fullName no sea null si es opcional
                passwordHash: "", // Importante: No exponer el hash
                role: row.role as "Admin" | "Standard", // Hacer cast al tipo esperado
                permissions: row.permissions ? JSON.parse(row.permissions) : [], // Parsear JSON de permisos
                createdAt: new Date(row.createdAt).toISOString(),
                updatedAt: new Date(row.updatedAt).toISOString(),
            })) as UserProfile[];
        } catch (error) {
            // PRODUCCIÓN: logger.error({ module: 'user-actions', action: 'getUsers', error: (error as Error).message, stack: (error as Error).stack }, "Failed to fetch users");
            console.error('[SQL Server Error] Error al obtener usuarios:', error);
            return [];
        }
    } else {
        // PRODUCCIÓN: logger.warn({ module: 'user-actions', action: 'getUsers', dbType: dbClient.type, reason: 'DB type not implemented or pool missing' });
        console.warn(\`[Get Users] La obtención de usuarios no está implementada para el tipo de BD: \${dbClient.type} o falta el pool. Devolviendo lista vacía.\`);
        return [];
    }
    */
    
    // Bloque de marcador de posición si la lógica SQL está comentada o no implementada
    console.log(`[Get Users] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Devolviendo lista vacía.`);
    return [];
}

export async function deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    const dbClient = await getDbClient();
    if (!dbClient) {
        console.error(`deleteUser(${id}): Error de configuración de BD o conexión fallida. No se pudo eliminar el usuario.`);
        // PRODUCCIÓN: logger.error({ module: 'user-actions', action: 'deleteUser', userId: id, reason: 'DB client not available' });
        return { success: false, message: "Error: Cliente de base de datos no disponible o conexión fallida. No se pudo eliminar el usuario."};
    }
    // PRODUCCIÓN: logger.info({ module: 'user-actions', action: 'deleteUser', dbType: dbClient.type, userId: id }, "Attempting to delete user");

    // --- EJEMPLO DE LÓGICA DE PRODUCCIÓN PARA SQL SERVER (IMPLEMENTACIÓN REAL NECESARIA) ---
    /*
    if (dbClient.type === "SQLServer" && dbClient.pool) {
        const pool = dbClient.pool;
        try {
            // PRODUCCIÓN: Considerar "soft delete" (marcar como inactivo) en lugar de borrado físico,
            // especialmente si hay referencias al usuario en otras tablas (ej. logs de auditoría).
            // Para un borrado físico:
            const request = pool.request();
            request.input('idToDelete_usr', sql.NVarChar(50), id);
            const result = await request.query('DELETE FROM users WHERE id = @idToDelete_usr;');
            
            if (result.rowsAffected[0] === 0) {
                 // PRODUCCIÓN: logger.warn({ module: 'user-actions', action: 'deleteUser', userId: id, reason: 'Not found for deletion' });
                 return { success: false, message: \`Usuario ID: \${id} no encontrado para eliminar.\` };
            }
            // PRODUCCIÓN: logger.info({ module: 'user-actions', action: 'deleteUser', userId: id, status: 'success' });
            // revalidatePath("/users");
            return { success: true, message: \`Usuario ID: \${id} eliminado exitosamente.\` };
        } catch (error) {
            // PRODUCCIÓN: logger.error({ module: 'user-actions', action: 'deleteUser', userId: id, error: (error as Error).message, stack: (error as Error).stack }, "Failed to delete user");
            console.error(\`[SQL Server Error] Error al eliminar usuario ${id}:\`, error);
            // Podría fallar debido a foreign key constraints si el usuario está referenciado en otras tablas.
            // En ese caso, se debería impedir la eliminación o usar "soft delete".
            return { success: false, message: \`Error al eliminar usuario. Detalles: \${(error as Error).message}\` };
        }
    } else {
        // PRODUCCIÓN: logger.warn({ module: 'user-actions', action: 'deleteUser', userId: id, dbType: dbClient.type, reason: 'DB type not implemented or pool missing' });
        console.warn(\`[Delete User] La eliminación de usuarios no está implementada para el tipo de BD: \${dbClient.type} o falta el pool.\`);
        return { 
          success: false, 
          message: \`La eliminación de usuarios no está implementada para \${dbClient.type} o falta el pool. Implemente la lógica SQL y la conexión.\` 
        };
    }
    */
    
    // Bloque de marcador de posición si la lógica SQL está comentada o no implementada
    console.log(`[Delete User] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Usuario ID: ${id} no eliminado.`);
    // revalidatePath("/users"); // Asumiendo que tienes una página que lista usuarios
    return { 
      success: true, // Simulado
      message: \`Usuario ID: \${id} eliminado (simulado). Implementación SQL pendiente para \${dbClient.type}.\` 
    };
}
