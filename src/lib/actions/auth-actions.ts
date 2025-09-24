
"use server";

import type { LoginSchema } from "@/lib/zod-schemas";
import type { UserProfile } from "@/types"; // Asegúrate de que UserProfile incluya passwordHash
import { getDbClient } from "@/lib/db";
import sql from 'mssql'; // Usando mssql
import bcrypt from 'bcryptjs'; // Para comparar contraseñas
import { cookies } from 'next/headers'; // Para manejo de sesiones seguras
import { randomBytes } from 'crypto'; // Para generar tokens de sesión seguros
// import { redirect } from 'next/navigation'; // Para redireccionar tras login exitoso
import { z } from 'zod';
import { recordAuditEvent } from '@/lib/actions/audit-actions';

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

  // Lógica de producción para SQL Server (sin sesiones aún)
  if (dbClient.type === "SQLServer") {
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    if (!pool) return { success: false, message: "Pool de SQL Server no disponible." };

    try {
      // Normalizar email (espacios y mayúsculas)
      const normalizedEmail = (data.email || "").trim().toLowerCase();

      // Limpieza oportunista de sesiones expiradas
      try {
        await pool.request().query('DELETE FROM sessions WHERE expiresAt <= GETDATE()');
      } catch { /* noop */ }

      const request = pool.request();
      request.input('email', sql.NVarChar(255), normalizedEmail);
      const result = await request.query(
        'SELECT id, username, email, passwordHash, role, permissions, createdAt, updatedAt FROM users WHERE LOWER(email) = @email AND (active = 1 OR active = CAST(1 AS BIT))'
      );

      if (result.recordset.length === 0) {
        return { success: false, message: "Usuario no encontrado o credenciales incorrectas." };
      }

      const userFromDb = result.recordset[0];
      const passwordHash: string = userFromDb.passwordHash || "";
      const passwordMatches = await bcrypt.compare(data.password, passwordHash);
      if (!passwordMatches) {
        return { success: false, message: "Usuario no encontrado o credenciales incorrectas." };
      }

      // Invalidar sesiones previas del usuario (single-session policy)
      try {
        const cleanupUserReq = pool.request();
        cleanupUserReq.input('userIdForCleanup', sql.NVarChar(50), userFromDb.id.toString());
        await cleanupUserReq.query('DELETE FROM sessions WHERE userId = @userIdForCleanup');
      } catch { /* noop */ }

      // Crear sesión (DB + Cookie HttpOnly)
      const token = randomBytes(32).toString('hex');
  const ttlDays = Number(((globalThis as any)?.process?.env?.SESSION_TTL_DAYS) ?? 7);
      const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

      const sessionReq = pool.request();
      sessionReq.input('userId', sql.NVarChar(50), userFromDb.id.toString());
      sessionReq.input('token', sql.NVarChar(128), token);
      sessionReq.input('expiresAt', sql.DateTime2, expiresAt);
      await sessionReq.query(`
        INSERT INTO sessions (userId, token, expiresAt, createdAt)
        VALUES (@userId, @token, @expiresAt, GETDATE());
      `);

      const cookieStore = await cookies();
      cookieStore.set({
        name: 'session_token',
        value: token,
        httpOnly: true,
  secure: (((globalThis as any)?.process?.env?.NODE_ENV) === 'production'), // En desarrollo, permitir cookies no seguras
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      });

      try { await recordAuditEvent({ eventType: 'LOGIN', actorUserId: userFromDb.id.toString(), actorUsername: userFromDb.username, message: 'User logged in' }); } catch {}

      return {
        success: true,
        message: "Inicio de sesión exitoso.",
      };
    } catch (error) {
      console.error(`[SQL Server Error] Error durante el inicio de sesión para ${data.email}:`, error);
      return {
        success: false,
        message: `Error del servidor durante el inicio de sesión. Por favor, inténtelo más tarde.`,
        errors: { form: `Error interno del servidor: ${(error as Error).message}` }
      };
    }
  } else {
    console.warn(`[Login] La autenticación no está implementada para el tipo de BD: ${dbClient.type}.`);
    return {
      success: false,
      message: `La autenticación no está implementada para el tipo de BD: ${dbClient.type}. Por favor, implemente la lógica SQL.`,
      errors: { form: `Tipo de BD ${dbClient.type} no soportado para autenticación.` }
    };
  }
}

export async function logoutUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    if (!token) {
      return { success: true, message: 'Sesión cerrada.' };
    }
    const dbClient = await getDbClient();
    if (dbClient?.type === 'SQLServer' && (dbClient as any).pool) {
      const pool = (dbClient as any).pool as sql.ConnectionPool;
      const req = pool.request();
      req.input('token', sql.NVarChar(128), token);
      await req.query('DELETE FROM sessions WHERE token = @token');
    }
    cookieStore.delete('session_token');
    try { await recordAuditEvent({ eventType: 'LOGOUT', message: 'User logged out' }); } catch {}
    return { success: true, message: 'Sesión cerrada.' };
  } catch (error) {
    console.error('[Logout Error]', error);
    return { success: false, message: 'Error al cerrar sesión.' };
  }
}

// Wrapper Server Action compatible with <form action={...}> signature
export async function logoutAction(_formData: FormData): Promise<void> {
  await logoutUser();
}

// Helper: get current user from session cookie
export async function getCurrentUser(): Promise<{ id: string; username: string; email: string; role: 'Admin'|'Standard' } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    if (!token) return null;
    const dbClient = await getDbClient();
    if (dbClient?.type !== 'SQLServer' || !(dbClient as any).pool) return null;
    const pool = (dbClient as any).pool as sql.ConnectionPool;
    const req = pool.request();
    req.input('token', sql.NVarChar(128), token);
    const res = await req.query(`
      SELECT u.id, u.username, u.email, u.role
      FROM sessions s
      INNER JOIN users u ON u.id = s.userId
      WHERE s.token = @token AND s.expiresAt > GETDATE();
    `);
    if (!res.recordset.length) return null;
    const row = res.recordset[0];
    return { id: row.id.toString(), username: row.username, email: row.email, role: row.role };
  } catch {
    return null;
  }
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string().min(6, 'Confirma la nueva contraseña'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Las contraseñas no coinciden',
});

export async function changeOwnPassword(data: z.infer<typeof changePasswordSchema>): Promise<{ success: boolean; message: string; errors?: Record<string,string> }> {
  const parsed = changePasswordSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, message: 'Datos inválidos', errors: parsed.error.flatten().fieldErrors as any };
  }
  const user = await getCurrentUser();
  if (!user) return { success: false, message: 'No autenticado' };
  const dbClient = await getDbClient();
  if (dbClient?.type !== 'SQLServer' || !(dbClient as any).pool) return { success: false, message: 'BD no disponible' };
  const pool = (dbClient as any).pool as sql.ConnectionPool;
  try {
    // fetch hash
    const req = pool.request();
    req.input('id', sql.NVarChar(50), user.id);
    const res = await req.query('SELECT passwordHash FROM users WHERE id = @id');
    if (!res.recordset.length) return { success: false, message: 'Usuario no encontrado' };
    const hash = res.recordset[0].passwordHash as string;
    const ok = await bcrypt.compare(parsed.data.currentPassword, hash);
    if (!ok) return { success: false, message: 'Contraseña actual incorrecta' };
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(parsed.data.newPassword, salt);
    const upd = pool.request();
    upd.input('id', sql.NVarChar(50), user.id);
    upd.input('hash', sql.NVarChar(255), newHash);
    await upd.query('UPDATE users SET passwordHash = @hash, updatedAt = GETDATE() WHERE id = @id');
    // invalidate sessions
    const inv = pool.request();
    inv.input('id', sql.NVarChar(50), user.id);
    await inv.query('DELETE FROM sessions WHERE userId = @id');
    // remove cookie
    const cookieStore = await cookies();
    cookieStore.delete('session_token');
    try { await recordAuditEvent({ eventType: 'PASSWORD_CHANGED', actorUserId: user.id, actorUsername: user.username, message: 'User changed own password' }); } catch {}
    return { success: true, message: 'Contraseña actualizada. Inicia sesión nuevamente.' };
  } catch (err) {
    console.error('[Auth] changeOwnPassword error', err);
    return { success: false, message: 'Error al cambiar contraseña' };
  }
}
