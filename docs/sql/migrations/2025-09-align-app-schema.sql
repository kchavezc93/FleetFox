-- Migration: Align DB schema with application expectations (safe/idempotent)
-- Date: 2025-09-24

/*
  Summary of expectations:
  - users: active BIT NOT NULL DEFAULT(1), role NVARCHAR(50), permissions NVARCHAR(MAX), createdAt/updatedAt DATETIME2
  - alerts: INT IDENTITY id, vehicleId INT FK -> vehicles(id), alertType NVARCHAR(50), message NVARCHAR(255),
            dueDate DATE NULL, status NVARCHAR(50), severity NVARCHAR(50) NULL,
            createdByUserId INT NULL, updatedByUserId INT NULL, createdAt DATETIME2 DEFAULT SYSUTCDATETIME(),
            resolvedAt DATETIME2 NULL
  - settings: alert_* columns, updatedAt; optionally createdAt, createdByUserId, updatedByUserId
  - vehicle_documents: id UNIQUEIDENTIFIER, vehicleId INT FK -> vehicles(id), expiryDate DATE, status NVARCHAR(20)
*/

-- 1) users.active (required by login & user management)
IF COL_LENGTH('dbo.users', 'active') IS NULL
BEGIN
  ALTER TABLE dbo.users ADD active BIT NOT NULL CONSTRAINT DF_users_active DEFAULT (1);
END
GO

-- 2) alerts optional columns and FKs
IF COL_LENGTH('dbo.alerts', 'createdByUserId') IS NULL
BEGIN
  ALTER TABLE dbo.alerts ADD createdByUserId INT NULL;
END
IF COL_LENGTH('dbo.alerts', 'updatedByUserId') IS NULL
BEGIN
  ALTER TABLE dbo.alerts ADD updatedByUserId INT NULL;
END
IF COL_LENGTH('dbo.alerts', 'resolvedAt') IS NULL
BEGIN
  ALTER TABLE dbo.alerts ADD resolvedAt DATETIME2 NULL;
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

-- 3) settings table (create if missing) + optional audit cols
IF OBJECT_ID('dbo.settings', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.settings (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    alert_daysThreshold INT NULL,
    alert_mileageThreshold INT NULL,
    alert_lowEfficiencyThresholdKmPerGallon DECIMAL(10,2) NULL,
    alert_highMaintenanceCostThreshold DECIMAL(18,2) NULL,
    alert_maintenanceCostWindowDays INT NULL,
    createdAt DATETIME2 NULL,
    updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    createdByUserId INT NULL,
    updatedByUserId INT NULL
  );
END
GO

-- 4) vehicle_documents table (create if missing)
IF OBJECT_ID('dbo.vehicle_documents', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.vehicle_documents (
    id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    vehicleId INT NOT NULL,
    documentType NVARCHAR(100) NOT NULL,
    documentNumber NVARCHAR(100) NULL,
    issueDate DATE NULL,
    expiryDate DATE NULL,
    status NVARCHAR(20) NULL,
    notes NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NULL
  );
  CREATE INDEX IX_vehicle_documents_expiry ON dbo.vehicle_documents(expiryDate);
  ALTER TABLE dbo.vehicle_documents ADD CONSTRAINT FK_vehicle_documents_vehicles FOREIGN KEY (vehicleId) REFERENCES dbo.vehicles(id) ON DELETE CASCADE;
END
ELSE
BEGIN
  -- NOTE: Si 'vehicleId' no es INT en tu implementación, ajusta manualmente el tipo o crea una columna nueva y migra datos.
  -- Este script no intenta convertir tipos automáticamente para evitar pérdida de datos.
END
GO
