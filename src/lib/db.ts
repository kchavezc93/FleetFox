
// src/lib/db.ts
"use server";

import fs from "fs/promises";
import path from "path";
import { dbConnectionSchema, type DbConnectionSchema } from "@/lib/zod-schemas";
import sql from 'mssql'; // Descomentar si se instala y usa 'mssql': npm install mssql

const DB_CONFIG_PATH = path.resolve(process.cwd(), "src", "db.config.json");

let cachedDbConfig: DbConnectionSchema | null | undefined = undefined;
let dbPool: sql.ConnectionPool | null = null; // Ahora es global para el módulo

// Carga la configuración de la base de datos.
// Prioriza variables de entorno, luego intenta leer src/db.config.json como fallback para desarrollo local.
export async function loadDbConfig(): Promise<DbConnectionSchema | null> {
  if (cachedDbConfig !== undefined) {
    return cachedDbConfig;
  }

  const envConfig = {
    dbType: process.env.DB_TYPE,
    dbHost: process.env.DB_HOST,
    dbPort: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD, // Será string | undefined
    dbName: process.env.DB_NAME,
  };

  const requiredEnvVarsPresent = envConfig.dbType && envConfig.dbHost && envConfig.dbPort && envConfig.dbUser && envConfig.dbName;

  if (requiredEnvVarsPresent) {
    const validatedEnvConfig = dbConnectionSchema.safeParse(envConfig);
    if (validatedEnvConfig.success) {
      console.log("[DB Config] Usando configuración de base de datos desde variables de entorno.");
      cachedDbConfig = validatedEnvConfig.data;
      return cachedDbConfig;
    } else {
      console.warn("[DB Config] Variables de entorno para BD encontradas pero inválidas:", validatedEnvConfig.error.flatten().fieldErrors);
      // No continuar con variables de entorno inválidas, intentar fallback.
    }
  } else {
    const missingVars = Object.entries(envConfig)
      .filter(([key, value]) => key !== 'dbPassword' && !value) // dbPassword es opcional
      .map(([key]) => key);
    if (missingVars.length > 0) {
        console.log(`[DB Config] Variables de entorno requeridas (${missingVars.join(', ')}) no están completamente definidas. Intentando fallback a src/db.config.json...`);
    } else if (!requiredEnvVarsPresent) { // Si solo falta opcionales y no pasa schema, el schema dirá por qué
        console.log("[DB Config] Variables de entorno para BD no están completamente definidas o no pasan validación. Intentando fallback a src/db.config.json...");
    }
  }

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
      console.warn("[DB Config] Ni variables de entorno ni archivo src/db.config.json encontrados o válidos. La conexión a la BD no se puede establecer.");
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
  pool?: sql.ConnectionPool; // Específico para mssql
}

export async function getDbClient(): Promise<DbClient | null> {
  const config = await loadDbConfig();
  if (!config) {
    console.error("getDbClient: No se pudo cargar la configuración de la base de datos. Verifique variables de entorno o src/db.config.json.");
    return null;
  }

  // --- EJEMPLO DE IMPLEMENTACIÓN DE CONEXIÓN REAL PARA SQL SERVER ---
  if (config.dbType === "SQLServer") {
    // Si dbPool existe y está conectado, retornarlo.
    if (dbPool && dbPool.connected) {
      console.log("[SQL Server] Usando pool de conexión cacheado y activo.");
      return { type: config.dbType, configUsed: config, pool: dbPool };
    }

    // Si dbPool existe pero no está conectado, intentar cerrarlo antes de recrear.
    if (dbPool && !dbPool.connected) {
       console.warn("[SQL Server] Pool existente encontrado pero no conectado. Intentando cerrar y recrear...");
       try {
         await dbPool.close(); // Intentar cerrar el pool viejo y desconectado
       } catch (closeErr) {
         console.error('[SQL Server Error] Falla al cerrar el pool existente antes de recrear:', closeErr);
       }
       dbPool = null; // Descartar la instancia del pool viejo
    }

    // Si dbPool es null (nunca creado o recién anulado), crear uno nuevo.
    if (!dbPool) {
        try {
            const poolConfig: sql.config = {
                user: config.dbUser, // Zod schema asegura que estos existen si config no es null
                password: config.dbPassword || '', // Default a cadena vacía si es undefined
                server: config.dbHost,
                port: config.dbPort,
                database: config.dbName,
                options: {
                    encrypt: process.env.DB_ENCRYPT === 'true',
                    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
                },
                pool: { // Configuraciones de pool por defecto
                    max: 10,
                    min: 0,
                    idleTimeoutMillis: 30000
                }
            };
            
            if (!config.dbPassword) {
                console.warn(`[SQL Server] ADVERTENCIA: Conectando al servidor SQL sin contraseña para el usuario '${config.dbUser}'. Asegúrese de que esto sea intencional y seguro.`);
            }
            
            console.log(`[SQL Server] Creando nuevo pool de conexión para: ${poolConfig.user}@${poolConfig.server}:${poolConfig.port}/${poolConfig.database}`);
            
            const newPool = new sql.ConnectionPool(poolConfig);
            
            // Adjuntar manejador de errores ANTES de conectar
            newPool.on('error', err => {
                console.error('[SQL Server Pool Error Event Handler]', err);
                // Considerar estrategias más robustas aquí, como marcar el pool como inválido.
                // dbPool = null; // Podría anular dbPool aquí para forzar una recreación en el próximo getDbClient
            });

            await newPool.connect();
            dbPool = newPool; // Asignar a la variable global SOLO después de una conexión exitosa

            console.log("[SQL Server] Nuevo pool de conexión global a SQL Server establecido y cacheado.");
            return { type: config.dbType, configUsed: config, pool: dbPool };
        } catch (err) {
            console.error('[SQL Server Error] Falla al conectar o configurar el nuevo pool:', err);
            dbPool = null; // Asegurar que el pool sea null si la conexión falló
            return null; // Indicar fallo al obtener el cliente
        }
    }
    // Este punto no debería alcanzarse si la lógica del pool es correcta.
    // console.error("[SQL Server] Estado inesperado en la gestión del pool.");
    // return null;
  }
  // --- FIN DEL EJEMPLO PARA SQL SERVER ---

  console.warn(`[DB Client] Lógica de conexión para tipo de BD '${config.dbType}' no implementada o comentada en src/lib/db.ts. Se requiere implementación real.`);
  return {
    type: config.dbType,
    configUsed: config,
    // pool: undefined // Explicitamente no hay pool para otros tipos no implementados
  };
}

export async function clearDbConfigCache() {
  cachedDbConfig = undefined; // Limpiar caché de configuración
  if (dbPool) {
    console.log("[DB Cache] Cerrando y limpiando pool de conexión SQL Server existente...");
    try {
        await dbPool.close(); // Cerrar el pool de forma controlada
    } catch (err) {
        console.error("[DB Cache] Error al cerrar el pool de SQL Server:", err);
    } finally {
        dbPool = null; // Asegurar que la referencia al pool se limpie
    }
  }
  console.log("[DB Cache] Caché de configuración de BD y pool de conexiones (si existía) limpiados. Serán recreados en la próxima solicitud.");
}
