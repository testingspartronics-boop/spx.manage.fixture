import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Xóa dữ liệu cũ (nếu có)
  await prisma.fixture.deleteMany({})

  // Tạo dữ liệu Fixture thật đầu tiên
  await prisma.fixture.create({
    data: {
      fixtureId: 'FX-2026-001',
      serialNo: 'SN-987654',
      name: 'Fixture kiểm tra mạch RF',
      owner: 'Nguyễn Văn A',
      project: 'Project Alpha',
      status: 'Hoạt động',
      dueDate: new Date('2026-12-31'),
    },
  })

  await prisma.fixture.create({
    data: {
      fixtureId: 'FX-2026-002',
      serialNo: 'SN-123456',
      name: 'Fixture test màn hình OLED',
      owner: 'Trần Thị B',
      project: 'Project Beta',
      status: 'Sắp hết hạn',
      dueDate: new Date('2026-09-15'),
    },
  })

  console.log('Đã nạp dữ liệu mẫu thành công!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })