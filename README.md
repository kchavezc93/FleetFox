
# FleetFox (Dos Robles) - Aplicación de Gestión de Flota

Aplicación Next.js para gestionar flota vehicular: mantenimientos, combustible, usuarios, sesiones y reportes con agregaciones SQL.

## Stack técnico y scripts

- Next.js 15 (App Router)
- React 18, TypeScript, React Hook Form + Zod
- TailwindCSS + shadcn/ui (Radix UI)
- TanStack Query v5 (para datos cliente cuando aplica)
- SQL Server (mssql) como base de datos
- ExcelJS para exportaciones a XLSX (reemplaza libs vulnerables)

Scripts disponibles en `package.json`:

- `npm run dev`: arranca Next en modo dev (puerto 9002)
- `npm run build`: build de producción
- `npm run start`: servir la build
- `npm run lint`: ESLint (ignorado en build por `next.config.ts`)
- `npm run typecheck`: verificación de tipos (tsc)

## Prerrequisitos

1.  **Node.js**: Asegúrate de tener Node.js instalado (versión 18.x o superior recomendada). Puedes descargarlo desde [nodejs.org](https://nodejs.org/).
2.  **SQL Server**: Necesitarás una instancia de SQL Server (Express, Developer, Standard, etc.) accesible para la aplicación.
3.  **npm o yarn**: Administrador de paquetes de Node.js.

## Configuración del Proyecto

1.  **Clonar el Repositorio (si aplica)**:
    ```bash
    git clone <tu-repositorio-url>
    cd <nombre-del-directorio-del-proyecto>
    ```

2.  **Instalar Dependencias** (Windows PowerShell):
    ```powershell
    npm install
    ```
    Esto instalará Next.js, React, TailwindCSS, ShadCN UI, y otras dependencias como `mssql` (para SQL Server) y `bcryptjs` (para contraseñas).

3.  **Variables de Entorno**:
    - Copia `.env.example` a `.env` y completa los valores.
    - La app prioriza variables de entorno; en desarrollo puede usar un fallback de archivo (ver abajo).

4.  **Ejecutar en desarrollo (Windows PowerShell)**:
    ```powershell
    npm run dev
    ```
    Esto arrancará en `http://localhost:9002`.

## Esquema de Base de Datos (fuente única)

La fuente de verdad del esquema está unificada en un solo script idempotente:

- `docs/db/fleetfox_schema.sql`

Ese archivo crea/actualiza todas las tablas, índices y restricciones requeridas por la app (users, sessions, vehicles, fueling_logs, fueling_vouchers, maintenance_logs, attached_documents, settings, audit_events). Cualquier cambio futuro del esquema debe realizarse ahí.

Cómo aplicarlo (opciones):

- SSMS/Azure Data Studio: abre `docs/db/fleetfox_schema.sql` conectado a tu base de datos y ejecútalo.
- PowerShell con sqlcmd (usuario/contraseña):

```powershell
sqlcmd -S your-sql-host,1433 -d YourDatabase -U your_user -P your_password -b -i "docs\db\fleetfox_schema.sql"
```

- PowerShell con autenticación integrada (Trusted Connection):

```powershell
sqlcmd -S .\SQLEXPRESS -d FleetFox -E -b -i "docs\db\fleetfox_schema.sql"
```

Notas
- El script es idempotente: puedes ejecutarlo múltiples veces sin duplicar objetos.

### Fallback local para configuración de BD

Para desarrollo, si las variables de entorno no están completas, `src/lib/db.ts` intentará leer `src/db.config.json`.

- Usa `src/db.config.example.json` como referencia y crea `src/db.config.json` local (no lo subas con credenciales reales).
- En producción, usa únicamente variables de entorno.

## Configuración de la Aplicación

1.  **Variables de Entorno**:
    *   Crea un archivo `.env` en la raíz del proyecto copiando `.env.example`.
    *   Actualiza las variables en `.env`:
    *   `NEXT_PUBLIC_COMPANY_NAME`: Nombre de la empresa (ej. "Dos Robles").
    *   `NEXT_PUBLIC_COMPANY_LOGO_URL`: URL o ruta local a la imagen del logo (ej. `/logo.png` si está en la carpeta `public`).
    *   `APP_CURRENCY` y `APP_LOCALE`: Formato de moneda e idioma de la UI (ej. `NIO` y `es-NI`).
        *   **Variables de Base de Datos**:
            *   `DB_TYPE`: Tipo de base de datos (ej. "SQLServer").
            *   `DB_HOST`: Host de tu servidor de base de datos (ej. "localhost").
            *   `DB_PORT`: Puerto de tu servidor de base de datos (ej. "1433" para SQL Server).
            *   `DB_USER`: Usuario para la conexión a la base de datos.
            *   `DB_PASSWORD`: Contraseña para el usuario de la base de datos.
            *   `DB_NAME`: Nombre de la base de datos.
            *   `DB_ENCRYPT` (Opcional para SQL Server): 'true' o 'false'.
            *   `DB_TRUST_SERVER_CERTIFICATE` (Opcional para SQL Server): 'true' o 'false'.

2.  **Primer Usuario Administrador**:
    *   Una vez que la tabla `users` esté creada y la aplicación pueda conectarse a la base de datos:
        *   Implementa la lógica para crear usuarios (ej. a través de un formulario de registro o una función de seed).
        *   Después de crear el primer usuario, actualiza manualmente su columna `role` a "Admin" directamente en la base de datos SQL Server. Alternativamente, si estás creando un script de "seed" para poblar datos iniciales, puedes asignar el rol de administrador allí.

## Implementación de la Lógica de Base de Datos

1.  **Conexión a la Base de Datos**:
    *   Revisa y descomenta el código relevante en `src/lib/db.ts` para establecer la conexión real a tu instancia de SQL Server utilizando el paquete `mssql`. Asegúrate de que la lógica para crear y gestionar el `ConnectionPool` sea adecuada y utilice las variables de entorno.

2.  **Acciones del Servidor**:
    *   Para cada archivo en `src/lib/actions/` (ej. `vehicle-actions.ts`, `maintenance-actions.ts`, etc.):
        *   Revisa los ejemplos de SQL Server comentados.
        *   Descomenta los bloques de código correspondientes a SQL Server.
        *   Adapta las consultas SQL (nombres de tabla, columnas) si tu esquema de BD difiere de los ejemplos.
        *   Asegúrate de que la interacción con el pool de `mssql` (ej. `pool.request()`, `request.input()`, `request.query()`) sea correcta.
        *   Implementa un manejo de errores robusto para las operaciones de base de datos.

Nota: La conexión a SQL Server está implementada en `src/lib/db.ts` con un pool global y manejo de errores. Ajusta `DB_ENCRYPT`/`DB_TRUST_SERVER_CERTIFICATE` para tu entorno.

## Ejecutar la Aplicación Localmente (Desarrollo)

```powershell
npm run dev
```
Esto iniciará la aplicación en modo de desarrollo en `http://localhost:9002`.

## Construir para Producción

```powershell
npm run build
```
Esto creará una compilación optimizada de la aplicación en la carpeta `.next`.

## Checklist rápido para DEV (Windows) 🧭

1) Preparar variables de entorno
- Copia `.env.example` a `.env` y completa:
    - `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_COMPANY_LOGO_URL`
    - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_TYPE`
    - `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE`
    - `SESSION_TTL_DAYS` (días de vigencia de sesión, ej. `7`)
- Opcional en DEV: crea `src/db.config.json` desde `src/db.config.example.json` si prefieres no usar `.env`.

2) Instalar dependencias
```powershell
npm install
```

3) Verificación rápida
```powershell
npm run typecheck
```

4) Build y arranque
```powershell
npm run build
npm run start
```

Si PowerShell bloquea scripts, usa cmd para ejecutar los scripts de npm:
```powershell
cmd /c "npm run build"
cmd /c "npm run start"
```

5) Smoke tests sugeridos
- Acceso: ir a `/` debe redirigir a login si no hay sesión; con sesión válida, al dashboard.
- Login/Logout: iniciar sesión con un usuario válido; cerrar sesión desde el header.
- Rutas protegidas: no autenticado no debe acceder a `/vehicles`, `/maintenance`, `/fueling`, `/reports`, `/settings`.
- Accesos rápidos del dashboard deben respetar permisos: probar que usuarios sin permiso no puedan entrar a `/vehicles/new`, `/maintenance/new`, `/fueling/new` (debe ir a `/forbidden`).
- Vehículos: crear/editar; activar/inactivar; exportar listado a XLSX.
- Combustible: crear y listar con filtros; exportar a XLSX.
- Mantenimiento: crear/editar; adjuntar/eliminar archivos; exportar a XLSX con columnas de auditoría.
- Usuarios (admin): activar/desactivar; eliminar con confirmación; exportar a XLSX.
- Settings: guardar umbrales; verificar auditoría (creado/actualizado por) y que afecte generación de alertas.
- Alertas: generar/actualizar estado; ver “Creado por” en UI.

## Despliegue recomendado

## Crear el primer usuario administrador 👤

La aplicación no viene con un usuario por defecto. Crea el primer admin en tu SQL Server con una contraseña hasheada en bcrypt.

1) Generar hash bcrypt de tu contraseña (Windows PowerShell)
```powershell
node -e "const b=require('bcryptjs');(async()=>{const h=await b.hash(process.argv[1],10);console.log(h)})()" "TuPasswordFuerte!"
```
Guarda el hash impreso (empieza con $2a$/$2b$).

2) Insertar el usuario Admin en SQL Server
Ejecuta este T-SQL (ajusta email/username/nombre y pega tu hash):

```sql
-- Si la columna 'active' no existe aún, créala (el código la usa)
IF COL_LENGTH('dbo.users', 'active') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD active BIT NOT NULL CONSTRAINT DF_users_active DEFAULT (1);
END
GO

INSERT INTO dbo.users (
    email, username, fullName, passwordHash, role, permissions, active, createdAt, updatedAt
)
VALUES (
    'admin@tu-dominio.com',    -- email
    'admin',                   -- username
    N'Administrador',          -- nombre para mostrar
    '<PEGA_AQUI_TU_BCRYPT_HASH>', -- hash bcrypt generado arriba
    'Admin',                   -- rol
    '[]',                      -- permisos (JSON)
    1,                         -- activo
    SYSUTCDATETIME(),
    SYSUTCDATETIME()
);
```

3) Iniciar sesión
- Email: el que insertaste (p.ej. admin@tu-dominio.com)
- Contraseña: la que usaste para generar el hash
- Nota: el login requiere que el usuario esté activo (active = 1) y busca por email en minúsculas.

Para producción, la opción más estable y simple es ejecutar la app Node.js con PM2 detrás de un reverse proxy (Nginx) en Linux. Funciona también en Windows, pero Linux suele ser más predecible para Next.js y `mssql`.

1) Entorno recomendado
- SO: Ubuntu 22.04 LTS (o similar)
- Node: 18.x o 20.x LTS
- Proxy: Nginx
- Proceso: PM2
- BD: SQL Server (Azure SQL, SQL Server en VM/host on-prem)

2) Pasos (resumen)
- Instalar Node y PM2 global: `npm i -g pm2`
- Instalar dependencias: `npm ci`
- Build: `npm run build`
- Arranque: `pm2 start "next start -p 3000" --name fleetfox`
- Nginx: proxy_pass a `http://localhost:3000`, TLS con Let’s Encrypt
- Variables de entorno: configurar en el servicio/PM2 (DB_HOST, DB_USER, etc.)

3) Windows (si se requiere)
- Puedes usar PM2 en Windows del mismo modo y front con IIS ARR como reverse proxy. Sin embargo, prioriza Linux si buscas menor fricción operativa.

## Ejecutar con Docker (Windows, LAN y acceso externo)

Este repositorio incluye un `Dockerfile` multi-stage y un `docker-compose.yml` para levantar la app de forma reproducible.

### 1) Preparar `.env`
- Copia `.env.example` a `.env` y completa las variables (DB_HOST, DB_USER, etc.). Si tu SQL Server está en tu red, usa su IP LAN (por ejemplo `192.168.1.50`).

### 2) Construir la imagen y levantar el servicio
```powershell
docker compose build
docker compose up -d
```
La app quedará expuesta en `http://<IP_DE_TU_PC>:9002`. En la misma máquina también responde en `http://localhost:9002`.

Notas
- `docker-compose.yml` mapea el puerto contenedor 3000 al host 9002.
- El contenedor corre como usuario no root y usa la build `standalone` de Next.js.
- Si el SQL Server está fuera de Docker, asegúrate de que el host del contenedor pueda alcanzarlo (firewall y reglas de red). Configura `DB_HOST` con la IP/hostname alcanzable desde el contenedor.

### 3) Firewall en Windows
Permite el puerto 9002 en el firewall de Windows para conexiones entrantes desde tu LAN:
```powershell
New-NetFirewallRule -DisplayName "FleetFox 9002" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 9002
```

### 4) Hacerlo público para la empresa (LAN)
- Entrega a tus usuarios la URL `http://<IP_DE_TU_PC>:9002` o configura un DNS interno (ej. `fleetfox.tuempresa.local`) apuntando a la IP de esa máquina.
- Opcional: instala un reverse proxy (Nginx/Traefik) delante del contenedor para TLS interno y rutas amigables.

### 5) Acceso desde fuera (NAT / Kiosk)
Si quieres que usuarios externos accedan, tienes dos opciones:
- NAT/Port Forward en tu router/firewall
    - Reenvía el puerto 80/443 (o 9002) desde tu IP pública hacia el `9002` del host Windows.
    - Recomendado: usa un proxy con TLS en el perímetro y reenvía al 9002 interno, así los kioskos usan HTTPS.
    - Asegúrate de endurecer cookies y CORS si expones público: `SESSION_COOKIE_SECURE=true`, usar HTTPS y dominio.
- VPN
    - Alternativa más segura: que los kioskos se conecten a tu red por VPN y usen la URL interna.

### 6) Salud, reinicio y logs
- `docker-compose.yml` define un `healthcheck`. Ver estado: `docker ps`.
- Reinicio automático ante fallos con `restart: unless-stopped`.
- Logs: `docker compose logs -f web`.

### 7) SQL Server en contenedor (opcional solo DEV)
Si prefieres un SQL Server en Docker para pruebas, descomenta el servicio `mssql` en `docker-compose.yml`. Para producción, usa tu instancia administrada.

### 8) Actualizar versión de la app
```powershell
git pull
docker compose build --no-cache
docker compose up -d
```

### 9) Variables sensibles
- No subas `.env` al repositorio. Controla secretos con un cofre (Azure Key Vault, HashiCorp Vault) o configura variables directamente al servicio en tu orquestador.

### 10) Endurecimiento recomendado cuando es público
- Coloca un reverse proxy con TLS (Let's Encrypt o tu CA corporativa).
- Fuerza HTTPS y `SESSION_COOKIE_SECURE=true` en `.env`.
- Revisa cabeceras de seguridad en el proxy: HSTS, X-Frame-Options, CSP según necesidades.
- Limita orígenes de imágenes si hospedas contenido externo.

## Notas de arquitectura y seguridad

- Autenticación: Implementada con `bcryptjs`, sesiones en BD (tabla `sessions`) y cookie HttpOnly `session_token`. Middleware protege rutas y el layout valida sesión en la BD.
- Autorización: Guard SSR `requirePermission` aplicado a rutas clave. Página `/forbidden` para accesos no permitidos.
- Auditoría: Registro centralizado de eventos en `audit_logs` y página de administración en Settings.
- Alertas: Motor de alertas con reglas para mantenimiento preventivo, baja eficiencia, alto costo de mantenimiento y vencimiento de documentos. Umbrales configurables en Settings.
- Exportaciones: Utilidad centralizada con ExcelJS para XLSX (estilos y formatos incluidos). Listas con exportación: Combustible, Vehículos, Mantenimiento y Usuarios; además de los reportes. En Mantenimiento se incluyen columnas de auditoría (Creado/Actualizado por) cuando están disponibles.
- Revalidación: Acciones del servidor usan `revalidatePath` tras escrituras para refrescar UI.
- Validación: Formularios validados con Zod y `react-hook-form`.
- Imágenes remotas: Permitidas desde `placehold.co` en `next.config.ts`.

## Roadmap (estado actual)

Hecho
- SQL Server integrado (pool `mssql` en `src/lib/db.ts`).
- CRUD completo: usuarios, vehículos, combustible, mantenimiento, adjuntos.
    - Usuarios: listar, crear, editar, activar/desactivar, eliminar (con confirmación).
    - Vehículos: listar, crear, ver detalle, editar, activar/inactivar (soft-delete con confirmación en detalle y lista).
    - Combustible: listar (con filtros), crear, ver detalle, editar, eliminar (con confirmación), exportar a XLSX.
    - Vehículos: exportar listado a XLSX.
    - Mantenimiento: exportar listado a XLSX.
    - Usuarios: exportar listado a XLSX.
    - Mantenimiento: listar, crear, ver detalle, editar, adjuntar/eliminar archivos.
- Autenticación/sesiones: cookie HttpOnly + validación en BD + middleware de acceso.
- Reportes con agregaciones en servidor y filtros consistentes (vehículo + rango de fechas):
    - Costos de mantenimiento
    - Costos generales por vehículo
    - Consumo de combustible
    - Análisis de eficiencia
    - Mantenimiento próximo (umbrales configurables)
    - Informe comparativo (consolidado)
- Exportar a Excel (XLSX) y CSV cuando aplique
- UI en español y menú por roles (admin restringe configuración sensible)

Pendiente
- Gráficas avanzadas adicionales (series por tiempo, comparativos históricos)
- Caching/optimización para reportes con grandes rangos
- Tests (unitarios e integración) para acciones críticas

Fuente única de tablas/esquema
- `docs/db/fleetfox_schema.sql` (no duplicar en otros documentos)

Recomendaciones
- Añadir presets adicionales de fechas por “trimestre” y “año fiscal” si aplica
- Auditoría aplicada en tablas clave (vehículos, mantenimiento, combustible, alertas y settings) con `createdByUserId`/`updatedByUserId` y joins para mostrar nombres de usuario en UI/exports cuando corresponda.
- Añadir tareas programadas para recalcular métricas de largo plazo
