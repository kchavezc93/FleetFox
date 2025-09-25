-- Migration: Add responsible to fueling_logs and create fueling_vouchers table

BEGIN TRY
    BEGIN TRANSACTION;

    -- Add responsible column if it does not exist
    IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE Name = N'responsible' 
          AND Object_ID = Object_ID(N'dbo.fueling_logs')
    )
    BEGIN
        ALTER TABLE dbo.fueling_logs
        ADD responsible NVARCHAR(100) NULL; -- Set NULL first; after backfilling, change to NOT NULL if desired
    END

    -- Create fueling_vouchers table if it does not exist
    IF NOT EXISTS (
        SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fueling_vouchers]') AND type in (N'U')
    )
    BEGIN
        CREATE TABLE dbo.fueling_vouchers (
            id INT IDENTITY(1,1) PRIMARY KEY,
            fueling_log_id INT NOT NULL,
            file_name NVARCHAR(200) NOT NULL,
            file_type NVARCHAR(100) NOT NULL,
            file_content VARBINARY(MAX) NOT NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_fueling_vouchers_created_at DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT FK_fueling_vouchers_fueling_logs FOREIGN KEY (fueling_log_id) REFERENCES dbo.fueling_logs(id) ON DELETE CASCADE
        );
        CREATE INDEX IX_fueling_vouchers_log_id ON dbo.fueling_vouchers (fueling_log_id);
    END

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR('Migration failed: %s', 16, 1, @ErrMsg);
END CATCH;
