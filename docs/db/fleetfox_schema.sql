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

/* 9) Audit events */
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
