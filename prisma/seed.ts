import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Inventory & Stocktaking System...')

  // Clean existing (for re-seed)
  await prisma.scanEvent.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.stockAdjustment.deleteMany()
  await prisma.countRecord.deleteMany()
  await prisma.bookSnapshot.deleteMany()
  await prisma.countTask.deleteMany()
  await prisma.sessionProgress.deleteMany()
  await prisma.stocktakeSession.deleteMany()
  await prisma.stockMovementItem.deleteMany()
  await prisma.stockMovement.deleteMany()
  await prisma.inventoryBalance.deleteMany()
  await prisma.carton.deleteMany()
  await prisma.batch.deleteMany()
  await prisma.item.deleteMany()
  await prisma.location.deleteMany()
  await prisma.warehouse.deleteMany()
  await prisma.brand.deleteMany()
  await prisma.category.deleteMany()
  await prisma.user.deleteMany()

  // ========== USERS ==========
  const passwordHash = await bcrypt.hash('Admin@123', 12)

  const admin = await prisma.user.create({
    data: {
      email: 'admin@inventory.local',
      passwordHash,
      name: 'System Administrator',
      nameAr: 'مسؤول النظام',
      role: "SYSTEM_ADMIN",
      locale: 'ar',
    },
  })

  const manager = await prisma.user.create({
    data: {
      email: 'manager@inventory.local',
      passwordHash: await bcrypt.hash('Manager@123', 12),
      name: 'Inventory Manager',
      nameAr: 'مدير المخزون',
      role: "INVENTORY_MANAGER",
      locale: 'ar',
    },
  })

  const supervisor = await prisma.user.create({
    data: {
      email: 'supervisor@inventory.local',
      passwordHash: await bcrypt.hash('Super@123', 12),
      name: 'Warehouse Supervisor',
      nameAr: 'مشرف المستودع',
      role: "WAREHOUSE_SUPERVISOR",
      locale: 'ar',
    },
  })

  const counter1 = await prisma.user.create({
    data: {
      email: 'counter1@inventory.local',
      passwordHash: await bcrypt.hash('Counter@123', 12),
      name: 'Stock Counter 1',
      nameAr: 'عداد المخزون 1',
      role: "STOCK_COUNTER",
      locale: 'ar',
    },
  })

  const verifier = await prisma.user.create({
    data: {
      email: 'verifier@inventory.local',
      passwordHash: await bcrypt.hash('Verify@123', 12),
      name: 'Independent Verifier',
      nameAr: 'المدقق المستقل',
      role: "INDEPENDENT_VERIFIER",
      locale: 'en',
    },
  })

  const approver = await prisma.user.create({
    data: {
      email: 'approver@inventory.local',
      passwordHash: await bcrypt.hash('Approve@123', 12),
      name: 'Approver & Auditor',
      nameAr: 'المعتمد والمدقق',
      role: "APPROVER_AUDITOR",
      locale: 'ar',
    },
  })

  console.log('✅ Users created')

  // ========== CATEGORIES & BRANDS ==========
  const catElectronics = await prisma.category.create({
    data: { code: 'ELEC', name: 'Electronics', nameAr: 'إلكترونيات' },
  })
  const catMechanical = await prisma.category.create({
    data: { code: 'MECH', name: 'Mechanical Parts', nameAr: 'قطع ميكانيكية' },
  })
  const catConsumable = await prisma.category.create({
    data: { code: 'CONS', name: 'Consumables', nameAr: 'مواد استهلاكية' },
  })

  const brandA = await prisma.brand.create({
    data: { code: 'BR-A', name: 'TechPro', nameAr: 'تيك برو' },
  })
  const brandB = await prisma.brand.create({
    data: { code: 'BR-B', name: 'FactoryLine', nameAr: 'فاكتوري لاين' },
  })

  // ========== WAREHOUSES & LOCATIONS ==========
  const whMain = await prisma.warehouse.create({
    data: {
      code: 'WH-MAIN',
      name: 'Main Warehouse',
      nameAr: 'المستودع الرئيسي',
      address: 'Industrial Zone A',
    },
  })
  const whFactory = await prisma.warehouse.create({
    data: {
      code: 'WH-FACT',
      name: 'Factory Store',
      nameAr: 'مخزن المصنع',
      address: 'Production Site',
    },
  })

  const locations = []
  for (const wh of [whMain, whFactory]) {
    for (const zone of ['A', 'B']) {
      for (let aisle = 1; aisle <= 2; aisle++) {
        for (let shelf = 1; shelf <= 3; shelf++) {
          const code = `${wh.code}-${zone}-${String(aisle).padStart(2, '0')}-${String(shelf).padStart(2, '0')}`
          const loc = await prisma.location.create({
            data: {
              warehouseId: wh.id,
              zone,
              aisle: String(aisle),
              shelf: String(shelf),
              bin: '01',
              code,
              name: `Zone ${zone} Aisle ${aisle} Shelf ${shelf}`,
            },
          })
          locations.push(loc)
        }
      }
    }
  }
  console.log(`✅ ${locations.length} locations created`)

  // ========== ITEMS ==========
  const itemsData = [
    {
      sku: 'SKU-ELEC-001',
      internalId: 'INT-10001',
      nameEn: 'Industrial Sensor Module',
      nameAr: 'وحدة استشعار صناعية',
      categoryId: catElectronics.id,
      brandId: brandA.id,
      model: 'SM-200',
      size: 'Standard',
      color: 'Black',
      sourceType: "IMPORT",
      uom: 'PCS',
      unitsPerCarton: 20,
      costPerUnit: 45.5,
    },
    {
      sku: 'SKU-MECH-002',
      internalId: 'INT-10002',
      nameEn: 'Precision Gear Assembly',
      nameAr: 'تجميعة ترس دقيقة',
      categoryId: catMechanical.id,
      brandId: brandB.id,
      model: 'GA-50',
      size: 'M50',
      color: 'Steel',
      sourceType: "FACTORY",
      uom: 'PCS',
      unitsPerCarton: 10,
      costPerUnit: 128.0,
    },
    {
      sku: 'SKU-CONS-003',
      internalId: 'INT-10003',
      nameEn: 'Lubricant Cartridge',
      nameAr: 'خرطوشة زيت تشحيم',
      categoryId: catConsumable.id,
      brandId: brandA.id,
      model: 'LC-1L',
      size: '1L',
      color: 'Amber',
      sourceType: "IMPORT",
      uom: 'PCS',
      unitsPerCarton: 12,
      costPerUnit: 18.75,
    },
    {
      sku: 'SKU-ELEC-004',
      internalId: 'INT-10004',
      nameEn: 'Control Board PCB',
      nameAr: 'لوحة تحكم إلكترونية',
      categoryId: catElectronics.id,
      brandId: brandB.id,
      model: 'CB-V3',
      size: '120x80mm',
      color: 'Green',
      sourceType: "FACTORY",
      uom: 'PCS',
      unitsPerCarton: 50,
      costPerUnit: 32.0,
    },
    {
      sku: 'SKU-MECH-005',
      internalId: 'INT-10005',
      nameEn: 'Hydraulic Seal Kit',
      nameAr: 'طقم أختام هيدروليكية',
      categoryId: catMechanical.id,
      brandId: brandA.id,
      model: 'HSK-20',
      size: 'Kit',
      color: 'Multi',
      sourceType: "IMPORT",
      uom: 'KIT',
      unitsPerCarton: 5,
      costPerUnit: 67.25,
    },
  ]

  const items = []
  for (const data of itemsData) {
    const item = await prisma.item.create({
      data: {
        ...data,
        createdById: admin.id,
      },
    })
    items.push(item)
  }
  console.log(`✅ ${items.length} items created`)

  // ========== BATCHES & CARTONS ==========
  let cartonSeq = 1000
  const allCartons = []

  for (const item of items) {
    // Factory batch
    const factoryBatch = await prisma.batch.create({
      data: {
        itemId: item.id,
        batchNumber: `FB-${item.sku}-2026-01`,
        sourceType: "FACTORY",
        productionRef: `PO-${Math.floor(Math.random() * 9000) + 1000}`,
        productionDate: new Date('2026-01-15'),
        receivingDate: new Date('2026-01-16'),
      },
    })

    // Import batch
    const importBatch = await prisma.batch.create({
      data: {
        itemId: item.id,
        batchNumber: `IB-${item.sku}-2026-02`,
        sourceType: "IMPORT",
        supplierRef: `SUP-INV-${Math.floor(Math.random() * 900) + 100}`,
        importDate: new Date('2026-02-10'),
        receivingDate: new Date('2026-02-12'),
      },
    })

    // Create 3-5 cartons per batch
    for (const batch of [factoryBatch, importBatch]) {
      const numCartons = 3 + Math.floor(Math.random() * 3)
      for (let i = 0; i < numCartons; i++) {
        cartonSeq++
        const qty = item.unitsPerCarton - (i === numCartons - 1 ? Math.floor(Math.random() * 3) : 0) // last may be partial
        const loc = locations[Math.floor(Math.random() * locations.length)]
        const qr = `QR-${item.sku}-${batch.batchNumber}-C${String(cartonSeq).padStart(6, '0')}`

        const carton = await prisma.carton.create({
          data: {
            qrCode: qr,
            cartonNumber: `CTN-2026-${String(cartonSeq).padStart(6, '0')}`,
            itemId: item.id,
            batchId: batch.id,
            locationId: loc.id,
            quantity: qty,
            originalQty: item.unitsPerCarton,
            status: "AVAILABLE",
          },
        })
        allCartons.push(carton)

        // Update / create balance
        await prisma.inventoryBalance.upsert({
          where: {
            itemId_batchId_locationId: {
              itemId: item.id,
              batchId: batch.id,
              locationId: loc.id,
            },
          },
          create: {
            itemId: item.id,
            batchId: batch.id,
            locationId: loc.id,
            quantity: qty,
          },
          update: {
            quantity: { increment: qty },
          },
        })
      }
    }
  }
  console.log(`✅ ${allCartons.length} cartons created with QR codes`)

  // ========== SAMPLE MOVEMENT ==========
  const movement = await prisma.stockMovement.create({
    data: {
      movementNumber: 'MV-2026-000001',
      type: "PRODUCTION_RECEIPT",
      reference: 'PROD-ORD-1001',
      effectiveDate: new Date('2026-01-16'),
      status: "POSTED",
      createdById: supervisor.id,
      approvedById: manager.id,
      approvedAt: new Date('2026-01-16'),
      toWarehouseId: whFactory.id,
      notes: 'Initial factory production receipt',
    },
  })

  console.log('✅ Sample movement created')
  console.log('')
  console.log('========================================')
  console.log('SEED COMPLETE')
  console.log('========================================')
  console.log('Login credentials:')
  console.log('  Admin:     admin@inventory.local / Admin@123')
  console.log('  Manager:   manager@inventory.local / Manager@123')
  console.log('  Supervisor: supervisor@inventory.local / Super@123')
  console.log('  Counter:   counter1@inventory.local / Counter@123')
  console.log('  Verifier:  verifier@inventory.local / Verify@123')
  console.log('  Approver:  approver@inventory.local / Approve@123')
  console.log(`Total Cartons with QR: ${allCartons.length}`)
  console.log('========================================')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
