
# Dos Robles - Aplicación de Gestión de Flota

Esta aplicación Next.js está diseñada para ayudar a la empresa "Dos Robles" (configurable mediante `NEXT_PUBLIC_COMPANY_NAME`) a gestionar su flota de vehículos, incluyendo el seguimiento de mantenimientos, consumo de combustible y generación de informes.

## 1. Prerrequisitos

1.  **Node.js**: Asegúrate de tener Node.js instalado (versión 18.x o superior recomendada). Puedes descargarlo desde [nodejs.org](https://nodejs.org/).
2.  **SQL Server**: Necesitarás una instancia de SQL Server (Express, Developer, Standard, etc.) accesible para la aplicación.
3.  **npm o yarn**: Administrador de paquetes de Node.js.
4.  **Herramienta de Gestión de BD SQL Server**: SQL Server Management Studio (SSMS), Azure Data Studio, o similar.

## 2. Configuración Inicial del Proyecto

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

3.  **Configurar Variables de Entorno**:
    *   Crea un archivo `.env` en la raíz del proyecto copiando el contenido de `.env.example`.
    *   Actualiza las variables en `.env`:
        *   `NEXT_PUBLIC_COMPANY_NAME`: Nombre de tu empresa (ej. "Mi Flota").
        *   `NEXT_PUBLIC_COMPANY_LOGO_URL`: URL completa o ruta local (ej. `/mi-logo.png` si está en `public/`) a la imagen del logo.
        *   **Variables de Base de Datos SQL Server**:
            *   `DB_TYPE="SQLServer"` (Mantener como SQLServer para esta implementación)
            *   `DB_HOST`: Host de tu servidor SQL Server (ej. "localhost", "SQLEXPRESS_INSTANCE_NAME", o IP/hostname del servidor).
            *   `DB_PORT`: Puerto de tu servidor SQL Server (usualmente "1433").
            *   `DB_USER`: Usuario SQL Server con permisos para la base de datos.
            *   `DB_PASSWORD`: Contraseña para el usuario SQL Server.
            *   `DB_NAME`: Nombre de la base de datos que crearás (ej. `dos_robles_fleet_db`).
            *   `DB_ENCRYPT`: Opcional, `true` o `false`. Para Azure SQL, generalmente `true`. Para desarrollo local sin SSL, `false`.
            *   `DB_TRUST_SERVER_CERTIFICATE`: Opcional, `true` o `false`. Para desarrollo local, podrías necesitar `true` si usas un certificado auto-firmado. Para producción, generalmente `false`.

## 3. Configuración de la Base de Datos SQL Server

1.  **Crear la Base de Datos**:
    *   Conéctate a tu instancia de SQL Server.
    *   Crea una nueva base de datos con el nombre que especificaste en `DB_NAME` (ej. `dos_robles_fleet_db`).

2.  **Crear las Tablas**:
    *   Revisa `src/types/index.ts` para entender la estructura de datos de cada entidad (`Vehicle`, `MaintenanceLog`, `AttachedDocument`, `FuelingLog`, `UserProfile`).
    *   **Examina los ejemplos de SQL comentados** dentro de los archivos en `src/lib/actions/` (ej. `vehicle-actions.ts`, `maintenance-actions.ts`, etc.). Estos comentarios contienen sugerencias para las columnas, tipos de datos SQL, y constraints (`PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `NOT NULL`).
    *   Usa tu herramienta de gestión de BD para ejecutar los `CREATE TABLE` statements para las siguientes tablas:
        *   `users`
        *   `vehicles`
        *   `maintenance_logs`
        *   `attached_documents` (asegúrate de que `file_content` sea `VARBINARY(MAX)`)
        *   `fueling_logs`
    *   **Importante**:
        *   Define `PRIMARY KEY`s (ej. `id NVARCHAR(50) PRIMARY KEY` si planeas usar UUIDs generados por la app, o `INT IDENTITY(1,1) PRIMARY KEY` para IDs numéricos autoincrementales). Ajusta los ejemplos SQL en las actions según tu elección de tipo de ID.
        *   Define `FOREIGN KEY` constraints (ej. `maintenance_logs.vehicleId` referencia a `vehicles.id`).
        *   Define `UNIQUE` constraints (ej. para `vehicles.plateNumber`, `vehicles.vin`, `users.email`, `users.username`).
        *   Define `NOT NULL` donde sea apropiado.
        *   Los campos `createdAt` y `updatedAt` pueden tener `GETDATE()` como valor por defecto (`DEFAULT GETDATE()`).

## 4. Implementación de la Lógica de Base de Datos (Paso a Paso)

Esta es la fase principal donde conectarás la aplicación a tu base de datos. Procede con calma, implementando y probando funcionalidad por funcionalidad.

### Fase 4.1: Conexión Inicial y Prueba

1.  **Revisar y Descomentar Lógica de Conexión en `src/lib/db.ts`**:
    *   Abre `src/lib/db.ts`.
    *   Busca la sección comentada `// --- EJEMPLO DE IMPLEMENTACIÓN DE CONEXIÓN REAL PARA SQL SERVER ---`.
    *   Descomenta el import de `sql` from `mssql`.
    *   Descomenta la variable `dbPool` y toda la lógica dentro del `if (config.dbType === "SQLServer")` en la función `getDbClient`.
    *   Asegúrate de que la `poolConfig` (user, password, server, etc.) use correctamente las variables de `config` (que vienen de tus `.env`).
    *   **Instala `mssql`**: Si aún no lo has hecho, ejecuta `npm install mssql`.

2.  **Prueba de Conexión Básica**:
    *   Inicia la aplicación en modo desarrollo: `npm run dev`.
    *   Navega a una página simple de la aplicación (ej. el Dashboard).
    *   Revisa la consola del servidor Next.js (donde ejecutaste `npm run dev`).
        *   Si la conexión es exitosa, deberías ver mensajes como `[SQL Server] Creando nuevo pool de conexión...` y `[SQL Server] Nuevo pool de conexión global...`.
        *   Si hay errores (ej. credenciales incorrectas, servidor no accesible, nombre de BD incorrecto), se mostrarán aquí. Soluciónalos antes de continuar.
    *   (Opcional Avanzado) Para una prueba más directa, puedes añadir temporalmente en `src/lib/db.ts` una función simple que use `getDbClient` para hacer un `SELECT 1;` y llamarla desde alguna página para ver si ejecuta sin errores.

### Fase 4.2: Implementación Gradual de Funcionalidades (Acción por Acción)

Descomenta y adapta la lógica SQL dentro de los archivos en `src/lib/actions/`. Prueba cada funcionalidad desde la UI después de implementar su acción correspondiente.

**Orden Sugerido:**

1.  **Vehículos (`src/lib/actions/vehicle-actions.ts`)**
    *   **`createVehicle`**:
        *   Descomenta la lógica SQL Server.
        *   Adapta los nombres de tabla/columna si es necesario.
        *   Asegúrate de que los `request.input()` coincidan con los tipos de datos de tu tabla.
        *   Verifica la lógica de `OUTPUT INSERTED.*` para obtener el ID del nuevo vehículo.
        *   Prueba: Navega a `/vehicles/new`, llena el formulario y envía. Verifica que el vehículo se cree en la BD y que no haya errores en la consola.
    *   **`getVehicles`**:
        *   Descomenta la lógica SQL Server.
        *   Adapta el `SELECT` query.
        *   Prueba: Navega a `/vehicles`. Deberías ver el vehículo que creaste.
    *   **`getVehicleById`**:
        *   Descomenta. Adapta el `SELECT`.
        *   Prueba: Haz clic en "Ver Detalles" de un vehículo en la lista.
    *   **`updateVehicle`**:
        *   Descomenta. Adapta el `UPDATE` y `OUTPUT INSERTED.*`.
        *   Prueba: Edita un vehículo desde su página de detalles.
    *   **`deleteVehicle` (marcar como inactivo) y `activateVehicle`**:
        *   Descomenta. Adapta los `UPDATE` para cambiar el `status`.
        *   Prueba: Usa las opciones del menú desplegable en la lista de vehículos o los botones en la página de detalles.
    *   **`getUpcomingMaintenanceCount`**:
        *   Descomenta. Adapta la consulta SQL para contar vehículos con mantenimiento próximo (usa `DATEDIFF` y compara kilometrajes).
        *   Prueba: Revisa el Dashboard. El contador de "Mantenimiento Próximo" debería actualizarse.

2.  **Usuarios y Autenticación (`src/lib/actions/user-actions.ts`, `src/lib/actions/auth-actions.ts`)**
    *   **`saveUser` (para crear usuarios en `user-actions.ts`)**:
        *   Descomenta la lógica SQL Server.
        *   **Importante**: Instala `bcryptjs`: `npm install bcryptjs @types/bcryptjs`.
        *   Descomenta y adapta la lógica de hashing de contraseñas con `bcryptjs`.
        *   No hay UI para crear usuarios aún. Para probar, puedes:
            *   Crear un usuario directamente en tu tabla `users` SQL Server.
            *   O, temporalmente, llamar a `saveUser` desde alguna parte del código con datos de prueba (luego elimina esta llamada).
    *   **Crear Primer Usuario Administrador**:
        *   Después de crear tu primer usuario (sea por la app o manualmente), conéctate a tu BD SQL Server y actualiza su columna `role` a `"Admin"`.
    *   **`loginUser` (en `auth-actions.ts`)**:
        *   Descomenta la lógica SQL Server.
        *   Descomenta el `import bcrypt from 'bcryptjs';`.
        *   Adapta el `SELECT` para buscar el usuario por email.
        *   Descomenta y adapta la comparación de contraseñas usando `bcrypt.compare`.
        *   Prueba: Navega a `/login` e intenta iniciar sesión con el usuario administrador.
        *   **Nota**: La lógica de creación de sesión real (ej. cookies, tokens JWT) está comentada y es conceptual. Necesitarás implementarla para una autenticación funcional (ej. usando NextAuth.js o una solución personalizada). Sin esto, el login "exitoso" no te mantendrá logueado.

3.  **Mantenimientos (`src/lib/actions/maintenance-actions.ts`)**
    *   **`createMaintenanceLog`**:
        *   Descomenta la lógica SQL Server.
        *   Maneja la obtención del `vehiclePlateNumber` (denormalizado).
        *   Adapta el `INSERT` a `maintenance_logs`.
        *   **Manejo de Adjuntos**: Implementa la inserción en `attached_documents`. El `fileContent` es un Data URI Base64; necesitarás extraer la parte Base64 pura y usar `CONVERT(VARBINARY(MAX), @base64Data, 2)` en SQL.
        *   Actualiza el `currentMileage`, `nextPreventiveMaintenanceMileage`, y `nextPreventiveMaintenanceDate` del vehículo asociado.
        *   Usa **transacciones SQL** (`BEGIN TRANSACTION`, `COMMIT`, `ROLLBACK`) ya que hay múltiples escrituras (log, adjuntos, vehículo).
        *   Prueba: Registra un nuevo mantenimiento desde `/maintenance/new`, adjuntando un archivo de imagen o PDF pequeño.
    *   **`getMaintenanceLogs`**: Descomenta y adapta. Prueba la lista en `/maintenance`.
    *   **`getMaintenanceLogById`**: Descomenta y adapta (incluye la carga de adjuntos como Data URIs). Prueba la página de detalles.
    *   **`updateMaintenanceLog`**: Similar a `create`, pero con `UPDATE`. Maneja la adición de nuevos adjuntos y la eliminación de adjuntos existentes (`attachmentsToRemove`). Usa transacciones. Prueba editando.
    *   **`deleteMaintenanceLog`**: Descomenta. Elimina el log y sus adjuntos (usa transacciones). Prueba eliminando.

4.  **Cargas de Combustible (`src/lib/actions/fueling-actions.ts`)**
    *   **`createFuelingLog`**:
        *   Descomenta la lógica SQL Server.
        *   Obtén `vehiclePlateNumber`.
        *   **Cálculo de Eficiencia**: Implementa la lógica para buscar el registro de combustible anterior del mismo vehículo para calcular `fuelEfficiencyKmPerGallon`.
        *   Actualiza el `currentMileage` del vehículo si el `mileageAtFueling` es mayor.
        *   Usa transacciones.
        *   Prueba: Registra una nueva carga desde `/fueling/new`.
    *   **`getFuelingLogs`**: Descomenta y adapta. Prueba la lista en `/fueling`.

**Para Cada Acción Implementada:**
*   Revisa cuidadosamente los tipos de datos SQL (`sql.NVarChar`, `sql.Int`, `sql.Date`, `sql.Decimal`, `sql.MAX` para `VARBINARY(MAX)`).
*   Maneja `null` vs `undefined` correctamente al pasar parámetros a SQL (ej. `data.imageUrl || null`).
*   Asegúrate de que `revalidatePath` se llame para las rutas correctas para que la UI se actualice sin necesidad de recargar manualmente.
*   Prueba la funcionalidad desde la UI correspondiente.
*   Revisa la consola del servidor Next.js y la consola del navegador para errores.

### Fase 4.3: Informes y Dashboard

Una vez que las acciones para vehículos, mantenimientos y combustible estén implementadas y devuelvan datos reales:

1.  **Dashboard (`src/app/(app)/dashboard/page.tsx`)**:
    *   Verifica que los contadores y costos se muestren correctamente.
    *   Si planeas implementar alertas, necesitarás crear la tabla `alerts` y las `alert-actions.ts`.
2.  **Informes (`src/app/(app)/reports/*`)**:
    *   Navega a cada página de informe. La mayoría ya están configurados para usar las funciones `get*` de las acciones.
    *   Para el `comparative-expense-analysis/page.tsx`: Una vez que todo funcione, considera si quieres mover la lógica de agregación pesada al backend (creando una nueva server action que haga las consultas SQL optimizadas directamente), usando los ejemplos SQL comentados como guía para el rendimiento.

## 5. Primer Usuario Administrador (Recordatorio)

*   Como se mencionó, después de crear tu primer usuario (ya sea mediante una futura UI de registro o insertándolo directamente en la base de datos para pruebas), necesitarás conectarte a tu SQL Server y actualizar manualmente la columna `role` de ese usuario a `"Admin"` en la tabla `users`. Alternativamente, puedes crear un script de "seed" para tu base de datos que inserte este usuario administrador.

## 6. Ejecutar la Aplicación en Desarrollo

```bash
npm run dev
```
Esto iniciará la aplicación, generalmente en `http://localhost:9002`.

## 7. Construir para Producción

```bash
npm run build
```
Esto creará una compilación optimizada en la carpeta `.next`.

## 8. Despliegue en un Servidor Windows (Consideraciones)

Desplegar una aplicación Next.js en un servidor Windows con IIS como servidor web es posible, pero requiere configuración. Una alternativa más común para aplicaciones Node.js es usar un gestor de procesos como PM2.

**Opción 1: Usando IIS como Reverse Proxy (con `iisnode` o `ARR`)**

1.  **Instalar IIS**: Asegúrate de que IIS esté instalado con los módulos necesarios (URL Rewrite, Application Request Routing - ARR).
2.  **Instalar `iisnode`**: Permite a IIS hospedar aplicaciones Node.js.
3.  **Configurar `web.config`**: Necesitarás un `web.config` en la raíz de tu proyecto para indicarle a IIS cómo manejar tu aplicación Next.js.
4.  **Iniciar la Aplicación**: Después de `npm run build`, la aplicación se inicia con `npm start`. IIS (vía `iisnode`) gestionaría esto.
5.  **Variables de Entorno en IIS**: Configura las variables de entorno (credenciales de BD, `NODE_ENV=production`, `NEXT_PUBLIC_COMPANY_NAME`, etc.) a nivel del Application Pool o del sitio en IIS.

**Opción 2: Usando PM2 (Recomendado para aplicaciones Node.js)**

1.  **Instalar PM2 Globalmente en el servidor**: `npm install pm2 -g`.
2.  **Construir la Aplicación**: `npm run build`.
3.  **Iniciar con PM2**:
    ```bash
    # Desde la raíz de tu proyecto en el servidor
    pm2 start npm --name "dos-robles-app" -- run start -- --port 3000 
    # (o el puerto que desees)
    ```
    Asegúrate de que las variables de entorno estén disponibles para el proceso PM2 (puedes usar un archivo de ecosistema `ecosystem.config.js` de PM2).
4.  **Configurar IIS como Reverse Proxy a PM2 (Opcional)**: Si quieres usar IIS como frontend (ej. para el puerto 80/443), configura un sitio en IIS para que actúe como reverse proxy, redirigiendo las solicitudes a la instancia de Node.js gestionada por PM2 (ej. `http://localhost:3000`). Usa ARR para esto.

**Consideraciones Adicionales para Producción**:

*   **Seguridad**: Protege tu SQL Server y el servidor de la aplicación (firewalls, contraseñas seguras, actualizaciones).
*   **HTTPS**: Configura HTTPS.
*   **Logging**: Implementa un sistema de logging robusto para el backend.
*   **Backups**: Realiza backups regulares de tu base de datos.

---

Este `README.md` ahora proporciona una guía mucho más estructurada para la implementación.
¡Espero que este paso a paso detallado te sea de gran ayuda! Procede con cada fase cuidadosamente, probando a medida que avanzas.
