-- SQL Server schema for audit events

CREATE TABLE audit_events (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  eventType NVARCHAR(50) NOT NULL,
  actorUserId NVARCHAR(50) NULL,
  actorUsername NVARCHAR(100) NULL,
  targetUserId NVARCHAR(50) NULL,
  targetUsername NVARCHAR(100) NULL,
  message NVARCHAR(MAX) NULL,
  detailsJson NVARCHAR(MAX) NULL,
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_audit_events_createdAt ON audit_events(createdAt DESC);
