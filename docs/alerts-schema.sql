-- SQL Server schema for alerts table

CREATE TABLE alerts (
  id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
  vehicleId NVARCHAR(50) NOT NULL,
  alertType NVARCHAR(100) NOT NULL, -- 'PreventiveMaintenanceDue' | 'DocumentExpiry' | 'LowMileageEfficiency' | 'HighMaintenanceCost'
  message NVARCHAR(MAX) NOT NULL,
  dueDate DATE NULL,
  status NVARCHAR(20) NOT NULL DEFAULT N'Nueva', -- 'Nueva' | 'Vista' | 'Resuelta'
  severity NVARCHAR(20) NULL, -- 'Low' | 'Medium' | 'High'
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  resolvedAt DATETIME2 NULL
);

-- Optional index to quickly fetch open/recent alerts
CREATE INDEX IX_alerts_status_createdAt ON alerts(status, createdAt DESC);

-- Foreign key if vehicles.id is NVARCHAR(50) or UNIQUEIDENTIFIER
-- ALTER TABLE alerts ADD CONSTRAINT FK_alerts_vehicles FOREIGN KEY (vehicleId) REFERENCES vehicles(id);
