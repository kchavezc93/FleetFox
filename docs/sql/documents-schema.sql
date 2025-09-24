-- SQL Server schema for vehicle documents with expiry dates

CREATE TABLE vehicle_documents (
  id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
  vehicleId INT NOT NULL,
  documentType NVARCHAR(100) NOT NULL, -- e.g., 'SOAT', 'Inspección', 'Circulación', 'Seguro'
  documentNumber NVARCHAR(100) NULL,
  issueDate DATE NULL,
  expiryDate DATE NULL,
  status NVARCHAR(20) NULL, -- 'Activo' | 'Inactivo'
  notes NVARCHAR(MAX) NULL,
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updatedAt DATETIME2 NULL
);

-- Optional index to speed up queries by expiry date
CREATE INDEX IX_vehicle_documents_expiry ON vehicle_documents(expiryDate);

-- Foreign key to vehicles table
ALTER TABLE vehicle_documents ADD CONSTRAINT FK_vehicle_documents_vehicles FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE;
