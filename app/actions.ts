'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

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

export async function approveUser(id: string) {
  return await prisma.user.update({
    where: {
      id,
    },
    data: {
      isApproved: true,
    },
  })
}

export async function rejectUser(id: string) {
  return await prisma.user.delete({
    where: {
      id,
    },
  })
}