
// src/lib/db.ts
"use server";

import fs from "fs/promises";
import path from "path";
import { dbConnectionSchema, type DbConnectionSchema } from "@/lib/zod-schemas";
// import sql from 'mssql'; // Descomentar si se instala y usa 'mssql': npm install mssql

const DB_CONFIG_PATH = path.resolve(process.cwd(), "src", "db.config.json");

let cachedDbConfig: DbConnectionSchema | null | undefined = undefined;
// let dbPool: sql.ConnectionPool | null = null; // Descomentar si se usa un pool de mssql global

// Carga la configuración de la base de datos.
// Prioriza variables de entorno, luego intenta leer src/db.config.json como fallback para desarrollo local.
export async function loadDbConfig(): Promise<DbConnectionSchema | null> {
  if (cachedDbConfig !== undefined) {
    return cachedDbConfig;
  }

  // Intentar cargar desde variables de entorno primero
  const envConfig = {
    dbType: process.env.DB_TYPE,
    dbHost: process.env.DB_HOST,
    dbPort: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,
  };

  // Validar si las variables de entorno proporcionan una configuración completa
  // Permitimos que dbPassword sea opcional aquí, ya que podría no ser necesario para todos los tipos de BD o configuraciones.
  if (envConfig.dbType && envConfig.dbHost && envConfig.dbPort && envConfig.dbUser && envConfig.dbName) {
    const validatedEnvConfig = dbConnectionSchema.safeParse(envConfig);
    if (validatedEnvConfig.success) {
      console.log("[DB Config] Usando configuración de base de datos desde variables de entorno.");
      cachedDbConfig = validatedEnvConfig.data;
      return cachedDbConfig;
    } else {
      console.warn("[DB Config] Variables de entorno para BD encontradas pero inválidas:", validatedEnvConfig.error.flatten().fieldErrors);
    }
  } else {
    console.log("[DB Config] Variables de entorno para BD no están completamente definidas. Intentando fallback a src/db.config.json...");
  }

  // Fallback a src/db.config.json si las variables de entorno no están (completamente) configuradas
  try {
    const fileContent = await fs.readFile(DB_CONFIG_PATH, "utf-8");
    const configFromFile = JSON.parse(fileContent);
    const validatedFileConfig = dbConnectionSchema.safeParse(configFromFile);
    if (validatedFileConfig.success) {
      console.warn("[DB Config] ADVERTENCIA: Usando configuración de BD desde src/db.config.json. Se recomienda usar variables de entorno para producción.");
      cachedDbConfig = validatedFileConfig.data;
      return cachedDbConfig;
    }
    console.warn("[DB Config] El archivo src/db.config.json contiene datos inválidos:", validatedFileConfig.error.flatten().fieldErrors);
    cachedDbConfig = null;
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn("[DB Config] Ni variables de entorno ni archivo src/db.config.json encontrados. La conexión a la BD no se puede establecer.");
    } else {
      console.error("[DB Config] Error cargando la configuración de la BD desde src/db.config.json:", error);
    }
    cachedDbConfig = null;
    return null;
  }
}

export interface DbClient {
  type: string;
  configUsed: DbConnectionSchema;
  // pool?: sql.ConnectionPool; // Descomentar para mssql
}

export async function getDbClient(): Promise<DbClient | null> {
  const config = await loadDbConfig();
  if (!config) {
    console.error("getDbClient: No se pudo cargar la configuración de la base de datos. Verifique variables de entorno o src/db.config.json.");
    return null;
  }

  // --- EJEMPLO DE IMPLEMENTACIÓN DE CONEXIÓN REAL PARA SQL SERVER ---
  // --- (DESCOMENTAR Y ADAPTAR CUANDO ESTÉS LISTO PARA CONECTAR) ---
  /*
  if (config.dbType === "SQLServer") {
    if (dbPool && dbPool.connected) {
      console.log("[SQL Server] Usando pool de conexión cacheado y activo.");
      return { type: config.dbType, configUsed: config, pool: dbPool };
    }
    if (dbPool && !dbPool.connected) {
       console.log("[SQL Server] Pool existente encontrado pero no conectado. Intentando reconectar...");
       try {
         await dbPool.connect();
         console.log("[SQL Server] Pool de conexión existente reconectado exitosamente.");
         return { type: config.dbType, configUsed: config, pool: dbPool };
       } catch (err) {
         console.error('[SQL Server Error] Falla al reconectar el pool existente:', err);
         dbPool = null;
       }
    }

    if (!dbPool) {
        try {
            console.log(`[SQL Server] Creando nuevo pool de conexión para: ${config.dbUser}@${config.dbHost}:${config.dbPort}/${config.dbName}`);
            const poolConfig: sql.config = {
                user: config.dbUser,
                password: config.dbPassword, // Se lee desde config (env var o db.config.json)
                server: config.dbHost,
                port: config.dbPort,
                database: config.dbName,
                options: {
                    encrypt: process.env.DB_ENCRYPT === 'true', // Ej: true para Azure SQL, false para local con ciertos certs.
                    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true', // Para desarrollo local podría ser true. Para producción, usualmente false.
                },
                pool: {
                    max: 10,
                    min: 0,
                    idleTimeoutMillis: 30000
                }
            };
            
            dbPool = new sql.ConnectionPool(poolConfig);
            await dbPool.connect();
            
            dbPool.on('error', err => {
                console.error('[SQL Server Pool Error]', err);
                // dbPool = null; // Podrías querer anularlo para forzar recreación
            });

            console.log("[SQL Server] Nuevo pool de conexión global a SQL Server establecido y cacheado.");
            return { type: config.dbType, configUsed: config, pool: dbPool };
        } catch (err) {
            console.error('[SQL Server Error] Falla al conectar o configurar el nuevo pool:', err);
            dbPool = null; 
            return null; 
        }
    }
    return null; // Debería ser inalcanzable si la lógica del pool es correcta
  }
  // --- FIN DEL EJEMPLO PARA SQL SERVER ---
  */

  console.warn(`[DB Client] Lógica de conexión para tipo de BD '${config.dbType}' no implementada o comentada en src/lib/db.ts. Se requiere implementación real.`);
  return {
    type: config.dbType,
    configUsed: config,
  };
}

export async function clearDbConfigCache() {
  cachedDbConfig = undefined;
  /*
  if (dbPool) {
    console.log("[DB Cache] Cerrando pool de conexión SQL Server existente...");
    try {
        await dbPool.close();
    } catch (err) {
        console.error("[DB Cache] Error al cerrar el pool de SQL Server:", err);
    } finally {
        dbPool = null;
    }
  }
  */
  console.log("[DB Cache] Caché de configuración de BD limpiada. El pool de conexiones (si existe) será recreado en la próxima solicitud.");
}
