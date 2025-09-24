-- SQL Server schema for users and sessions

-- Users table (adjust types if using UNIQUEIDENTIFIER)
IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    email NVARCHAR(255) NOT NULL UNIQUE,
    username NVARCHAR(100) NOT NULL UNIQUE,
    fullName NVARCHAR(255) NULL,
    passwordHash NVARCHAR(255) NOT NULL,
    role NVARCHAR(50) NOT NULL DEFAULT 'Standard',
    permissions NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

-- Sessions table
IF OBJECT_ID('dbo.sessions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.sessions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    userId INT NOT NULL,
    token NVARCHAR(128) NOT NULL UNIQUE,
    expiresAt DATETIME2 NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_sessions_users FOREIGN KEY (userId) REFERENCES dbo.users(id) ON DELETE CASCADE
  );
END
GO

-- Trigger to update updatedAt on users
IF OBJECT_ID('dbo.trg_users_updatedAt', 'TR') IS NULL
BEGIN
  EXEC('CREATE TRIGGER dbo.trg_users_updatedAt ON dbo.users AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE u SET updatedAt = SYSUTCDATETIME() FROM dbo.users u JOIN inserted i ON u.id = i.id; END');
END
GO

-- Vehicles table
IF OBJECT_ID('dbo.vehicles', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.vehicles (
    id INT IDENTITY(1,1) PRIMARY KEY,
    plateNumber NVARCHAR(50) NOT NULL UNIQUE,
    vin NVARCHAR(50) NOT NULL UNIQUE,
    brand NVARCHAR(50) NOT NULL,
    model NVARCHAR(50) NOT NULL,
    year INT NOT NULL,
    fuelType NVARCHAR(50) NOT NULL,
    currentMileage INT NOT NULL DEFAULT 0,
    nextPreventiveMaintenanceMileage INT NOT NULL DEFAULT 0,
    nextPreventiveMaintenanceDate DATE NULL,
    status NVARCHAR(50) NOT NULL DEFAULT 'Activo',
    imageUrl NVARCHAR(255) NULL,
    createdByUserId INT NULL,
    updatedByUserId INT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  ALTER TABLE dbo.vehicles WITH CHECK ADD CONSTRAINT FK_vehicles_createdBy_users FOREIGN KEY (createdByUserId) REFERENCES dbo.users(id);
  ALTER TABLE dbo.vehicles WITH CHECK ADD CONSTRAINT FK_vehicles_updatedBy_users FOREIGN KEY (updatedByUserId) REFERENCES dbo.users(id);
END
GO

-- Fueling logs table
IF OBJECT_ID('dbo.fueling_logs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.fueling_logs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    vehicleId INT NOT NULL,
    vehiclePlateNumber NVARCHAR(50) NOT NULL,
    fuelingDate DATE NOT NULL,
    mileageAtFueling INT NOT NULL,
    quantityLiters DECIMAL(10,2) NOT NULL,
    costPerLiter DECIMAL(10,2) NOT NULL,
    totalCost DECIMAL(10,2) NOT NULL,
    station NVARCHAR(100) NOT NULL,
    imageUrl NVARCHAR(255) NULL,
    fuelEfficiencyKmPerGallon DECIMAL(10,1) NULL,
    createdByUserId INT NULL,
    updatedByUserId INT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_fueling_logs_vehicles FOREIGN KEY (vehicleId) REFERENCES dbo.vehicles(id) ON DELETE CASCADE
  );
  CREATE INDEX IX_fueling_logs_vehicleId ON dbo.fueling_logs(vehicleId);
  CREATE INDEX IX_fueling_logs_fuelingDate ON dbo.fueling_logs(fuelingDate);
  ALTER TABLE dbo.fueling_logs WITH CHECK ADD CONSTRAINT FK_fueling_logs_createdBy_users FOREIGN KEY (createdByUserId) REFERENCES dbo.users(id);
  ALTER TABLE dbo.fueling_logs WITH CHECK ADD CONSTRAINT FK_fueling_logs_updatedBy_users FOREIGN KEY (updatedByUserId) REFERENCES dbo.users(id);
END
GO

-- Maintenance logs table
IF OBJECT_ID('dbo.maintenance_logs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.maintenance_logs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    vehicleId INT NOT NULL,
    vehiclePlateNumber NVARCHAR(50) NOT NULL,
    maintenanceType NVARCHAR(50) NOT NULL,
    executionDate DATE NOT NULL,
    mileageAtService INT NOT NULL,
    activitiesPerformed NVARCHAR(MAX) NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    provider NVARCHAR(100) NOT NULL,
    nextMaintenanceDateScheduled DATE NOT NULL,
    nextMaintenanceMileageScheduled INT NOT NULL,
    createdByUserId INT NULL,
    updatedByUserId INT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_maintenance_logs_vehicles FOREIGN KEY (vehicleId) REFERENCES dbo.vehicles(id) ON DELETE CASCADE
  );
  CREATE INDEX IX_maintenance_logs_vehicleId ON dbo.maintenance_logs(vehicleId);
  CREATE INDEX IX_maintenance_logs_executionDate ON dbo.maintenance_logs(executionDate);
  ALTER TABLE dbo.maintenance_logs WITH CHECK ADD CONSTRAINT FK_maintenance_logs_createdBy_users FOREIGN KEY (createdByUserId) REFERENCES dbo.users(id);
  ALTER TABLE dbo.maintenance_logs WITH CHECK ADD CONSTRAINT FK_maintenance_logs_updatedBy_users FOREIGN KEY (updatedByUserId) REFERENCES dbo.users(id);
END
GO

-- Attached documents for maintenance logs (store file content as VARBINARY)
IF OBJECT_ID('dbo.attached_documents', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.attached_documents (
    id INT IDENTITY(1,1) PRIMARY KEY,
    maintenance_log_id INT NOT NULL,
    file_name NVARCHAR(255) NOT NULL,
    file_type NVARCHAR(100) NOT NULL,
    file_content VARBINARY(MAX) NOT NULL,
    created_by_user_id INT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_attached_documents_maintenance_logs FOREIGN KEY (maintenance_log_id) REFERENCES dbo.maintenance_logs(id) ON DELETE CASCADE
  );
  CREATE INDEX IX_attached_documents_log_id ON dbo.attached_documents(maintenance_log_id);
  ALTER TABLE dbo.attached_documents WITH CHECK ADD CONSTRAINT FK_attached_documents_created_by_users FOREIGN KEY (created_by_user_id) REFERENCES dbo.users(id);
END
GO

-- Alerts table (optional, for dashboard)
IF OBJECT_ID('dbo.alerts', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.alerts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    vehicleId INT NOT NULL,
    alertType NVARCHAR(50) NOT NULL,
    message NVARCHAR(255) NOT NULL,
    dueDate DATE NULL,
    status NVARCHAR(50) NOT NULL DEFAULT 'Nueva',
    severity NVARCHAR(50) NULL,
    createdByUserId INT NULL,
    updatedByUserId INT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_alerts_vehicles FOREIGN KEY (vehicleId) REFERENCES dbo.vehicles(id) ON DELETE CASCADE
  );
  CREATE INDEX IX_alerts_vehicleId ON dbo.alerts(vehicleId);
  ALTER TABLE dbo.alerts WITH CHECK ADD CONSTRAINT FK_alerts_createdBy_users FOREIGN KEY (createdByUserId) REFERENCES dbo.users(id);
  ALTER TABLE dbo.alerts WITH CHECK ADD CONSTRAINT FK_alerts_updatedBy_users FOREIGN KEY (updatedByUserId) REFERENCES dbo.users(id);
END
GO

-- Helpers: updatedAt triggers
IF OBJECT_ID('dbo.trg_vehicles_updatedAt', 'TR') IS NULL
BEGIN
  EXEC('CREATE TRIGGER dbo.trg_vehicles_updatedAt ON dbo.vehicles AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE v SET updatedAt = SYSUTCDATETIME() FROM dbo.vehicles v JOIN inserted i ON v.id = i.id; END');
END
GO

IF OBJECT_ID('dbo.trg_fueling_logs_updatedAt', 'TR') IS NULL
BEGIN
  EXEC('CREATE TRIGGER dbo.trg_fueling_logs_updatedAt ON dbo.fueling_logs AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE f SET updatedAt = SYSUTCDATETIME() FROM dbo.fueling_logs f JOIN inserted i ON f.id = i.id; END');
END
GO

IF OBJECT_ID('dbo.trg_maintenance_logs_updatedAt', 'TR') IS NULL
BEGIN
  EXEC('CREATE TRIGGER dbo.trg_maintenance_logs_updatedAt ON dbo.maintenance_logs AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE m SET updatedAt = SYSUTCDATETIME() FROM dbo.maintenance_logs m JOIN inserted i ON m.id = i.id; END');
END
GO

-- Backfill for existing deployments: add auditing columns if missing and FKs
-- Vehicles auditing columns
IF COL_LENGTH('dbo.vehicles', 'createdByUserId') IS NULL
BEGIN
  ALTER TABLE dbo.vehicles ADD createdByUserId INT NULL;
END
IF COL_LENGTH('dbo.vehicles', 'updatedByUserId') IS NULL
BEGIN
  ALTER TABLE dbo.vehicles ADD updatedByUserId INT NULL;
END
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_vehicles_createdBy_users')
BEGIN
  ALTER TABLE dbo.vehicles WITH CHECK ADD CONSTRAINT FK_vehicles_createdBy_users FOREIGN KEY (createdByUserId) REFERENCES dbo.users(id);
END
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_vehicles_updatedBy_users')
BEGIN
  ALTER TABLE dbo.vehicles WITH CHECK ADD CONSTRAINT FK_vehicles_updatedBy_users FOREIGN KEY (updatedByUserId) REFERENCES dbo.users(id);
END
GO

-- Fueling logs auditing columns
IF COL_LENGTH('dbo.fueling_logs', 'createdByUserId') IS NULL
BEGIN
  ALTER TABLE dbo.fueling_logs ADD createdByUserId INT NULL;
END
IF COL_LENGTH('dbo.fueling_logs', 'updatedByUserId') IS NULL
BEGIN
  ALTER TABLE dbo.fueling_logs ADD updatedByUserId INT NULL;
END
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_fueling_logs_createdBy_users')
BEGIN
  ALTER TABLE dbo.fueling_logs WITH CHECK ADD CONSTRAINT FK_fueling_logs_createdBy_users FOREIGN KEY (createdByUserId) REFERENCES dbo.users(id);
END
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_fueling_logs_updatedBy_users')
BEGIN
  ALTER TABLE dbo.fueling_logs WITH CHECK ADD CONSTRAINT FK_fueling_logs_updatedBy_users FOREIGN KEY (updatedByUserId) REFERENCES dbo.users(id);
END
GO

-- Maintenance logs auditing columns
IF COL_LENGTH('dbo.maintenance_logs', 'createdByUserId') IS NULL
BEGIN
  ALTER TABLE dbo.maintenance_logs ADD createdByUserId INT NULL;
END
IF COL_LENGTH('dbo.maintenance_logs', 'updatedByUserId') IS NULL
BEGIN
  ALTER TABLE dbo.maintenance_logs ADD updatedByUserId INT NULL;
END
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_maintenance_logs_createdBy_users')
BEGIN
  ALTER TABLE dbo.maintenance_logs WITH CHECK ADD CONSTRAINT FK_maintenance_logs_createdBy_users FOREIGN KEY (createdByUserId) REFERENCES dbo.users(id);
END
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_maintenance_logs_updatedBy_users')
BEGIN
  ALTER TABLE dbo.maintenance_logs WITH CHECK ADD CONSTRAINT FK_maintenance_logs_updatedBy_users FOREIGN KEY (updatedByUserId) REFERENCES dbo.users(id);
END
GO

-- Attached documents auditing column
IF COL_LENGTH('dbo.attached_documents', 'created_by_user_id') IS NULL
BEGIN
  ALTER TABLE dbo.attached_documents ADD created_by_user_id INT NULL;
END
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_attached_documents_created_by_users')
BEGIN
  ALTER TABLE dbo.attached_documents WITH CHECK ADD CONSTRAINT FK_attached_documents_created_by_users FOREIGN KEY (created_by_user_id) REFERENCES dbo.users(id);
END
GO

-- Alerts auditing columns
IF COL_LENGTH('dbo.alerts', 'createdByUserId') IS NULL
BEGIN
  ALTER TABLE dbo.alerts ADD createdByUserId INT NULL;
END
IF COL_LENGTH('dbo.alerts', 'updatedByUserId') IS NULL
BEGIN
  ALTER TABLE dbo.alerts ADD updatedByUserId INT NULL;
END
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_alerts_createdBy_users')
BEGIN
  ALTER TABLE dbo.alerts WITH CHECK ADD CONSTRAINT FK_alerts_createdBy_users FOREIGN KEY (createdByUserId) REFERENCES dbo.users(id);
END
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_alerts_updatedBy_users')
BEGIN
  ALTER TABLE dbo.alerts WITH CHECK ADD CONSTRAINT FK_alerts_updatedBy_users FOREIGN KEY (updatedByUserId) REFERENCES dbo.users(id);
END
GO
