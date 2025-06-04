
"use server";

import type { LoginSchema } from "@/lib/zod-schemas";
import type { UserProfile } from "@/types"; // Asegúrate de que UserProfile incluya passwordHash
import { getDbClient } from "@/lib/db";
// import sql from 'mssql'; // Descomentar si usas mssql
// import bcrypt from 'bcryptjs'; // Descomentar si usas bcryptjs para comparar contraseñas
// import { cookies } from 'next/headers'; // Para manejo de sesiones seguras
// import { randomBytes } from 'crypto'; // Para generar tokens de sesión seguros
// import { redirect } from 'next/navigation'; // Para redireccionar tras login exitoso

// PRODUCCIÓN: Consideraciones de seguridad para la autenticación:
// - Usar HTTPS en todo momento.
// - Almacenar contraseñas hasheadas y salteadas (bcrypt es una buena opción).
// - Implementar protección contra ataques de fuerza bruta (rate limiting, CAPTCHA).
// - Gestión de sesiones segura: tokens opacos, cookies HttpOnly, Secure, SameSite.
// - Mecanismos de recuperación de contraseña seguros.
// - Auditoría de eventos de seguridad (intentos de login, cambios de contraseña, etc.).

export async function loginUser(data: LoginSchema) {
  const dbClient = await getDbClient();

  if (!dbClient) {
    console.error("[Login Error] Configuración de BD no encontrada.");
    // PRODUCCIÓN: logger.error({ action: 'loginUser', email: data.email, reason: 'DB config not found' });
    return { 
      success: false, 
      message: "Error de configuración: No se pudo conectar a la base de datos. Por favor, revise la página de Configuración.",
      errors: { form: "Configuración de BD requerida." }
    };
  }

  // PRODUCCIÓN: logger.info({ action: 'loginUser', dbType: dbClient.type, email: data.email }, "Login attempt started");

  // --- EJEMPLO DE LÓGICA DE PRODUCCIÓN PARA SQL SERVER (IMPLEMENTACIÓN REAL NECESARIA) ---
  /*
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) return { success: false, message: "Pool de SQL Server no disponible." };
    
    try {
      const request = pool.request();
      request.input('email', sql.NVarChar(255), data.email);
      // Seleccionar todos los campos necesarios para crear el perfil de usuario y verificar la contraseña.
      // NO devolver passwordHash al cliente después del login.
      const result = await request.query(
        'SELECT id, username, email, passwordHash, role, permissions, createdAt, updatedAt FROM users WHERE email = @email'
      );

      if (result.recordset.length === 0) {
        // PRODUCCIÓN: Loguear intento de inicio de sesión fallido (sin revelar si el usuario existe o no).
        // logger.warn({ action: 'loginUser', email: data.email, reason: "User not found" }, "Failed login attempt - user not found");
        return { success: false, message: "Usuario no encontrado o credenciales incorrectas." };
      }

      const userFromDb = result.recordset[0];
      const user: UserProfile = { // Este tipo UserProfile es para uso interno aquí, no se devuelve completo al cliente
          id: userFromDb.id.toString(),
          username: userFromDb.username,
          email: userFromDb.email,
          passwordHash: userFromDb.passwordHash, // Esencial para comparar
          role: userFromDb.role,
          permissions: JSON.parse(userFromDb.permissions || "[]"), // Asumir que permissions se guarda como JSON string
          createdAt: new Date(userFromDb.createdAt).toISOString(),
          updatedAt: new Date(userFromDb.updatedAt).toISOString(),
      };

      // PRODUCCIÓN: Verificar la contraseña usando bcrypt.
      // const passwordMatches = await bcrypt.compare(data.password, user.passwordHash);
      // if (!passwordMatches) {
      //   // PRODUCCIÓN: Loguear intento de inicio de sesión fallido.
      //   // logger.warn({ action: 'loginUser', email: data.email, userId: user.id, reason: "Incorrect password" }, "Failed login attempt - incorrect password");
      //   return { success: false, message: "Usuario no encontrado o credenciales incorrectas." };
      // }

      // --- Lógica de Creación de Sesión Segura (Conceptual) ---
      // 1. Generar un token de sesión seguro y único.
      //    const sessionToken = randomBytes(32).toString('hex');
      //    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Ejemplo: 7 días de expiración

      // 2. Almacenar el token de sesión en la base de datos (tabla 'sessions').
      //    Asociarlo al userId, incluir user-agent, IP (para mayor seguridad) y fecha de expiración.
      //    Esto permite invalidar sesiones desde el servidor si es necesario.
      //    const sessionRequest = pool.request();
      //    sessionRequest.input('userId', sql.NVarChar(50), user.id);
      //    sessionRequest.input('token', sql.NVarChar(64), sessionToken); // El token hasheado o no, según estrategia
      //    sessionRequest.input('expiresAt', sql.DateTime, expiresAt);
      //    // sessionRequest.input('userAgent', sql.NVarChar(255), headers().get('user-agent')); // Ejemplo
      //    // sessionRequest.input('ipAddress', sql.NVarChar(50), headers().get('x-forwarded-for')?.split(',')[0] || ''); // Ejemplo
      //    await sessionRequest.query('INSERT INTO sessions (userId, token, expiresAt /*, userAgent, ipAddress* /) VALUES (@userId, @token, @expiresAt /*, @userAgent, @ipAddress* /)');
      
      // 3. Establecer una cookie HttpOnly, Secure (en producción), Path y SameSite.
      //    cookies().set('session_token', sessionToken, {
      //      httpOnly: true,
      //      secure: process.env.NODE_ENV === 'production',
      //      expires: expiresAt,
      //      path: '/',
      //      sameSite: 'lax', // 'strict' o 'lax'
      //    });
      // --- Fin de Lógica de Sesión Conceptual ---

      // PRODUCCIÓN: Loguear inicio de sesión exitoso.
      // logger.info({ action: 'loginUser', userId: user.id, email: user.email }, "User logged in successfully");
      
      // PRODUCCIÓN: Redirigir al dashboard después de un inicio de sesión exitoso.
      // redirect('/dashboard'); // Si se llama redirect(), no se puede devolver un objeto.
      //                       // La gestión de la sesión se encargaría de dar acceso.

      console.log(`[SQL Server] Inicio de sesión exitoso para ${user.email} (simulado). Implementar gestión de sesión real y redirección.`);
      return { 
        success: true, 
        message: "Inicio de sesión exitoso. La gestión de sesión y redirección necesitan implementación.", 
        // NO devolver el objeto 'user' completo, especialmente passwordHash.
        // La información del usuario para la UI se cargaría desde la sesión en el layout/componentes.
      };

    } catch (error) {
      // PRODUCCIÓN: Loguear el error real del servidor.
      // logger.error({ action: 'loginUser', email: data.email, error: (error as Error).message, stack: (error as Error).stack }, "Server error during login");
      console.error(`[SQL Server Error] Error durante el inicio de sesión para ${data.email}:`, error);
      return { 
        success: false, 
        message: `Error del servidor durante el inicio de sesión. Por favor, inténtelo más tarde.`, // Mensaje genérico para el usuario
        errors: { form: `Error interno del servidor: ${(error as Error).message}` }
      };
    }
  } else {
    console.warn(`[Login] La autenticación no está implementada para el tipo de BD: ${dbClient.type}.`);
    return { 
        success: false, 
        message: `La autenticación no está implementada para el tipo de BD: ${dbClient.type}. Por favor, implemente la lógica SQL.`,
        errors: { form: `Tipo de BD ${dbClient.type} no soportado para autenticación.`}
    };
  }
  */

  // Lógica actual para cuando no se implementa SQL Server
  console.log(`[Login User] Lógica SQL pendiente para DB tipo: ${dbClient.type}. Autenticación no realizada.`);
  return { 
    success: false, 
    message: `Autenticación pendiente de implementación SQL para el tipo de BD '${dbClient.type}'.`,
    errors: { form: `Implementación SQL pendiente para ${dbClient.type}.` }
  };
}
