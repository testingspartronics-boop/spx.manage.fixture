'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import nodemailer from 'nodemailer'

// Lấy toàn bộ danh sách fixture từ SQLite thật
export async function getFixtures() {
  try {
    const fixtures = await prisma.fixture.findMany({
      orderBy: { createdAt: 'desc' },
    })


 return fixtures.map(item => {  const days = Math.ceil(
    (item.dueDate.getTime() - new Date().getTime()) /
    (1000 * 60 * 60 * 24)
  )

  return {id: item.fixtureId,serialNo: item.serialNo, name: item.name,owner: item.owner,project: item.project,initials: item.owner
      .split(' ')
      .map(x => x[0])
      .join('')
      .slice(-3),

    maintained: '-',
    nextDue: item.dueDate.toLocaleDateString('vi-VN'),
    days,
    interval: '3 tháng',
    location: '-',
    status:
      item.status === 'INACTIVE'
        ? 'INACTIVE'
        : item.status === 'SCRAPPED'
        ? 'SCRAPPED'
        : days < 0
        ? 'EXPIRED'
        : days <= 15
        ? 'SOON'
        : 'ACTIVE',
  }
})
  } catch (error) {
    console.error(error)
    return []
  }
}

async function ensureProjectDeviceTables() {
  await prisma.$executeRawUnsafe(`
    IF OBJECT_ID(N'dbo.SPX_Project', N'U') IS NULL
    BEGIN
      CREATE TABLE [dbo].[SPX_Project] (
        [id] NVARCHAR(1000) NOT NULL,
        [code] NVARCHAR(255) NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(1000) NULL,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [SPX_Project_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        [updatedAt] DATETIME2 NOT NULL,
        CONSTRAINT [SPX_Project_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [SPX_Project_code_key] UNIQUE ([code])
      )
    END
  `)
  await prisma.$executeRawUnsafe(`
    IF OBJECT_ID(N'dbo.SPX_Device', N'U') IS NULL
    BEGIN
      CREATE TABLE [dbo].[SPX_Device] (
        [id] NVARCHAR(1000) NOT NULL,
        [code] NVARCHAR(255) NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [customerName] NVARCHAR(255) NULL,
        [serialNumber] NVARCHAR(255) NULL,
        [category] NVARCHAR(255) NOT NULL,
        [fgCode] NVARCHAR(255) NULL,
        [quantity] INT NOT NULL CONSTRAINT [SPX_Device_quantity_df] DEFAULT 1,
        [availableQuantity] INT NOT NULL CONSTRAINT [SPX_Device_availableQuantity_df] DEFAULT 1,
        [status] NVARCHAR(50) NOT NULL CONSTRAINT [SPX_Device_status_df] DEFAULT 'ACTIVE',
        [notes] NVARCHAR(1000) NULL,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [SPX_Device_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        [updatedAt] DATETIME2 NOT NULL,
        CONSTRAINT [SPX_Device_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [SPX_Device_code_key] UNIQUE ([code])
      )
    END
  `)
  await prisma.$executeRawUnsafe(`
    IF COL_LENGTH(N'dbo.SPX_Device', N'customerName') IS NULL
      ALTER TABLE [dbo].[SPX_Device] ADD [customerName] NVARCHAR(255) NULL
  `)
  await prisma.$executeRawUnsafe(`
    IF COL_LENGTH(N'dbo.SPX_Device', N'serialNumber') IS NULL
      ALTER TABLE [dbo].[SPX_Device] ADD [serialNumber] NVARCHAR(255) NULL
  `)
  await prisma.$executeRawUnsafe(`
    IF COL_LENGTH(N'dbo.SPX_Device', N'assetType') IS NULL
      ALTER TABLE [dbo].[SPX_Device] ADD [assetType] NVARCHAR(50) NOT NULL CONSTRAINT [SPX_Device_assetType_df] DEFAULT 'DEVICE'
  `)
  await prisma.$executeRawUnsafe(`
    IF COL_LENGTH(N'dbo.SPX_Device', N'location') IS NULL
      ALTER TABLE [dbo].[SPX_Device] ADD [location] NVARCHAR(255) NULL
  `)
  await prisma.$executeRawUnsafe(`
    IF OBJECT_ID(N'dbo.SPX_ProjectDevice', N'U') IS NULL
    BEGIN
      CREATE TABLE [dbo].[SPX_ProjectDevice] (
        [projectId] NVARCHAR(1000) NOT NULL,
        [deviceId] NVARCHAR(1000) NOT NULL,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [SPX_ProjectDevice_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [SPX_ProjectDevice_pkey] PRIMARY KEY CLUSTERED ([projectId], [deviceId]),
        CONSTRAINT [SPX_ProjectDevice_projectId_fkey] FOREIGN KEY ([projectId]) REFERENCES [dbo].[SPX_Project]([id]) ON DELETE CASCADE,
        CONSTRAINT [SPX_ProjectDevice_deviceId_fkey] FOREIGN KEY ([deviceId]) REFERENCES [dbo].[SPX_Device]([id]) ON DELETE CASCADE
      )
    END
  `)
}

export async function getProjectDeviceData() {
  try {
    await ensureProjectDeviceTables()
    const [projects, devices] = await Promise.all([
      prisma.project.findMany({
        include: { devices: { include: { device: true } } },
        orderBy: { code: 'asc' },
      }),
      prisma.device.findMany({ orderBy: { code: 'asc' } }),
    ])

    return {
      projects: projects.map((project) => ({
        id: project.id,
        code: project.code,
        name: project.name,
        description: project.description ?? '',
        deviceIds: project.devices.map((item) => item.deviceId),
      })),
      devices,
    }
  } catch (error) {
    console.error('Không thể khởi tạo/tải bảng dự án và device:', error)
    return { projects: [], devices: [] }
  }
}

export async function createProjectDevice(data: {
  project: { code: string; name: string; description?: string }
  device: {
    code: string
    name: string
    customerName?: string
    serialNumber?: string
    assetType: string
    category: string
    fgCode?: string
    quantity: number
    availableQuantity: number
    location?: string
    notes?: string
  }
  projectId?: string
  deviceId?: string
}) {
  try {
    const project = data.projectId
      ? await prisma.project.findUniqueOrThrow({ where: { id: data.projectId } })
      : await prisma.project.upsert({
          where: { code: data.project.code },
          update: { name: data.project.name, description: data.project.description },
          create: data.project,
        })
    const device = data.deviceId
      ? await prisma.device.findUniqueOrThrow({ where: { id: data.deviceId } })
      : await prisma.device.upsert({
          where: { code: data.device.code },
          update: {
            name: data.device.name,
            customerName: data.device.customerName,
            serialNumber: data.device.serialNumber,
            assetType: data.device.assetType,
            category: data.device.category,
            fgCode: data.device.fgCode,
            quantity: data.device.quantity,
            availableQuantity: data.device.availableQuantity,
            location: data.device.location,
            notes: data.device.notes,
          },
          create: data.device,
        })

    await prisma.projectDevice.upsert({
      where: { projectId_deviceId: { projectId: project.id, deviceId: device.id } },
      update: {},
      create: { projectId: project.id, deviceId: device.id },
    })
    const projectDeviceIds = await prisma.projectDevice.findMany({
      where: { projectId: project.id },
      select: { deviceId: true },
    })
    revalidatePath('/')
    return {
      success: true,
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        description: project.description ?? '',
        deviceIds: projectDeviceIds.map((item) => item.deviceId),
      },
      device: {
        id: device.id,
        code: device.code,
        name: device.name,
        customerName: device.customerName,
        serialNumber: device.serialNumber,
        assetType: device.assetType,
        category: device.category,
        fgCode: device.fgCode,
        quantity: device.quantity,
        availableQuantity: device.availableQuantity,
        status: device.status,
        location: device.location,
        notes: device.notes,
      },
    }
  } catch (error) {
    console.error('Lỗi lưu dự án và device:', error)
    return { success: false, message: 'Không thể lưu dữ liệu. Kiểm tra mã không bị trùng.' }
  }
}

export async function syncDeviceProjects(deviceId: string, projectCodes: string[]) {
  try {
    await prisma.projectDevice.deleteMany({
      where: {
        deviceId,
        project: { code: { notIn: projectCodes } },
      },
    })
    return { success: true }
  } catch (error) {
    console.error('Lỗi đồng bộ liên kết project của device:', error)
    return { success: false, message: 'Không thể đồng bộ project của device' }
  }
}

// Thêm mới fixture vào database thật
export async function createFixture(data: any) {
  try {

    let dueDate = new Date()

    if (data.dueDate) {
      const [day, month, year] = data.dueDate.split('/')

      dueDate = new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
      )
    }

    await prisma.fixture.create({
      data: {
        fixtureId: data.fixtureId,
        serialNo: data.serialNo,
        name: data.name,
        owner: data.owner,
        project: data.project,
        status: data.status || 'ACTIVE',
        dueDate,
      },
    })

    revalidatePath('/')

    return { success: true }
  } catch (error) {
    console.error('Lỗi khi thêm fixture:', error)
    return { success: false, error }
  }
}

export async function updateFixture(fixtureId: string,data: any)
{
  try {

    let dueDate = new Date()
    if (data.dueDate) {const [day, month, year] = data.dueDate.split('/')

      dueDate = new Date( Number(year), Number(month) - 1, Number(day))
    }

    await prisma.fixture.update({
      where: {fixtureId,
      },
      data: {
        serialNo: data.serialNo,
        name: data.name,
        owner: data.owner,
        project: data.project,
        status: data.status,
        dueDate,
      },
    })

    revalidatePath('/')
    return { success: true }

  } catch (error) {
    console.error('Lỗi update fixture:', error)
    return {
      success: false,
      error,
    }
  }
}

export async function createAuditLog(data: {
  user: string
  action: string
  fixtureId: string
  details: string
  ipAddress?: string
}) {
  try {
    await prisma.auditLog.create({
      data: {
        user: data.user,
        action: data.action,
        fixtureId: data.fixtureId,
        details: data.details,
        ipAddress: data.ipAddress,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Lỗi ghi Audit Log:', error)

    return {
      success: false,
      error,
    }
  }
}

export async function sendFixtureReminderEmail(data: {
  fixtureId: string
  fixtureName: string
  serialNo: string
  project: string
  owner: string
  location: string
  nextDue: string
  recipients: string[]
  cc: string[]
}) {
  try {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
      return { success: false, message: 'Chưa cấu hình đầy đủ SMTP trong file .env' }
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: SMTP_PORT === '465',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    })

    await transporter.sendMail({
      from: SMTP_FROM,
      to: data.recipients,
      cc: data.cc,
      subject: `[CẢNH BÁO BẢO TRÌ FIXTURE] ${data.fixtureId} - ${data.fixtureName}`,
      text: [
        `Xin chào ${data.owner},`,
        '',
        'Hệ thống MAINTAIN thông báo fixture đang đến hạn bảo trì/hiệu chuẩn định kỳ.',
        `Mã Fixture: ${data.fixtureId}`,
        `Số Seri: ${data.serialNo}`,
        `Tên thiết bị: ${data.fixtureName}`,
        `Dự án: ${data.project}`,
        `Vị trí: ${data.location}`,
        `Ngày đến hạn: ${data.nextDue}`,
      ].join('\n'),
      html: `
        <p>Xin chào <strong>${data.owner}</strong>,</p>
        <p>Hệ thống MAINTAIN thông báo fixture đang đến hạn bảo trì/hiệu chuẩn định kỳ.</p>
        <ul>
          <li>Mã Fixture: <strong>${data.fixtureId}</strong></li>
          <li>Số Seri: ${data.serialNo}</li>
          <li>Tên thiết bị: ${data.fixtureName}</li>
          <li>Dự án: ${data.project}</li>
          <li>Vị trí: ${data.location}</li>
          <li>Ngày đến hạn: <strong>${data.nextDue}</strong></li>
        </ul>
        <p>Vui lòng hoàn thành công tác bảo trì đúng hạn.</p>
      `,
    })

    return { success: true }
  } catch (error) {
    console.error('Lỗi gửi email fixture:', error)
    return { success: false, message: 'Gửi email thất bại, hãy kiểm tra cấu hình SMTP' }
  }
}

export async function getAuditLogs() {
  const logs = await prisma.auditLog.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  })

  return logs.map((log) => ({
    id: log.id,
    timestamp: new Date(log.timestamp).toLocaleString('vi-VN'),
    user: log.user,

    action: log.action as
      | 'CREATE'
      | 'UPDATE'
      | 'STATUS_CHANGE'
      | 'DELETE'
      | 'SYSTEM',

    fixtureId: log.fixtureId,
    details: log.details,
    ipAddress: log.ipAddress ?? '-',
  }))
}

export async function loginUser(email: string,password: string) {

  console.log("LOGIN DEBUG")
  console.log("EMAIL =", email)
  console.log("PASSWORD =", password)

  const user = await prisma.user.findFirst({where: { email,password, isApproved: true,}, })
  console.log("FOUND USER =", user)
  return user
}

export async function registerUser(data: {
  username: string
  email: string
  password: string
}) {
  try {
    const existingEmail = await prisma.user.findUnique({
      where: {
        email: data.email,
      },
    })

    if (existingEmail) {
      return {
        success: false,
        message: 'Email đã tồn tại trong hệ thống',
      }
    }

    await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password: data.password,
        role: 'USER',
        isApproved: false,
      },
    })

    return {success: true, message: 'Đăng ký thành công', }
  } catch (error) {console.error(error)
    return {success: false, message: 'Có lỗi xảy ra khi đăng ký',}
  }
}

export async function getPendingUsers() {
  return await prisma.user.findMany({
    where: {
      isApproved: false,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

export async function approveUser(id: number) {
  return await prisma.user.update({
    where: {
      id,
    },
    data: {
      isApproved: true,
    },
  })
}

export async function rejectUser(id: number) {
  return await prisma.user.delete({
    where: {
      id,
    },
  })
}