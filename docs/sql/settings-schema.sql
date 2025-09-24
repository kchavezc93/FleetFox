-- NOTE: La fuente de verdad es docs/sql/schema.sql. Este archivo muestra un ejemplo simplificado.
-- La aplicación usa columnas alert_* y updatedAt; además detecta opcionales createdAt, createdByUserId, updatedByUserId.

CREATE TABLE settings (
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

INSERT INTO settings (alert_daysThreshold, alert_mileageThreshold, alert_lowEfficiencyThresholdKmPerGallon, alert_highMaintenanceCostThreshold, alert_maintenanceCostWindowDays)
VALUES (30, 2000, 10.00, 20000.00, 30);
