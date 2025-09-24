-- NOTE: La fuente de verdad es docs/sql/schema.sql. Este archivo muestra un ejemplo alternativo.
-- La aplicación espera:
-- - alerts.id INT IDENTITY
-- - alerts.vehicleId INT (FK a vehicles.id INT)
-- - columnas: alertType NVARCHAR(50), message NVARCHAR(255), dueDate DATE NULL, status NVARCHAR(50), severity NVARCHAR(50) NULL,
--             createdByUserId INT NULL, updatedByUserId INT NULL, createdAt DATETIME2 DEFAULT SYSUTCDATETIME(), resolvedAt DATETIME2 NULL
-- Para mantener consistencia, usa schema.sql. Si ya tienes una tabla distinta, migra a la estructura indicada.

-- Índice recomendado (opcional)
-- CREATE INDEX IX_alerts_status_createdAt ON alerts(status, createdAt DESC);
