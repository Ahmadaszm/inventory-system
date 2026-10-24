-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "role" TEXT NOT NULL DEFAULT 'STOCK_COUNTER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "zone" TEXT,
    "aisle" TEXT,
    "shelf" TEXT,
    "bin" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "internalId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,
    "descriptionAr" TEXT,
    "categoryId" TEXT,
    "brandId" TEXT,
    "model" TEXT,
    "size" TEXT,
    "color" TEXT,
    "attributes" TEXT,
    "sourceType" TEXT NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'PCS',
    "unitsPerCarton" INTEGER NOT NULL DEFAULT 1,
    "costPerUnit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "imageUrl" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "supplierRef" TEXT,
    "productionRef" TEXT,
    "productionDate" TIMESTAMP(3),
    "importDate" TIMESTAMP(3),
    "receivingDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carton" (
    "id" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "cartonNumber" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "locationId" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "originalQty" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "serialNumbers" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Carton_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBalance" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "locationId" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reservedQty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "damagedQty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "quarantinedQty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lastMovementAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "movementNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "fromWarehouseId" TEXT,
    "toWarehouseId" TEXT,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovementItem" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "cartonId" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitCost" DECIMAL(65,30),
    "notes" TEXT,

    CONSTRAINT "StockMovementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StocktakeSession" (
    "id" TEXT NOT NULL,
    "sessionNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "scopeType" TEXT NOT NULL,
    "scopeJson" TEXT,
    "countDate" TIMESTAMP(3) NOT NULL,
    "freezeCutoffAt" TIMESTAMP(3),
    "isBlind" BOOLEAN NOT NULL DEFAULT true,
    "isSurprise" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "warehouseId" TEXT,

    CONSTRAINT "StocktakeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionProgress" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "totalTasks" INTEGER NOT NULL DEFAULT 0,
    "assignedTasks" INTEGER NOT NULL DEFAULT 0,
    "startedTasks" INTEGER NOT NULL DEFAULT 0,
    "countedTasks" INTEGER NOT NULL DEFAULT 0,
    "verifiedTasks" INTEGER NOT NULL DEFAULT 0,
    "pendingTasks" INTEGER NOT NULL DEFAULT 0,
    "completedTasks" INTEGER NOT NULL DEFAULT 0,
    "totalExpected" INTEGER NOT NULL DEFAULT 0,
    "totalCounted" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "shortageCount" INTEGER NOT NULL DEFAULT 0,
    "surplusCount" INTEGER NOT NULL DEFAULT 0,
    "unknownCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountTask" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "locationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CountTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookSnapshot" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "locationId" TEXT,
    "bookQuantity" DECIMAL(65,30) NOT NULL,
    "unitCost" DECIMAL(65,30),
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "taskId" TEXT,
    "cartonId" TEXT,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "locationId" TEXT,
    "qrCodeScanned" TEXT,
    "countedQty" DECIMAL(65,30) NOT NULL,
    "bookQty" DECIMAL(65,30),
    "varianceQty" DECIMAL(65,30),
    "status" TEXT NOT NULL DEFAULT 'COUNTED',
    "isUnexpected" BOOLEAN NOT NULL DEFAULT false,
    "isUnknownQr" BOOLEAN NOT NULL DEFAULT false,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "isWrongLocation" BOOLEAN NOT NULL DEFAULT false,
    "isDamaged" BOOLEAN NOT NULL DEFAULT false,
    "isPartial" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "clientEventId" TEXT,
    "countedById" TEXT NOT NULL,
    "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "adjustmentNumber" TEXT NOT NULL,
    "sessionId" TEXT,
    "movementId" TEXT,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "locationId" TEXT,
    "bookQty" DECIMAL(65,30) NOT NULL,
    "physicalQty" DECIMAL(65,30) NOT NULL,
    "varianceQty" DECIMAL(65,30) NOT NULL,
    "unitCost" DECIMAL(65,30),
    "financialVariance" DECIMAL(65,30),
    "reason" TEXT NOT NULL,
    "reasonCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValues" TEXT,
    "newValues" TEXT,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanEvent" (
    "id" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "cartonId" TEXT,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "clientEventId" TEXT,
    "result" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "ScanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_code_key" ON "Brand"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "Location_warehouseId_idx" ON "Location"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_warehouseId_code_key" ON "Location"("warehouseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Item_sku_key" ON "Item"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Item_internalId_key" ON "Item"("internalId");

-- CreateIndex
CREATE INDEX "Item_sku_idx" ON "Item"("sku");

-- CreateIndex
CREATE INDEX "Item_sourceType_idx" ON "Item"("sourceType");

-- CreateIndex
CREATE INDEX "Item_isActive_idx" ON "Item"("isActive");

-- CreateIndex
CREATE INDEX "Item_categoryId_idx" ON "Item"("categoryId");

-- CreateIndex
CREATE INDEX "Batch_itemId_idx" ON "Batch"("itemId");

-- CreateIndex
CREATE INDEX "Batch_sourceType_idx" ON "Batch"("sourceType");

-- CreateIndex
CREATE INDEX "Batch_batchNumber_idx" ON "Batch"("batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_itemId_batchNumber_key" ON "Batch"("itemId", "batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Carton_qrCode_key" ON "Carton"("qrCode");

-- CreateIndex
CREATE INDEX "Carton_qrCode_idx" ON "Carton"("qrCode");

-- CreateIndex
CREATE INDEX "Carton_itemId_idx" ON "Carton"("itemId");

-- CreateIndex
CREATE INDEX "Carton_batchId_idx" ON "Carton"("batchId");

-- CreateIndex
CREATE INDEX "Carton_locationId_idx" ON "Carton"("locationId");

-- CreateIndex
CREATE INDEX "Carton_status_idx" ON "Carton"("status");

-- CreateIndex
CREATE INDEX "Carton_cartonNumber_idx" ON "Carton"("cartonNumber");

-- CreateIndex
CREATE INDEX "InventoryBalance_itemId_idx" ON "InventoryBalance"("itemId");

-- CreateIndex
CREATE INDEX "InventoryBalance_locationId_idx" ON "InventoryBalance"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBalance_itemId_batchId_locationId_key" ON "InventoryBalance"("itemId", "batchId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_movementNumber_key" ON "StockMovement"("movementNumber");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX "StockMovement_status_idx" ON "StockMovement"("status");

-- CreateIndex
CREATE INDEX "StockMovement_effectiveDate_idx" ON "StockMovement"("effectiveDate");

-- CreateIndex
CREATE INDEX "StockMovement_movementNumber_idx" ON "StockMovement"("movementNumber");

-- CreateIndex
CREATE INDEX "StockMovementItem_movementId_idx" ON "StockMovementItem"("movementId");

-- CreateIndex
CREATE INDEX "StockMovementItem_itemId_idx" ON "StockMovementItem"("itemId");

-- CreateIndex
CREATE INDEX "StockMovementItem_cartonId_idx" ON "StockMovementItem"("cartonId");

-- CreateIndex
CREATE UNIQUE INDEX "StocktakeSession_sessionNumber_key" ON "StocktakeSession"("sessionNumber");

-- CreateIndex
CREATE INDEX "StocktakeSession_type_idx" ON "StocktakeSession"("type");

-- CreateIndex
CREATE INDEX "StocktakeSession_status_idx" ON "StocktakeSession"("status");

-- CreateIndex
CREATE INDEX "StocktakeSession_isSurprise_isHidden_idx" ON "StocktakeSession"("isSurprise", "isHidden");

-- CreateIndex
CREATE INDEX "StocktakeSession_sessionNumber_idx" ON "StocktakeSession"("sessionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SessionProgress_sessionId_key" ON "SessionProgress"("sessionId");

-- CreateIndex
CREATE INDEX "CountTask_sessionId_idx" ON "CountTask"("sessionId");

-- CreateIndex
CREATE INDEX "CountTask_assignedToId_idx" ON "CountTask"("assignedToId");

-- CreateIndex
CREATE INDEX "CountTask_status_idx" ON "CountTask"("status");

-- CreateIndex
CREATE INDEX "BookSnapshot_sessionId_idx" ON "BookSnapshot"("sessionId");

-- CreateIndex
CREATE INDEX "BookSnapshot_itemId_idx" ON "BookSnapshot"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "BookSnapshot_sessionId_itemId_batchId_locationId_key" ON "BookSnapshot"("sessionId", "itemId", "batchId", "locationId");

-- CreateIndex
CREATE INDEX "CountRecord_sessionId_idx" ON "CountRecord"("sessionId");

-- CreateIndex
CREATE INDEX "CountRecord_itemId_idx" ON "CountRecord"("itemId");

-- CreateIndex
CREATE INDEX "CountRecord_qrCodeScanned_idx" ON "CountRecord"("qrCodeScanned");

-- CreateIndex
CREATE INDEX "CountRecord_clientEventId_idx" ON "CountRecord"("clientEventId");

-- CreateIndex
CREATE INDEX "CountRecord_status_idx" ON "CountRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CountRecord_sessionId_cartonId_key" ON "CountRecord"("sessionId", "cartonId");

-- CreateIndex
CREATE UNIQUE INDEX "StockAdjustment_adjustmentNumber_key" ON "StockAdjustment"("adjustmentNumber");

-- CreateIndex
CREATE INDEX "StockAdjustment_sessionId_idx" ON "StockAdjustment"("sessionId");

-- CreateIndex
CREATE INDEX "StockAdjustment_status_idx" ON "StockAdjustment"("status");

-- CreateIndex
CREATE INDEX "StockAdjustment_itemId_idx" ON "StockAdjustment"("itemId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "ScanEvent_qrCode_idx" ON "ScanEvent"("qrCode");

-- CreateIndex
CREATE INDEX "ScanEvent_clientEventId_idx" ON "ScanEvent"("clientEventId");

-- CreateIndex
CREATE INDEX "ScanEvent_sessionId_idx" ON "ScanEvent"("sessionId");

-- CreateIndex
CREATE INDEX "ScanEvent_scannedAt_idx" ON "ScanEvent"("scannedAt");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carton" ADD CONSTRAINT "Carton_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carton" ADD CONSTRAINT "Carton_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carton" ADD CONSTRAINT "Carton_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovementItem" ADD CONSTRAINT "StockMovementItem_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "StockMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovementItem" ADD CONSTRAINT "StockMovementItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovementItem" ADD CONSTRAINT "StockMovementItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovementItem" ADD CONSTRAINT "StockMovementItem_cartonId_fkey" FOREIGN KEY ("cartonId") REFERENCES "Carton"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StocktakeSession" ADD CONSTRAINT "StocktakeSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StocktakeSession" ADD CONSTRAINT "StocktakeSession_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProgress" ADD CONSTRAINT "SessionProgress_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StocktakeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountTask" ADD CONSTRAINT "CountTask_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StocktakeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountTask" ADD CONSTRAINT "CountTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookSnapshot" ADD CONSTRAINT "BookSnapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StocktakeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookSnapshot" ADD CONSTRAINT "BookSnapshot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountRecord" ADD CONSTRAINT "CountRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StocktakeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountRecord" ADD CONSTRAINT "CountRecord_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CountTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountRecord" ADD CONSTRAINT "CountRecord_cartonId_fkey" FOREIGN KEY ("cartonId") REFERENCES "Carton"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountRecord" ADD CONSTRAINT "CountRecord_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountRecord" ADD CONSTRAINT "CountRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountRecord" ADD CONSTRAINT "CountRecord_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountRecord" ADD CONSTRAINT "CountRecord_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountRecord" ADD CONSTRAINT "CountRecord_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StocktakeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "StockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanEvent" ADD CONSTRAINT "ScanEvent_cartonId_fkey" FOREIGN KEY ("cartonId") REFERENCES "Carton"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanEvent" ADD CONSTRAINT "ScanEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Inventory is accessed through server-side Prisma/NextAuth.
-- No anonymous or authenticated Data API policies are granted.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Brand" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Warehouse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Location" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Batch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Carton" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMovementItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StocktakeSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CountTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BookSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CountRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockAdjustment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScanEvent" ENABLE ROW LEVEL SECURITY;
