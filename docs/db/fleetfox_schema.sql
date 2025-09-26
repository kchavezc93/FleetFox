/*
FleetFox Unified SQL Server Schema (Idempotent)

Safe to run multiple times. Creates missing tables, columns, indexes, and constraints.
Targets Microsoft SQL Server (including Azure SQL).
*/

SET NOCOUNT ON;
GO

/* 0) Create schema dbo if missing */
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'dbo')
BEGIN
  EXEC('CREATE SCHEMA dbo');
END
GO

/* 1) Users */
IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    email NVARCHAR(255) NOT NULL,
    username NVARCHAR(100) NOT NULL,
    fullName NVARCHAR(255) NULL,
    passwordHash NVARCHAR(255) NOT NULL,
    role NVARCHAR(50) NOT NULL,
    permissions NVARCHAR(MAX) NULL,
    active BIT NOT NULL CONSTRAINT DF_users_active DEFAULT(1),
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_users_createdAt DEFAULT(SYSUTCDATETIME()),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_users_updatedAt DEFAULT(SYSUTCDATETIME())
  );
END
GO

/* Unique indexes for users */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_users_email' AND object_id = OBJECT_ID('dbo.users'))
  CREATE UNIQUE INDEX UX_users_email ON dbo.users(email);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_users_username' AND object_id = OBJECT_ID('dbo.users'))
  CREATE UNIQUE INDEX UX_users_username ON dbo.users(username);
GO

/* 2) Sessions */
IF OBJECT_ID('dbo.sessions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.sessions (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    userId INT NOT NULL,
    token NVARCHAR(128) NOT NULL,
    expiresAt DATETIME2 NOT NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_sessions_createdAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_sessions_users FOREIGN KEY(userId) REFERENCES dbo.users(id) ON DELETE CASCADE
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_sessions_token' AND object_id = OBJECT_ID('dbo.sessions'))
  CREATE UNIQUE INDEX IX_sessions_token ON dbo.sessions(token);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_sessions_userId' AND object_id = OBJECT_ID('dbo.sessions'))
  CREATE INDEX IX_sessions_userId ON dbo.sessions(userId);
GO

/* 3) Vehicles */
IF OBJECT_ID('dbo.vehicles', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.vehicles (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    plateNumber NVARCHAR(50) NOT NULL,
    vin NVARCHAR(50) NOT NULL,
    brand NVARCHAR(100) NOT NULL,
    model NVARCHAR(100) NOT NULL,
    year INT NOT NULL,
    fuelType NVARCHAR(50) NOT NULL,
    currentMileage INT NOT NULL CONSTRAINT DF_vehicles_currentMileage DEFAULT(0),
    nextPreventiveMaintenanceMileage INT NOT NULL CONSTRAINT DF_vehicles_nextPMM DEFAULT(0),
    nextPreventiveMaintenanceDate DATE NULL,
    status NVARCHAR(50) NOT NULL,
    imageUrl NVARCHAR(255) NULL,
    createdByUserId INT NULL,
    updatedByUserId INT NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_vehicles_createdAt DEFAULT(SYSUTCDATETIME()),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_vehicles_updatedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_vehicles_createdBy FOREIGN KEY (createdByUserId) REFERENCES dbo.users(id),
    CONSTRAINT FK_vehicles_updatedBy FOREIGN KEY (updatedByUserId) REFERENCES dbo.users(id)
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_vehicles_plate' AND object_id = OBJECT_ID('dbo.vehicles'))
  CREATE UNIQUE INDEX UX_vehicles_plate ON dbo.vehicles(plateNumber);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_vehicles_vin' AND object_id = OBJECT_ID('dbo.vehicles'))
  CREATE UNIQUE INDEX UX_vehicles_vin ON dbo.vehicles(vin);
GO

/* 4) Fueling logs */
IF OBJECT_ID('dbo.fueling_logs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.fueling_logs (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    vehicleId NVARCHAR(50) NOT NULL,
    vehiclePlateNumber NVARCHAR(50) NULL,
    fuelingDate DATE NOT NULL,
    mileageAtFueling INT NOT NULL,
    quantityLiters DECIMAL(10,2) NOT NULL,
    costPerLiter DECIMAL(10,2) NOT NULL,
    totalCost DECIMAL(10,2) NOT NULL,
    station NVARCHAR(100) NOT NULL,
    responsible NVARCHAR(100) NULL,
    imageUrl NVARCHAR(255) NULL,
    fuelEfficiencyKmPerGallon DECIMAL(10,1) NULL,
    createdByUserId INT NULL,
    updatedByUserId INT NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_fueling_createdAt DEFAULT(SYSUTCDATETIME()),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_fueling_updatedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_fueling_createdBy FOREIGN KEY (createdByUserId) REFERENCES dbo.users(id),
    CONSTRAINT FK_fueling_updatedBy FOREIGN KEY (updatedByUserId) REFERENCES dbo.users(id)
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_fueling_vehicleId' AND object_id = OBJECT_ID('dbo.fueling_logs'))
  CREATE INDEX IX_fueling_vehicleId ON dbo.fueling_logs(vehicleId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_fueling_date' AND object_id = OBJECT_ID('dbo.fueling_logs'))
  CREATE INDEX IX_fueling_date ON dbo.fueling_logs(fuelingDate);
GO

-- Helpful composite index for sequential recalculation scans
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_fueling_vehicle_date_created' AND object_id = OBJECT_ID('dbo.fueling_logs'))
  CREATE INDEX IX_fueling_vehicle_date_created ON dbo.fueling_logs(vehicleId, fuelingDate ASC, createdAt ASC, id ASC);
GO

/* 5) Fueling vouchers */
IF OBJECT_ID('dbo.fueling_vouchers', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.fueling_vouchers (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    fueling_log_id INT NOT NULL,
    file_name NVARCHAR(200) NOT NULL,
    file_type NVARCHAR(100) NOT NULL,
    file_content VARBINARY(MAX) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_fueling_v_created DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_vouchers_fueling FOREIGN KEY (fueling_log_id) REFERENCES dbo.fueling_logs(id) ON DELETE CASCADE
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_fueling_vouchers_log' AND object_id = OBJECT_ID('dbo.fueling_vouchers'))
  CREATE INDEX IX_fueling_vouchers_log ON dbo.fueling_vouchers(fueling_log_id);
GO

/* 6) Maintenance logs */
IF OBJECT_ID('dbo.maintenance_logs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.maintenance_logs (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    vehicleId INT NOT NULL,
    vehiclePlateNumber NVARCHAR(50) NULL,
    maintenanceType NVARCHAR(50) NOT NULL,
    executionDate DATE NOT NULL,
    mileageAtService INT NOT NULL,
    activitiesPerformed NVARCHAR(MAX) NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    provider NVARCHAR(100) NOT NULL,
    nextMaintenanceDateScheduled DATE NULL,
    nextMaintenanceMileageScheduled INT NULL,
    createdByUserId INT NULL,
    updatedByUserId INT NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_maint_createdAt DEFAULT(SYSUTCDATETIME()),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_maint_updatedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_maint_createdBy FOREIGN KEY (createdByUserId) REFERENCES dbo.users(id),
    CONSTRAINT FK_maint_updatedBy FOREIGN KEY (updatedByUserId) REFERENCES dbo.users(id)
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_maint_vehicleId' AND object_id = OBJECT_ID('dbo.maintenance_logs'))
  CREATE INDEX IX_maint_vehicleId ON dbo.maintenance_logs(vehicleId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_maint_executionDate' AND object_id = OBJECT_ID('dbo.maintenance_logs'))
  CREATE INDEX IX_maint_executionDate ON dbo.maintenance_logs(executionDate);
GO

/* 7) Maintenance attachments */
IF OBJECT_ID('dbo.attached_documents', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.attached_documents (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    maintenance_log_id INT NOT NULL,
    file_name NVARCHAR(255) NOT NULL,
    file_type NVARCHAR(100) NOT NULL,
    file_content VARBINARY(MAX) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_attdocs_created DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_attdocs_maint FOREIGN KEY (maintenance_log_id) REFERENCES dbo.maintenance_logs(id) ON DELETE CASCADE
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_attdocs_log' AND object_id = OBJECT_ID('dbo.attached_documents'))
  CREATE INDEX IX_attdocs_log ON dbo.attached_documents(maintenance_log_id);
GO

/* 8) Settings */
IF OBJECT_ID('dbo.settings', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.settings (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    -- Alert thresholds
    alert_daysThreshold INT NULL,
    alert_mileageThreshold INT NULL,
    alert_lowEfficiencyThresholdKmPerGallon DECIMAL(10,2) NULL,
    alert_highMaintenanceCostThreshold DECIMAL(18,2) NULL,
    alert_maintenanceCostWindowDays INT NULL,
    -- Voucher limit (may be added later if missing)
    voucher_max_per_fueling INT NULL,
    createdByUserId INT NULL,
    updatedByUserId INT NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_settings_createdAt DEFAULT(SYSUTCDATETIME()),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_settings_updatedAt DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT FK_settings_createdBy FOREIGN KEY (createdByUserId) REFERENCES dbo.users(id),
    CONSTRAINT FK_settings_updatedBy FOREIGN KEY (updatedByUserId) REFERENCES dbo.users(id)
  );
END
GO
/* If settings table exists but voucher_max_per_fueling is missing, add it */
IF OBJECT_ID('dbo.settings','U') IS NOT NULL AND COL_LENGTH('dbo.settings','voucher_max_per_fueling') IS NULL
BEGIN
  ALTER TABLE dbo.settings ADD voucher_max_per_fueling INT NULL;
END
GO

/* Seed a row in settings if empty */
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.settings') AND type = 'U')
AND NOT EXISTS (SELECT 1 FROM dbo.settings)
BEGIN
  INSERT INTO dbo.settings (
    alert_daysThreshold,
    alert_mileageThreshold,
    alert_lowEfficiencyThresholdKmPerGallon,
    alert_highMaintenanceCostThreshold,
    alert_maintenanceCostWindowDays,
    voucher_max_per_fueling,
    createdAt, updatedAt
  ) VALUES (
    NULL, NULL, NULL, NULL, NULL,
    2,  -- default voucher limit
    SYSUTCDATETIME(), SYSUTCDATETIME()
  );
END
GO

/* 9) Alerts */
IF OBJECT_ID('dbo.alerts', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.alerts (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    vehicleId NVARCHAR(50) NOT NULL,
    alertType NVARCHAR(100) NOT NULL,
    message NVARCHAR(MAX) NOT NULL,
    dueDate DATE NULL,
    status NVARCHAR(20) NOT NULL,
    severity NVARCHAR(20) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_alerts_createdAt DEFAULT(SYSUTCDATETIME()),
    resolvedAt DATETIME2 NULL,
    createdByUserId INT NULL,
    updatedByUserId INT NULL,
    -- Computed date-only column for per-day uniqueness when dueDate is NULL
    createdDate AS CAST(createdAt AS DATE) PERSISTED,
    CONSTRAINT FK_alerts_createdBy FOREIGN KEY (createdByUserId) REFERENCES dbo.users(id),
    CONSTRAINT FK_alerts_updatedBy FOREIGN KEY (updatedByUserId) REFERENCES dbo.users(id)
  );
END
GO

-- Ensure computed column exists if table pre-existed without it
IF OBJECT_ID('dbo.alerts','U') IS NOT NULL AND COL_LENGTH('dbo.alerts','createdDate') IS NULL
BEGIN
  ALTER TABLE dbo.alerts ADD createdDate AS CAST(createdAt AS DATE) PERSISTED;
END
GO

-- Helpful non-unique indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_alerts_status_createdAt' AND object_id = OBJECT_ID('dbo.alerts'))
  CREATE INDEX IX_alerts_status_createdAt ON dbo.alerts(status, createdAt);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_alerts_vehicle' AND object_id = OBJECT_ID('dbo.alerts'))
  CREATE INDEX IX_alerts_vehicle ON dbo.alerts(vehicleId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_alerts_type' AND object_id = OBJECT_ID('dbo.alerts'))
  CREATE INDEX IX_alerts_type ON dbo.alerts(alertType);
GO

-- De-duplication unique indexes
-- 1) Exact key uniqueness when dueDate IS NOT NULL
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_alerts_vehicle_type_dueDate' AND object_id = OBJECT_ID('dbo.alerts'))
  CREATE UNIQUE INDEX UX_alerts_vehicle_type_dueDate ON dbo.alerts(vehicleId, alertType, dueDate) WHERE dueDate IS NOT NULL;
GO
-- 2) One alert per day per vehicle+type when dueDate IS NULL (prevents regenerate duplicates)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_alerts_vehicle_type_createdDate_nullDue' AND object_id = OBJECT_ID('dbo.alerts'))
  CREATE UNIQUE INDEX UX_alerts_vehicle_type_createdDate_nullDue ON dbo.alerts(vehicleId, alertType, createdDate) WHERE dueDate IS NULL;
GO

/* 10) Audit events */
IF OBJECT_ID('dbo.audit_events', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.audit_events (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    eventType NVARCHAR(50) NOT NULL,
    actorUserId NVARCHAR(50) NULL,
    actorUsername NVARCHAR(100) NULL,
    targetUserId NVARCHAR(50) NULL,
    targetUsername NVARCHAR(100) NULL,
    message NVARCHAR(MAX) NULL,
    detailsJson NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_audit_createdAt DEFAULT(SYSUTCDATETIME())
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_eventType_date' AND object_id = OBJECT_ID('dbo.audit_events'))
  CREATE INDEX IX_audit_eventType_date ON dbo.audit_events(eventType, createdAt DESC);
GO

/* 10) Helpful computed/default adjustments (no-op if exist) */
-- In case some columns were created without defaults in older schemas; add if missing
IF COL_LENGTH('dbo.users','active') IS NOT NULL AND NOT EXISTS (
  SELECT 1
  FROM sys.default_constraints dc
  JOIN sys.columns c ON c.default_object_id = dc.object_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.users') AND c.name = 'active'
)
BEGIN
  ALTER TABLE dbo.users ADD CONSTRAINT DF_users_active_fix DEFAULT(1) FOR active;
END
GO

/* End */
PRINT 'FleetFox schema ensured.';
GO

/* 11) Stored procedure: Recalculate fueling efficiencies (km/gal)
   Recomputes fuelEfficiencyKmPerGallon for a given vehicle starting at a date, cascading forward.
   If @vehicleId is NULL or empty, processes ALL vehicles.
   Uses previous mileage and the CURRENT row's liters to compute: (km diff) / (liters / 3.78541)
*/
GO
CREATE OR ALTER PROCEDURE dbo.RecalcFuelEfficiencies
  @vehicleId NVARCHAR(50) = NULL,
  @fromDate DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;

  -- If no vehicle provided, loop through all vehicles present in fueling_logs
  IF @vehicleId IS NULL OR LTRIM(RTRIM(@vehicleId)) = ''
  BEGIN
    DECLARE cur_all CURSOR FAST_FORWARD FOR
      SELECT DISTINCT vehicleId FROM dbo.fueling_logs;
    DECLARE @vId NVARCHAR(50);
    OPEN cur_all;
    FETCH NEXT FROM cur_all INTO @vId;
    WHILE @@FETCH_STATUS = 0
    BEGIN
      EXEC dbo.RecalcFuelEfficiencies @vehicleId = @vId, @fromDate = @fromDate;
      FETCH NEXT FROM cur_all INTO @vId;
    END
    CLOSE cur_all; DEALLOCATE cur_all;
    RETURN;
  END

  -- Determine starting date
  DECLARE @startDate DATE;
  IF @fromDate IS NOT NULL SET @startDate = @fromDate; 
  ELSE SELECT @startDate = MIN(fuelingDate) FROM dbo.fueling_logs WHERE vehicleId = @vehicleId;

  IF @startDate IS NULL RETURN; -- no logs to process

  -- Base mileage: last record BEFORE start date
  DECLARE @prevMileage INT = NULL;
  SELECT TOP 1 @prevMileage = mileageAtFueling
  FROM dbo.fueling_logs
  WHERE vehicleId = @vehicleId AND fuelingDate < @startDate
  ORDER BY fuelingDate DESC, createdAt DESC, id DESC;

  -- Iterate forward in stable order
  DECLARE recalc_cur CURSOR FAST_FORWARD FOR
    SELECT id, mileageAtFueling, quantityLiters
    FROM dbo.fueling_logs
    WHERE vehicleId = @vehicleId AND fuelingDate >= @startDate
    ORDER BY fuelingDate ASC, createdAt ASC, id ASC;

  DECLARE @id INT, @mileage INT, @liters DECIMAL(10,2);
  DECLARE @diff INT, @gallons DECIMAL(18,6), @eff DECIMAL(10,1);

  OPEN recalc_cur;
  FETCH NEXT FROM recalc_cur INTO @id, @mileage, @liters;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    SET @eff = NULL;
    IF @prevMileage IS NOT NULL
    BEGIN
      SET @diff = @mileage - @prevMileage;
      IF @liters IS NOT NULL AND @liters > 0 AND @diff > 0
      BEGIN
        SET @gallons = CAST(@liters / 3.78541 AS DECIMAL(18,6));
        IF @gallons > 0
          SET @eff = CAST(ROUND(@diff / @gallons, 1) AS DECIMAL(10,1));
      END
    END

    UPDATE dbo.fueling_logs SET fuelEfficiencyKmPerGallon = @eff WHERE id = @id;

    -- advance base mileage
    SET @prevMileage = @mileage;

    FETCH NEXT FROM recalc_cur INTO @id, @mileage, @liters;
  END

  CLOSE recalc_cur; DEALLOCATE recalc_cur;
END
GO
