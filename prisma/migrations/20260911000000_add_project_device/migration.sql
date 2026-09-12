IF OBJECT_ID(N'[dbo].[SPX_Project]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[SPX_Project] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(255) NOT NULL,
    [name] NVARCHAR(255) NOT NULL,
    [description] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SPX_Project_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SPX_Project_pkey] PRIMARY KEY CLUSTERED ([id])
  );
  CREATE UNIQUE INDEX [SPX_Project_code_key] ON [dbo].[SPX_Project]([code]);
END;

IF OBJECT_ID(N'[dbo].[SPX_Device]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[SPX_Device] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(255) NOT NULL,
    [name] NVARCHAR(255) NOT NULL,
    [assetType] NVARCHAR(50) NOT NULL CONSTRAINT [SPX_Device_assetType_df] DEFAULT 'DEVICE',
    [category] NVARCHAR(255) NOT NULL,
    [fgCode] NVARCHAR(255) NULL,
    [quantity] INT NOT NULL CONSTRAINT [SPX_Device_quantity_df] DEFAULT 1,
    [availableQuantity] INT NOT NULL CONSTRAINT [SPX_Device_availableQuantity_df] DEFAULT 1,
    [status] NVARCHAR(50) NOT NULL CONSTRAINT [SPX_Device_status_df] DEFAULT 'ACTIVE',
    [location] NVARCHAR(255) NULL,
    [notes] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SPX_Device_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SPX_Device_pkey] PRIMARY KEY CLUSTERED ([id])
  );
  CREATE UNIQUE INDEX [SPX_Device_code_key] ON [dbo].[SPX_Device]([code]);
END;

IF OBJECT_ID(N'[dbo].[SPX_ProjectDevice]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[SPX_ProjectDevice] (
    [projectId] NVARCHAR(1000) NOT NULL,
    [deviceId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SPX_ProjectDevice_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SPX_ProjectDevice_pkey] PRIMARY KEY CLUSTERED ([projectId], [deviceId]),
    CONSTRAINT [SPX_ProjectDevice_projectId_fkey] FOREIGN KEY ([projectId]) REFERENCES [dbo].[SPX_Project]([id]) ON DELETE CASCADE,
    CONSTRAINT [SPX_ProjectDevice_deviceId_fkey] FOREIGN KEY ([deviceId]) REFERENCES [dbo].[SPX_Device]([id]) ON DELETE CASCADE
  );
END;

IF OBJECT_ID(N'[dbo].[SPX_Device]', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.SPX_Device', N'assetType') IS NULL
    ALTER TABLE [dbo].[SPX_Device] ADD [assetType] NVARCHAR(50) NOT NULL CONSTRAINT [SPX_Device_assetType_df] DEFAULT 'DEVICE';
  IF COL_LENGTH(N'dbo.SPX_Device', N'location') IS NULL
    ALTER TABLE [dbo].[SPX_Device] ADD [location] NVARCHAR(255) NULL;
END;
