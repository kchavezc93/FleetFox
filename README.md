
# Dos Robles - Aplicación de Gestión de Flota

Esta aplicación Next.js está diseñada para ayudar a la empresa "Dos Robles" a gestionar su flota de vehículos, incluyendo el seguimiento de mantenimientos, consumo de combustible y generación de informes.

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

2.  **Instalar Dependencias**:
    ```bash
    npm install
    # o
    yarn install
    ```
    Esto instalará Next.js, React, TailwindCSS, ShadCN UI, y otras dependencias como `mssql` (para SQL Server) y `bcryptjs` (para contraseñas).

## Configuración de la Base de Datos SQL Server

1.  **Crear la Base de Datos**:
    *   Conéctate a tu instancia de SQL Server usando SQL Server Management Studio (SSMS) o tu herramienta de administración preferida.
    *   Crea una nueva base de datos (ej. `dos_robles_fleet_db`).

2.  **Crear las Tablas**:
    *   Basándote en la estructura de datos definida en `src/types/index.ts` y los ejemplos de consultas SQL comentados en los archivos dentro de `src/lib/actions/`, crea las siguientes tablas en tu base de datos:
        *   `vehicles`: Para almacenar información de los vehículos.
            *   Columnas sugeridas: `id` (PK, ej. `INT IDENTITY(1,1)` o `NVARCHAR(50)` si usas UUIDs generados por la app), `plateNumber` (NVARCHAR, UNIQUE), `vin` (NVARCHAR, UNIQUE), `brand`, `model`, `year` (INT), `fuelType`, `currentMileage` (INT), `nextPreventiveMaintenanceMileage` (INT), `nextPreventiveMaintenanceDate` (DATE), `status`, `imageUrl` (NVARCHAR), `createdAt` (DATETIME2), `updatedAt` (DATETIME2).
        *   `maintenance_logs`: Para registros de mantenimiento.
            *   Columnas sugeridas: `id` (PK), `vehicleId` (FK a `vehicles.id`), `vehiclePlateNumber` (NVARCHAR, denormalizado), `maintenanceType`, `executionDate` (DATE), `mileageAtService` (INT), `activitiesPerformed` (NVARCHAR(MAX)), `cost` (DECIMAL(10,2)), `provider`, `nextMaintenanceDateScheduled` (DATE), `nextMaintenanceMileageScheduled` (INT), `createdAt`, `updatedAt`.
        *   `attached_documents`: Para los archivos adjuntos a los mantenimientos.
            *   Columnas sugeridas: `id` (PK), `maintenance_log_id` (FK a `maintenance_logs.id`), `file_name` (NVARCHAR(255)), `file_type` (NVARCHAR(100)), `file_content` (VARBINARY(MAX)), `created_at` (DATETIME2).
        *   `fueling_logs`: Para registros de combustible.
            *   Columnas sugeridas: `id` (PK), `vehicleId` (FK a `vehicles.id`), `vehiclePlateNumber` (NVARCHAR, denormalizado), `fuelingDate` (DATE), `mileageAtFueling` (INT), `quantityLiters` (DECIMAL(10,2)), `costPerLiter` (DECIMAL(10,2)), `totalCost` (DECIMAL(10,2)), `fuelEfficiencyKmPerGallon` (DECIMAL(10,1), NULLABLE), `station`, `imageUrl` (NVARCHAR, NULLABLE), `createdAt`, `updatedAt`.
        *   `users`: Para usuarios de la aplicación (requiere implementación de autenticación).
            *   Columnas sugeridas: `id` (PK), `email` (NVARCHAR, UNIQUE), `username` (NVARCHAR, UNIQUE), `fullName` (NVARCHAR, NULLABLE), `passwordHash` (NVARCHAR - longitud adecuada para el hash bcrypt), `role` (NVARCHAR), `permissions` (NVARCHAR(MAX) para almacenar un JSON array de strings), `createdAt`, `updatedAt`.
    *   **Importante**: Define `PRIMARY KEY`, `FOREIGN KEY` constraints, `UNIQUE` constraints (para `plateNumber`, `vin`, `email` de usuario), y `NOT NULL` según corresponda. Los campos `createdAt` y `updatedAt` pueden tener `GETDATE()` como valor por defecto.

## Configuración de la Aplicación

1.  **Variables de Entorno**:
    *   Crea un archivo `.env` en la raíz del proyecto copiando `.env.example`.
    *   Actualiza las variables en `.env`:
        *   `NEXT_PUBLIC_COMPANY_NAME`: Nombre de la empresa (ej. "Dos Robles").
        *   `NEXT_PUBLIC_COMPANY_LOGO_URL`: URL o ruta local a la imagen del logo (ej. `/logo.png` si está en la carpeta `public`).
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

## Ejecutar la Aplicación Localmente (Desarrollo)

```bash
npm run dev
# o
yarn dev
```
Esto iniciará la aplicación en modo de desarrollo, generalmente en `http://localhost:9002` (según `package.json`).

## Construir para Producción

```bash
npm run build
# o
yarn build
```
Esto creará una compilación optimizada de la aplicación en la carpeta `.next`.

## Despliegue en un Servidor Windows (Consideraciones)

Desplegar una aplicación Next.js en un servidor Windows con IIS como servidor web es posible, pero requiere configuración. Una alternativa más común para aplicaciones Node.js es usar un gestor de procesos como PM2.

**Opción 1: Usando IIS como Reverse Proxy (con `iisnode` o `ARR`)**

1.  **Instalar IIS**: Asegúrate de que IIS esté instalado en tu servidor Windows con los módulos necesarios (como URL Rewrite, Application Request Routing - ARR).
2.  **Instalar `iisnode`**: Este módulo permite a IIS hospedar aplicaciones Node.js.
3.  **Configurar `web.config`**: Necesitarás un archivo `web.config` en la raíz de tu proyecto para indicarle a IIS cómo manejar tu aplicación Next.js. Este archivo definirá reescrituras de URL y cómo `iisnode` debe ejecutar tu aplicación (generalmente `node server.js` si usas un servidor Next.js personalizado, o el comando de inicio de Next.js).
    *   Ejemplo básico (puede necesitar ajustes):
        ```xml
        <configuration>
          <system.webServer>
            <handlers>
              <add name="iisnode" path="server.js" verb="*" modules="iisnode" />
            </handlers>
            <rewrite>
              <rules>
                <rule name="DynamicContent">
                  <conditions>
                    <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True"/>
                  </conditions>
                  <action type="Rewrite" url="server.js"/>
                </rule>
              </rules>
            </rewrite>
            <!-- Asegúrate de que las variables de entorno para la BD sean accesibles por el proceso de Node.js -->
            <!-- <iisnode node_env="production" /> -->
          </system.webServer>
        </configuration>
        ```
4.  **Iniciar la Aplicación en el Servidor**: Después de construir (`npm run build`), la aplicación se inicia con `npm run start`. IIS (a través de `iisnode`) gestionaría este proceso.
5.  **Variables de Entorno en IIS**: Configura las variables de entorno (como las credenciales de la BD, `NODE_ENV=production`) a nivel del Application Pool o del sitio en IIS.

**Opción 2: Usando PM2 (Recomendado para aplicaciones Node.js)**

1.  **Instalar PM2 Globalmente**:
    ```bash
    npm install pm2 -g
    ```
2.  **Construir la Aplicación**:
    ```bash
    npm run build
    ```
3.  **Iniciar la Aplicación con PM2**:
    ```bash
    # Desde la raíz de tu proyecto
    pm2 start npm --name "dos-robles-app" -- run start -- --port 3000 
    # (o el puerto que desees, si `npm start` lo soporta)
    ```
    O, si `npm start` directamente ejecuta `next start`:
    ```bash
    pm2 start "next start -p 3000" --name "dos-robles-app"
    ```
4.  **Configurar IIS como Reverse Proxy a PM2 (Opcional, si quieres usar IIS como frontend)**:
    *   Puedes configurar un sitio en IIS para que actúe como un reverse proxy, redirigiendo las solicitudes a la instancia de Node.js que PM2 está gestionando (ej. `http://localhost:3000`). Esto se hace con el módulo Application Request Routing (ARR) de IIS.
5.  **Variables de Entorno con PM2**: Puedes gestionar variables de entorno a través de un archivo de ecosistema de PM2 (`ecosystem.config.js`) o directamente al iniciar.

**Consideraciones Adicionales para Producción**:

*   **Seguridad**: Asegúrate de que tu servidor SQL Server y el servidor de la aplicación estén debidamente protegidos (firewalls, contraseñas seguras, actualizaciones regulares).
*   **Variables de Entorno**: Utiliza variables de entorno en tu servidor para las configuraciones sensibles (como credenciales de BD). La lógica en `src/lib/db.ts` está preparada para priorizar estas.
*   **HTTPS**: Configura HTTPS para tu aplicación en producción.
*   **Logging**: Implementa un sistema de logging robusto para el backend y la aplicación.
*   **Backups**: Realiza backups regulares de tu base de datos.

Este `README.md` debería darte una buena hoja de ruta para poner en marcha la aplicación y conectarla a tu base de datos SQL Server.
