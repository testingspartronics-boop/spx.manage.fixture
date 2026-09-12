'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {createFixture,updateFixture,createAuditLog,loginUser,registerUser,getPendingUsers,approveUser,rejectUser,sendFixtureReminderEmail,} from "@/app/actions"
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Filter,
  LayoutDashboard,
  Mail,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Wrench,
  XCircle,
  X,
  Lock,
  Clock,
  Calendar as CalendarIcon,
  Send,
  RefreshCw,
  Eye,
  Check,
  AlertTriangle,
  FileText,
  UserCheck,
  Activity,
  History,
  Sun,
  Moon,
  PlusCircle,
  Trash2,
  Laptop
} from 'lucide-react'
import DeviceManager from './device-manager'

// Kiểu dữ liệu
export interface FixtureItem {
  id: string
  serialNo: string
  name: string
  project: string
  owner: string
  initials: string
  maintained: string
  nextDue: string
  days: number
  interval: string
  status: 'ACTIVE' | 'SOON' | 'EXPIRED' | 'INACTIVE' | 'SCRAPPED'
  location: string
}

export interface AuditLog {
  id: string
  timestamp: string
  user: string
  action: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELETE' | 'SYSTEM'
  fixtureId: string
  details: string
  ipAddress?: string
}

export interface EmailLog {
  id: string
  sentAt: string
  recipient: string
  fixtureId: string
  fixtureName: string
  type: 'Lần 1 (30 ngày)' | 'Lần 2 (14 ngày)' | 'Cảnh báo Quá hạn' | 'Thủ công'
  status: 'success' | 'failed'
}

function calculateDaysRemaining(nextDueDateStr: string): number {
  if (!nextDueDateStr) return 0
  const parts = nextDueDateStr.split('/')
  if (parts.length !== 3) return 0
  const due = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffTime = due.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

const initialLogs: AuditLog[] = [
  { id: 'LOG-001', timestamp: '01/09/2026 08:30:00', user: 'admin@factory.com', action: 'CREATE', fixtureId: 'FX-24102', details: 'Khởi tạo dữ liệu fixture Pressure Gauge PG-11', ipAddress: '192.168.1.45' },
  { id: 'LOG-002', timestamp: '01/09/2026 09:15:22', user: 'dung.dt@factory.com', action: 'UPDATE', fixtureId: 'FX-24061', details: 'Cập nhật trạng thái bảo trì định kỳ đợt 3', ipAddress: '192.168.1.88' },
  { id: 'LOG-003', timestamp: '31/08/2026 14:20:10', user: 'admin@factory.com', action: 'STATUS_CHANGE', fixtureId: 'FX-23884', details: 'Chuyển trạng thái fixture thành Đã hết hạn (Expired)', ipAddress: '192.168.1.45' },
  { id: 'LOG-004', timestamp: '30/08/2026 16:45:00', user: 'system@factory.com', action: 'SYSTEM', fixtureId: 'SYSTEM', details: 'Tự động gửi email thông báo bảo trì đợt 1 (30 ngày)', ipAddress: 'Localhost' },
]

const initialEmailLogs: EmailLog[] = [
  { id: 'EML-001', sentAt: '01/09/2026 07:00:00', recipient: 'dung.dt@factory.com', fixtureId: 'FX-24061', fixtureName: 'Height Master HM-04', type: 'Lần 2 (14 ngày)', status: 'success' },
  { id: 'EML-002', sentAt: '31/08/2026 07:00:00', recipient: 'thanh.nq@factory.com', fixtureId: 'FX-23884', fixtureName: 'Digital Caliper DC-14', type: 'Cảnh báo Quá hạn', status: 'success' },
  { id: 'EML-003', sentAt: '30/08/2026 07:00:00', recipient: 'toan.tns@factory.com', fixtureId: 'FX-24102', fixtureName: 'Pressure Gauge PG-11', type: 'Lần 1 (30 ngày)', status: 'success' },
]

const defaultEmailRecipients = [
  'nguyen.duy.tuan@factory.com',
  'truong.quoc.dang@factory.com',
  'bui.van.vinh@factory.com',
]

const defaultManagerCc = ['sep01@factory.com', 'sep02@factory.com']

const getOwnerEmail = (owner: string) =>
  `${owner.toLowerCase().replace(/\s+/g, '.')}@factory.com`

const hasEditPermission = (role: string) =>
  ['ADMIN', 'ENG', 'TECH'].includes(role.trim().toUpperCase())

type UserRole = 'Guest' | 'Admin' | 'ENG' | 'TECH'

const normalizeUserRole = (role: string): Exclude<UserRole, 'Guest'> | null => {
  const normalizedRole = role.trim().toUpperCase()
  if (normalizedRole === 'ADMIN') return 'Admin'
  if (normalizedRole === 'ENG') return 'ENG'
  if (normalizedRole === 'TECH') return 'TECH'
  return null
}

type Language = 'en' | 'vi'

const translations = {
  en: {
    overview: 'Overview', fixtures: 'Fixture list', devices: 'Projects & devices', calendar: 'Maintenance calendar', email: 'Email reminders', logs: 'Change history', users: 'Approve accounts', settings: 'System settings',
    overviewTitle: 'Maintenance overview', fixturesTitle: 'Fixture management', devicesTitle: 'Projects & device management', calendarTitle: 'Periodic fixture maintenance', emailTitle: 'Email notification center', logsTitle: 'Audit log & change history', usersTitle: 'User account approval', settingsTitle: 'System settings',
    qualityOperations: 'QUALITY OPERATIONS / 2026', overviewLineOne: 'Precise control,', overviewLineTwo: 'proactive operations.', totalFixtures: 'Total fixtures', activeFixtures: 'Active', activeFixturesDetail: 'Currently operating', soonFixturesLabel: 'Due soon', soonFixturesDetail: 'Within 15 days', expiredFixtures: 'Overdue', expiredFixturesDetail: 'Requires attention', exportReport: 'Export report', activeRate: 'Active rate', maintenanceAlerts: 'Maintenance alerts requiring attention', maintenanceAlertsDescription: 'Fixtures that are overdue or approaching their maintenance date', manageAllFixtures: 'Manage all fixtures', allFixturesHealthy: 'All fixtures are operating safely.', upcomingReminders: 'Upcoming reminders', overdueFixtures: 'fixtures overdue', soonFixtures: 'fixtures due soon', handleNow: 'Handle now', viewList: 'View list', automaticReminder: 'AUTOMATIC REMINDER RULE', reminderDescription: 'The system emails the owner and in-charge engineer 30 days before a fixture is due for maintenance.', fixtureListTitle: 'Detailed fixture list', fixtureListDescription: 'Track maintenance cycles and responsibility for each fixture in the system', searchFixture: 'Search by ID, serial, name, project...', all: 'All', recentMaintenance: 'Last maintenance', nextMaintenance: 'Next maintenance', action: 'Actions', monthlyTasks: 'Maintenance tasks this month', monthlyTasksDescription: 'Maintenance tasks to complete during this period', noFixtureOnDate: 'No fixtures require maintenance on this date', chooseDate: 'Select a date on the calendar to view details', sendReminder: 'Send reminder email now', sendReminderDescription: 'Send a maintenance notification directly to the responsible engineer without waiting for the automatic schedule', emailLog: 'Email notification log', emailLogDescription: 'History of automatic and manual notifications sent through the factory email system', sentAt: 'Sent at', recipient: 'Recipient', notificationType: 'Notification type', automaticRules: 'Automatic notification rules', ccList: 'Default CC list', auditTitle: 'System audit trail', pendingAccounts: 'Accounts waiting for Admin approval', close: 'Close', save: 'Save', cancel: 'Cancel', edit: 'Edit',
    appearance: 'System appearance', appearanceDescription: 'Customize the display mode for the entire application.', systemInfo: 'System information', language: 'Language', languageDescription: 'Choose the language for interface labels and subtitles.', english: 'English', vietnamese: 'Vietnamese', version: 'Version', application: 'Application', darkMode: 'Dark mode', fixtureCount: 'Fixtures', auditLogCount: 'Audit logs', light: 'Light', dark: 'Dark', system: 'System',
  },
  vi: {
    overview: 'Tổng quan', fixtures: 'Danh sách fixture', devices: 'Dự án & device', calendar: 'Lịch bảo trì', email: 'Nhắc nhở email', logs: 'Lịch sử thay đổi', users: 'Duyệt tài khoản', settings: 'Cài đặt hệ thống',
    overviewTitle: 'Tổng quan bảo trì', fixturesTitle: 'Quản lý danh sách Fixture', devicesTitle: 'Quản lý dự án & device', calendarTitle: 'Lịch bảo trì fixture định kỳ', emailTitle: 'Trung tâm quản lý thông báo Email', logsTitle: 'Nhật ký truy xuất & lịch sử thay đổi', usersTitle: 'Duyệt tài khoản người dùng', settingsTitle: 'Cài đặt hệ thống',
    qualityOperations: 'QUALITY OPERATIONS / 2026', overviewLineOne: 'Kiểm soát chính xác,', overviewLineTwo: 'vận hành chủ động.', totalFixtures: 'Tổng fixture', activeFixtures: 'Còn hiệu lực', activeFixturesDetail: 'Đang vận hành', soonFixturesLabel: 'Sắp hết hạn', soonFixturesDetail: 'Trong 15 ngày tới', expiredFixtures: 'Đã hết hạn', expiredFixturesDetail: 'Cần xử lý ngay', exportReport: 'Xuất báo cáo', activeRate: 'Tỷ lệ đang hoạt động', maintenanceAlerts: 'Cảnh báo bảo trì cần xử lý', maintenanceAlertsDescription: 'Các fixture đã hết hạn hoặc chuẩn bị đến hạn bảo trì', manageAllFixtures: 'Quản lý tất cả fixture', allFixturesHealthy: 'Tất cả fixture đều đang vận hành trong trạng thái an toàn.', upcomingReminders: 'Lịch nhắc sắp tới', overdueFixtures: 'fixture đã quá hạn', soonFixtures: 'fixture sắp hết hạn', handleNow: 'Xử lý ngay', viewList: 'Xem danh sách', automaticReminder: 'QUY TẮC NHẮC TỰ ĐỘNG', reminderDescription: 'Hệ thống gửi email cho owner và kỹ sư in-charge trước 30 ngày khi fixture đến hạn bảo trì.', fixtureListTitle: 'Danh sách fixture chi tiết', fixtureListDescription: 'Theo dõi chu kỳ bảo trì và trách nhiệm của từng fixture trong hệ thống', searchFixture: 'Tìm theo ID, Seri, tên, dự án...', all: 'Tất cả', recentMaintenance: 'Lần bảo trì gần nhất', nextMaintenance: 'Bảo trì tiếp theo', action: 'Thao tác', monthlyTasks: 'Tác vụ bảo trì trong tháng', monthlyTasksDescription: 'Các đợt bảo trì cần hoàn tất trong khoảng thời gian này', noFixtureOnDate: 'Không có fixture cần bảo trì trong ngày này', chooseDate: 'Chọn ngày trên lịch để xem chi tiết', sendReminder: 'Gửi email nhắc nhở tức thì', sendReminderDescription: 'Gửi trực tiếp thông báo bảo trì cho kỹ sư phụ trách mà không cần chờ lịch chạy tự động', emailLog: 'Nhật ký gửi email', emailLogDescription: 'Lịch sử các thông báo tự động và thủ công đã được phát ra hệ thống email nhà máy', sentAt: 'Thời gian gửi', recipient: 'Người nhận', notificationType: 'Loại thông báo', automaticRules: 'Quy tắc thông báo tự động', ccList: 'Danh sách CC mặc định', auditTitle: 'Nhật ký kiểm toán hệ thống', pendingAccounts: 'Danh sách tài khoản đang chờ Admin phê duyệt', close: 'Đóng', save: 'Lưu', cancel: 'Hủy', edit: 'Chỉnh sửa',
    appearance: 'Giao diện hệ thống', appearanceDescription: 'Tùy chỉnh chế độ hiển thị cho toàn bộ ứng dụng.', systemInfo: 'Thông tin hệ thống', language: 'Ngôn ngữ', languageDescription: 'Chọn ngôn ngữ cho nhãn và phụ đề giao diện.', english: 'Tiếng Anh', vietnamese: 'Tiếng Việt', version: 'Phiên bản', application: 'Ứng dụng', darkMode: 'Dark Mode', fixtureCount: 'Số fixture', auditLogCount: 'Số audit log', light: 'Sáng', dark: 'Tối', system: 'Hệ thống',
  },
} as const

const statusMeta = {  
  ACTIVE: {label: 'Còn hiệu lực',className: 'status-valid',icon: CheckCircle2, },
  SOON: {label: 'Sắp hết hạn',className: 'status-soon',icon: Bell,},
  EXPIRED: {label: 'Đã hết hạn',className: 'status-expired',icon: XCircle,},
  INACTIVE: {label: 'Tạm ngừng',   className: 'bg-gray-100 text-gray-700 border-gray-300',icon: XCircle,},
  SCRAPPED: { label: 'Đã hủy', className: 'bg-rose-100 text-rose-800 border-rose-300', icon: XCircle,},
}

interface FixtureDashboardProps {
  initialFixtures: any[]
  initialAuditLogs: AuditLog[]
  initialProjectDeviceData: { projects: any[]; devices: any[] }
}

export function FixtureDashboard({initialFixtures, initialAuditLogs, initialProjectDeviceData,}: FixtureDashboardProps) {
  const router = useRouter()
  const [fixturesList, setFixturesList] =  useState<any[]>(Array.isArray(initialFixtures)? initialFixtures : [])
  const [logsList, setLogsList] = useState<AuditLog[]>(initialAuditLogs || [])
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>(initialEmailLogs)
  
  const [query, setQuery] = useState('')
  const [activeStatus, setActiveStatus] = useState('all')
  const [activeNav, setActiveNav] = useState<
    'dashboard' |
    'fixtures' |
    'devices' |
    'calendar' |
    'email' |
    'logs' |
    'settings' |
    'users'
  >('dashboard')
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [notice, setNotice] = useState('')
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<FixtureItem | null>(null)
  const [fixtureMenu, setFixtureMenu] = useState<{ fixture: FixtureItem; x: number; y: number } | null>(null)
  const [historyFixture, setHistoryFixture] = useState<FixtureItem | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ email: string; role: UserRole }>({email: 'Guest (Chỉ xem)',role: 'Guest',})
  const [isAuthHydrated, setIsAuthHydrated] = useState(false)
  const [pendingUsers, setPendingUsers] = useState<any[]>([])

  // State tùy chỉnh cột
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState({
    fixture: true,
    owner: true,
    maintained: true,
    nextDue: true,
    status: true,
    actions: true,
  })

  // State Lịch
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date(2026, 8, 1))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)


  // State Cấu hình Email
  const [reminderCc, setReminderCc] = useState<string[]>(defaultManagerCc)
  const [newCcEmail, setNewCcEmail] = useState('')
  const [previewFixture, setPreviewFixture] =useState<FixtureItem | null>( initialFixtures?.[0] ?? null)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)

  // State Nâng Cấp riêng cho Tab Logs & Theme
  const [logSearchQuery, setLogSearchQuery] = useState('')
  const [logActionFilter, setLogActionFilter] = useState<string>('ALL')
  const [selectedLogDetail, setSelectedLogDetail] = useState<AuditLog | null>(null)
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('system')
  const [language, setLanguage] = useState<Language>('en')
  const copy = translations[language]

  // Theme Manager Effect
  useEffect(() => {
    const savedTheme = (localStorage.getItem('theme-mode') as 'light' | 'dark' | 'system') || 'system'
    setThemeMode(savedTheme)
    const savedLanguage = localStorage.getItem('app-language')
    if (savedLanguage === 'en' || savedLanguage === 'vi') setLanguage(savedLanguage)
  }, [])

  useEffect(() => {
    localStorage.setItem('app-language', language)
  }, [language])

  useEffect(() => {
    const savedUser = localStorage.getItem('current-user')

    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser)
        if (
          ['Admin', 'ENG', 'TECH', 'Guest'].includes(parsedUser.role) &&
          typeof parsedUser.email === 'string'
        ) {
          setCurrentUser(parsedUser)
        }
      } catch {
        localStorage.removeItem('current-user')
      }
    }

    setIsAuthHydrated(true)
  }, [])

  useEffect(() => {
    if (!isAuthHydrated) return

    if (currentUser.role !== 'Guest') {
      localStorage.setItem('current-user', JSON.stringify(currentUser))
    } else {
      localStorage.removeItem('current-user')
    }
  }, [currentUser, isAuthHydrated])

  useEffect(() => {
    if (currentUser.role === 'Guest' && (activeNav === 'email' || activeNav === 'logs')) {
      setActiveNav('dashboard')
    }
    if (currentUser.role === 'Guest') {
      setFixtureMenu(null)
      setHistoryFixture(null)
    }
  }, [currentUser.role, activeNav])

  useEffect(() => {
    const root = document.documentElement
    if (themeMode === 'dark') {
      root.classList.add('dark')
    } else if (themeMode === 'light') {
      root.classList.remove('dark')
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
    localStorage.setItem('theme-mode', themeMode)
  }, [themeMode])

  useEffect(() => {getPendingUsers().then(setPendingUsers)}, [])

  const filtered = useMemo(() => fixturesList.filter((item) => {
    const searchTarget = `${item.id} ${item.serialNo} ${item.name} ${item.project} ${item.owner}`.toLowerCase()
    const matchesQuery = searchTarget.includes(query.toLowerCase())
    return matchesQuery && (activeStatus === 'all' || item.status === activeStatus)
  }), [query, activeStatus, fixturesList])

const urgentFixtures = useMemo(() => {
  return fixturesList.filter((f) => f.status === 'EXPIRED' || f.status === 'SOON'
  )
}, [fixturesList])

const soonFixtures = useMemo(() => {
  return fixturesList.filter(
    (f) => f.status === 'SOON'
  )
}, [fixturesList])

const criticalSoonFixtures = useMemo(() => {
  return fixturesList.filter(
    (f) => f.status === 'SOON' && f.days <= 7
  )
}, [fixturesList])

  // Filtered Logs dành riêng cho Tab Nhật Ký
  const filteredLogs = useMemo(() => {
    return logsList.filter((log) => {
      const target = `${log.id} ${log.user} ${log.fixtureId} ${log.details}`.toLowerCase()
      const matchesSearch = target.includes(logSearchQuery.toLowerCase())
      const matchesAction = logActionFilter === 'ALL' || log.action === logActionFilter
      return matchesSearch && matchesAction
    })
  }, [logsList, logSearchQuery, logActionFilter])

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2800)
  }

 const addAuditLog = async (action: string,fixtureId: string,details: string) => {
  await createAuditLog({
    user: currentUser.email,
    action,
    fixtureId,
    details,
    ipAddress: '192.168.1.102',
  })

  const newLog = {
    id: `LOG-${Date.now()}`,
    timestamp: new Date().toLocaleString('vi-VN'),
    user: currentUser.email,
    action: action as AuditLog['action'],
    fixtureId,
    details,
    ipAddress: '192.168.1.102',
  }

  setLogsList((prev) => [newLog, ...prev])
}

  // Cập nhật UI ngay
  /*const newLog: AuditLog = {
    id: `LOG-${Date.now()}`,
    timestamp: new Date().toLocaleString('vi-VN'),
    user: currentUser.email,
    action,
    fixtureId,
    details,
    ipAddress: '192.168.1.102',
  }

  setLogsList((prev) => [newLog, ...prev])
}*/

  const handleExportCSV = () => {
    if (fixturesList.length === 0) {
      showNotice('Không có dữ liệu để xuất!')
      return
    }

    const headers = ['Ma Fixture', 'So Seri', 'Ten Fixture', 'Du An', 'Ky Su Phu Trach', 'Vi Tri', 'Bao Tri Gan Nhat', 'Bao Tri Tiep Theo', 'Chu Ky', 'Trang Thai']
    
    const rows = fixturesList.map((item) => [
      `"${item.id}"`,
      `"${item.serialNo}"`,
      `"${item.name}"`,
      `"${item.project}"`,
      `"${item.owner}"`,
      `"${item.location}"`,
      `"${item.maintained}"`,
      `"${item.nextDue}"`,
      `"${item.interval}"`,
      `"${item.status}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Bao_Cao_Fixture_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showNotice('Đã tải xuống file báo cáo CSV thành công!')
  }

  // Hàm Xuất Audit Log CSV riêng
  const handleExportLogsCSV = () => {
    if (logsList.length === 0) {
      showNotice('Không có nhật ký để xuất!')
      return
    }

    const headers = ['Ma Log', 'Thoi Gian', 'Nguoi Thuc Hien', 'Hanh Dong', 'Ma Fixture', 'Chi Tiet', 'IP Address']
    const rows = logsList.map((log) => [
      `"${log.id}"`,
      `"${log.timestamp}"`,
      `"${log.user}"`,
      `"${log.action}"`,
      `"${log.fixtureId}"`,
      `"${log.details.replace(/"/g, '""')}"`,
      `"${log.ipAddress || ''}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Audit_Log_Fixture_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showNotice('Đã tải xuống nhật ký Audit Log (CSV) thành công!')
  }

  const statusName: Record<string, string> = {ACTIVE: 'Đang sử dụng',SOON: 'Sắp hết hạn',EXPIRED: 'Đã hết hạn',INACTIVE: 'Tạm ngừng',SCRAPPED: 'Đã hủy',}
  const handleSaveFixture = async (data: Partial<FixtureItem>) => {
    if (!hasEditPermission(currentUser.role)) {
      showNotice('Vui lòng đăng nhập để thêm hoặc chỉnh sửa Fixture!')
      return
    }
    if (editingItem) {
      const days = calculateDaysRemaining(data.nextDue || editingItem.nextDue)
      const updateResult = await updateFixture(
        editingItem.id,
        {
          serialNo: data.serialNo,
          name: data.name,
          owner: data.owner,
          project: data.project,
          status: data.status,
          dueDate: data.nextDue,
        }
      )
      if (!updateResult.success) {
        showNotice('Không thể cập nhật fixture. Vui lòng thử lại.')
        return
      }
      router.refresh()
      if (data.status && data.status !== editingItem.status) {
        addAuditLog('STATUS_CHANGE', editingItem.id, `Thay đổi trạng thái: ${statusName[editingItem.status]} -> ${statusName[data.status as string]}`)
      }
      addAuditLog('UPDATE', editingItem.id, `Cập nhật dữ liệu fixture ${editingItem.id}: ${data.name || editingItem.name}`)
      
      showNotice(`Đã cập nhật fixture ${editingItem.id}`)
    } else {
      const newId = data.id || `FX-${Math.floor(10000 + Math.random() * 90000)}`
      const initials = data.owner ? data.owner.split(' ').map((n) => n[0]).join('').slice(-3).toUpperCase() : 'NA'
      const days = calculateDaysRemaining(data.nextDue || '')
      
      const newItem: FixtureItem = {
        id: newId,
        serialNo: data.serialNo || `SN-${Math.floor(10000 + Math.random() * 90000)}`,
        name: data.name || '',
        project: data.project || 'Chưa gán',
        owner: data.owner || 'Chưa gán',
        initials,
        maintained: data.maintained || new Date().toLocaleDateString('vi-VN'),
        nextDue: data.nextDue || new Date().toLocaleDateString('vi-VN'),
        days,
        interval: data.interval || '3 tháng',
        status: (data.status as any) || 'ACTIVE',
        location: data.location || 'Nhà máy',
      }
      const createResult = await createFixture({
        fixtureId: newId,
        serialNo: newItem.serialNo,
        name: newItem.name,
        owner: newItem.owner,
        project: newItem.project,
        status: newItem.status,
        dueDate: newItem.nextDue,
      })
      if (!createResult.success) {
        showNotice('Không thể thêm fixture. Vui lòng thử lại.')
        return
      }
      router.refresh()
      await addAuditLog('CREATE', newId, `Thêm mới fixture ${data.name} (SN: ${newItem.serialNo})`)
      showNotice(`Đã thêm mới fixture ${newId}`)
      window.location.reload()
    }
  }

const handleQuickCompleteMaintenance = async (fixture: FixtureItem) => {
  if (!hasEditPermission(currentUser.role)) {
    showNotice('Vui lòng đăng nhập để xác nhận bảo trì!')
    return
  }
  const todayStr = new Date().toLocaleDateString('vi-VN')
  const months = parseInt(fixture.interval) || 3
  const today = new Date()
  today.setMonth(today.getMonth() + months)
  const nextDueStr = today.toLocaleDateString('vi-VN')
  const days = calculateDaysRemaining(nextDueStr)
  const result = await updateFixture(fixture.id, {
    serialNo: fixture.serialNo,
    name: fixture.name,
    owner: fixture.owner,
    project: fixture.project,
    status: 'ACTIVE',
    dueDate: nextDueStr,
  })
  if (!result.success) {
    showNotice('Không thể lưu trạng thái bảo trì. Vui lòng thử lại.')
    return
  }
  setFixturesList((prev) => prev.map((item) => item.id === fixture.id
        ? {
            ...item,
            maintained: todayStr,
            nextDue: nextDueStr,
            days,
            status: 'ACTIVE',
          }
        : item
    )
  )
  addAuditLog('UPDATE',fixture.id,`Xác nhận hoàn thành bảo trì. Ngày bảo trì tiếp theo: ${nextDueStr}`)

  showNotice(`Đã xác nhận bảo trì thành công cho ${fixture.id}!`
  )
}

  const handleSendManualEmail = async (fixture: FixtureItem) => {
    const ownerEmail = getOwnerEmail(fixture.owner)
    const result = await sendFixtureReminderEmail({
      fixtureId: fixture.id,
      fixtureName: fixture.name,
      serialNo: fixture.serialNo,
      project: fixture.project,
      owner: fixture.owner,
      location: fixture.location,
      nextDue: fixture.nextDue,
      recipients: defaultEmailRecipients,
      cc: reminderCc.concat(ownerEmail),
    })

    if (!result.success) {
      showNotice(result.message || 'Gửi email thất bại!')
      return
    }

    const newLog: EmailLog = {
      id: `EML-${Date.now()}`,
      sentAt: new Date().toLocaleString('vi-VN'),
      recipient: defaultEmailRecipients.join('; '),
      fixtureId: fixture.id,
      fixtureName: fixture.name,
      type: 'Thủ công',
      status: 'success',
    }
    setEmailLogs((prev) => [newLog, ...prev])
    addAuditLog('SYSTEM', fixture.id, `Phát email nhắc nhở thủ công tới kỹ sư ${fixture.owner} (${fixture.id})`)
    showNotice(`Đã gửi email nhắc nhở tới ${defaultEmailRecipients.length} người nhận!`)
  }

const handleAddCc = (e: React.FormEvent) => {
  e.preventDefault()

  if (!hasEditPermission(currentUser.role)) {
    showNotice('Vui lòng đăng nhập để chỉnh sửa danh sách CC!')
    return
  }

  if (!newCcEmail || !newCcEmail.includes('@')) {
    showNotice('Vui lòng nhập email hợp lệ!')
    return
  }

  setReminderCc((prev) => [...prev, newCcEmail])
  setNewCcEmail('')
  showNotice('Đã thêm địa chỉ CC mới!')
}

const handleRemoveCc = (emailToRemove: string) => {
  if (!hasEditPermission(currentUser.role)) {showNotice('Vui lòng đăng nhập để chỉnh sửa danh sách CC!')
    return
  }
  setReminderCc((prev) =>
    prev.filter((e) => e !== emailToRemove)
  )
  showNotice('Đã xóa địa chỉ CC!')
}

  const normalizeDate = (date: string) => {
    const [d, m, y] = date.split('/')
    return `${Number(d)}/${Number(m)}/${Number(y)}`
  }

  const calendarDaysList = useMemo(() => {
    const year = currentCalendarDate.getFullYear()
    const month = currentCalendarDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
    const totalDays = lastDay.getDate()

    const daysArr = []

    for (let i = 0; i < startingDayOfWeek; i++) {
      daysArr.push({ dayNumber: null, dateStr: '', items: [] })
    }

    for (let day = 1; day <= totalDays; day++) {
      const dayFormatted = String(day).padStart(2, '0')
      const monthFormatted = String(month + 1).padStart(2, '0')
      const dateStr = `${dayFormatted}/${monthFormatted}/${year}`

      const itemsOnThisDay = fixturesList.filter((f) => normalizeDate(f.nextDue) === normalizeDate(dateStr))
      //console.log(dateStr,itemsOnThisDay.length)

      const hasExpired = itemsOnThisDay.some((item) => item.status === 'EXPIRED' )
      const hasSoon = itemsOnThisDay.some((item) => item.status === 'SOON')

      daysArr.push({dayNumber: day, dateStr, items: itemsOnThisDay,hasExpired,hasSoon,})}

    return daysArr
  }, [currentCalendarDate, fixturesList])

  const selectedDateFixtures = useMemo(() => {
    if (!selectedDate) return []

    return fixturesList.filter((f) => normalizeDate(f.nextDue) === normalizeDate(selectedDate))
  }, [selectedDate, fixturesList])

  const getVietnameseDate = () => {
  const now = new Date()

  const weekdays = [
    'Chủ Nhật',
    'Thứ Hai',
    'Thứ Ba',
    'Thứ Tư',
    'Thứ Năm',
    'Thứ Sáu',
    'Thứ Bảy',
  ]
  return `${weekdays[now.getDay()]}, ${String(
    now.getDate()
  ).padStart(2, '0')} tháng ${String(
    now.getMonth() + 1
  ).padStart(2, '0')}, ${now.getFullYear()}`
}

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <aside className="sidebar fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-border px-7">
          <div className="brand-mark"><Wrench className="size-4" /></div>
          <div>
            <p className="font-mono text-sm font-bold tracking-[0.18em] text-primary">MAINTAIN</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{language === 'en' ? 'Asset operations center' : 'Trung tâm quản lý tài sản'}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          <NavItem icon={LayoutDashboard} label={copy.overview} active={activeNav === 'dashboard'} onClick={() => setActiveNav('dashboard')} />
          <NavItem icon={ClipboardList} label={copy.fixtures} count={String(fixturesList.length)} active={activeNav === 'fixtures'} onClick={() => setActiveNav('fixtures')} />
          <NavItem icon={Laptop} label={copy.devices} count={String(initialProjectDeviceData.devices.length)} active={activeNav === 'devices'} onClick={() => setActiveNav('devices')} />
          <NavItem icon={CalendarDays} label={copy.calendar} active={activeNav === 'calendar'} onClick={() => setActiveNav('calendar')} />
          {currentUser.role === 'Admin' && (
            <NavItem icon={Mail} label={copy.email} count={String(emailLogs.length)} active={activeNav === 'email'} onClick={() => setActiveNav('email')} />
          )}
          <div className="my-5 border-t border-border" />
          {currentUser.role !== 'Guest' && <NavItem icon={ShieldAlert} label={copy.logs} count={String(logsList.length)} active={activeNav === 'logs'} onClick={() => setActiveNav('logs')} />}
          {currentUser.role === 'Admin' && (
          <NavItem
            icon={UserCheck}
            label={copy.users}
            count={String(pendingUsers.length)}
            active={activeNav === 'users'}
            onClick={() => setActiveNav('users')}
          />
        )}
          <NavItem
            icon={Settings2}
            label={copy.settings}
            active={activeNav === 'settings'}
            onClick={() => setActiveNav('settings')}
          />
        </nav>

        <div className="border-t border-border p-5 cursor-pointer hover:bg-muted/50 transition" onClick={() => setIsAuthModalOpen(true)}>
          <div className="flex items-center gap-3">
            <div className="avatar">{currentUser.role === 'Guest' ? 'G' : currentUser.role === 'Admin' ? 'AD' : currentUser.role}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{currentUser.role === 'Guest' ? 'View Only' : currentUser.role}</p>
              <p className="text-xs text-muted-foreground">{currentUser.email}</p>
            </div>
            <ChevronDown className="ml-auto size-4 text-muted-foreground" />
          </div>
        </div>
      </aside>

      {isMobileNavOpen && (
        <>
          <button
            type="button"
            aria-label="Đóng menu điều hướng"
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <aside className="sidebar fixed inset-y-0 left-0 z-40 flex w-[min(82vw,18rem)] flex-col border-r border-border bg-sidebar lg:hidden">
            <div className="flex h-20 items-center justify-between gap-3 border-b border-border px-5">
              <div className="flex items-center gap-3">
                <div className="brand-mark"><Wrench className="size-4" /></div>
                <div>
                  <p className="font-mono text-sm font-bold tracking-[0.18em] text-primary">MAINTAIN</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Asset operations center</p>
                </div>
              </div>
              <button className="icon-button subtle" aria-label="Đóng menu" onClick={() => setIsMobileNavOpen(false)}><X className="size-5" /></button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
              <NavItem icon={LayoutDashboard} label={copy.overview} active={activeNav === 'dashboard'} onClick={() => { setActiveNav('dashboard'); setIsMobileNavOpen(false) }} />
              <NavItem icon={ClipboardList} label={copy.fixtures} count={String(fixturesList.length)} active={activeNav === 'fixtures'} onClick={() => { setActiveNav('fixtures'); setIsMobileNavOpen(false) }} />
              <NavItem icon={Laptop} label={copy.devices} count={String(initialProjectDeviceData.devices.length)} active={activeNav === 'devices'} onClick={() => { setActiveNav('devices'); setIsMobileNavOpen(false) }} />
              <NavItem icon={CalendarDays} label={copy.calendar} active={activeNav === 'calendar'} onClick={() => { setActiveNav('calendar'); setIsMobileNavOpen(false) }} />
              {currentUser.role === 'Admin' && <NavItem icon={Mail} label={copy.email} count={String(emailLogs.length)} active={activeNav === 'email'} onClick={() => { setActiveNav('email'); setIsMobileNavOpen(false) }} />}
              <div className="my-5 border-t border-border" />
              {currentUser.role !== 'Guest' && <NavItem icon={ShieldAlert} label={copy.logs} count={String(logsList.length)} active={activeNav === 'logs'} onClick={() => { setActiveNav('logs'); setIsMobileNavOpen(false) }} />}
              {currentUser.role === 'Admin' && <NavItem icon={UserCheck} label={copy.users} count={String(pendingUsers.length)} active={activeNav === 'users'} onClick={() => { setActiveNav('users'); setIsMobileNavOpen(false) }} />}
              <NavItem icon={Settings2} label={copy.settings} active={activeNav === 'settings'} onClick={() => { setActiveNav('settings'); setIsMobileNavOpen(false) }} />
            </nav>
            <div className="border-t border-border p-5" onClick={() => { setIsMobileNavOpen(false); setIsAuthModalOpen(true) }}>
              <div className="flex items-center gap-3">
                <div className="avatar">{currentUser.role === 'Guest' ? 'G' : currentUser.role === 'Admin' ? 'AD' : currentUser.role}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{currentUser.role === 'Guest' ? 'View Only' : currentUser.role}</p>
                  <p className="truncate text-xs text-muted-foreground">{currentUser.email}</p>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      <main className="lg:pl-64">
        <header className="flex min-h-20 items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 sm:px-5 md:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button className="icon-button shrink-0 lg:hidden" aria-label="Mở menu điều hướng" onClick={() => setIsMobileNavOpen(true)}><Menu className="size-5" /></button>
            <div className="min-w-0">
            <p className="eyebrow truncate">{getVietnameseDate()}</p>
            <h1 className="mt-1 truncate text-lg font-semibold tracking-tight sm:text-xl">
              {activeNav === 'dashboard' && copy.overviewTitle}
              {activeNav === 'fixtures' && copy.fixturesTitle}
              {activeNav === 'devices' && copy.devicesTitle}
              {activeNav === 'calendar' && copy.calendarTitle}
              {activeNav === 'email' && copy.emailTitle}
              {activeNav === 'logs' && copy.logsTitle}
              {activeNav === 'settings' && copy.settingsTitle}
              {activeNav === 'users' && copy.usersTitle}
            </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button className="icon-button" aria-label="Thông báo"><Bell className="size-5" /><span className="notification-dot" /></button>
            {activeNav === 'fixtures' && (
              <button
                className="button-primary"
                onClick={() => {
                  if (!hasEditPermission(currentUser.role)) {
                    showNotice('Vui lòng đăng nhập để chỉnh sửa dữ liệu!')
                    return
                  }

                  setEditingItem(null)
                  setIsModalOpen(true)
                }}
              >
                <Plus className="size-4" /> {language === 'en' ? 'Add fixture' : 'Thêm fixture'}
              </button>
            )}
            {activeNav === 'logs' && (
              <button className="button-outline mobile-icon-button" onClick={handleExportLogsCSV}>
                <Download className="size-4" /> Xuất Audit Log
              </button>
            )}
          </div>
        </header>

        <div className="p-4 sm:p-5 md:p-10">
          {notice && <div className="toast"><CheckCircle2 className="size-4" />{notice}</div>}

          {/* ================= TAB 1: TỔNG QUAN ================= */}
          {activeNav === 'dashboard' && (
            <>
              <div className="mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-accent-panel">
                <div className="flex flex-col justify-between gap-6 p-6 md:flex-row md:items-center md:p-8">
                  <div>
                    <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500" /><p className="eyebrow text-primary">{copy.qualityOperations}</p></div>
                    <h2 className="mt-3 max-w-xl text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                      {copy.overviewLineOne}<br /><span className="text-primary">{copy.overviewLineTwo}</span>
                    </h2>
                    <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{language === 'en' ? 'Monitor fixture health and handle priority maintenance tasks from one screen.' : 'Theo dõi tình trạng fixture và xử lý các lịch bảo trì cần ưu tiên trong một màn hình.'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col md:items-end">
                    <div className="rounded-xl border border-border/70 bg-card/80 px-4 py-3 text-left md:min-w-48">
                      <p className="text-xs text-muted-foreground">{copy.activeRate}</p>
                      <p className="mt-1 text-2xl font-semibold text-primary">{fixturesList.length ? Math.round((fixturesList.filter((fixture) => fixture.status === 'ACTIVE').length / fixturesList.length) * 100) : 0}%</p>
                    </div>
                    <button className="button-primary justify-center" onClick={handleExportCSV}><Download className="size-4" /> {copy.exportReport}</button>
                  </div>
                </div>
              </div>

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label={copy.totalFixtures} value={String(fixturesList.length)} detail={language === 'en' ? '+8 this month' : '+8 tháng này'} icon={Wrench} tone="neutral" />
                <MetricCard label={copy.activeFixtures} value={String(fixturesList.filter(f => f.status === 'ACTIVE').length)} detail={copy.activeFixturesDetail} icon={CheckCircle2} tone="green" />
                <MetricCard label={copy.soonFixturesLabel} value={String(fixturesList.filter(f => f.status === 'SOON').length)} detail={copy.soonFixturesDetail} icon={Bell} tone="amber" />
                <MetricCard label={copy.expiredFixtures} value={String(fixturesList.filter(f => f.status === 'EXPIRED').length)} detail={copy.expiredFixturesDetail} icon={XCircle} tone="red" />
              </section>

              <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="panel overflow-hidden">
                  <div className="flex items-center justify-between gap-4 border-b border-border p-6 pb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{copy.maintenanceAlerts}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">{copy.maintenanceAlertsDescription}</p>
                    </div>
                    <button 
                      onClick={() => setActiveNav('fixtures')} 
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      {copy.manageAllFixtures} ({fixturesList.length}) →
                    </button>
                  </div>

                  <div className="space-y-3 p-6">
                    {urgentFixtures.length === 0 ? (
                      <p className="p-8 text-center text-sm text-muted-foreground">{copy.allFixturesHealthy}</p>
                    ) : (
                      urgentFixtures.map((item) => {
                        const meta = statusMeta[item.status as keyof typeof statusMeta] || statusMeta.ACTIVE
                        const Icon = meta.icon
                        return (
                          <div key={item.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition">
                            <div className="flex items-center gap-3">
                              <div className="fixture-icon"><Wrench className="size-4" /></div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-primary">{item.id}</span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{item.serialNo}</span>
                                </div>
                                <p className="font-medium text-sm mt-0.5">{item.name}</p>
                                <p className="text-xs text-muted-foreground">Phụ trách: {item.owner} • {item.project}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`status-badge ${meta.className}`}>
                                <Icon className="size-3.5" />{meta.label}
                              </span>
                              <p className="text-xs text-muted-foreground mt-1">Hạn: {item.nextDue}</p>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                      <div className="panel p-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="eyebrow">{language === 'en' ? 'ACTION REQUIRED' : 'CẢNH BÁO CẦN XỬ LÝ'}</p>
                            <h3 className="mt-2 text-lg font-semibold">
                              {copy.upcomingReminders}
                            </h3>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-col gap-4">
                          <Reminder
                            color="red"
                            title={`${fixturesList.filter(f => f.status === 'EXPIRED').length} ${copy.overdueFixtures}`}
                            detail={language === 'en' ? 'Schedule maintenance again' : 'Cần lên lịch bảo trì lại'}
                            action={copy.handleNow}
                            onClick={() => {
                              setActiveNav('fixtures')
                              setActiveStatus('EXPIRED')
                            }}
                          />
                          <Reminder
                            color="amber"
                            title={`${fixturesList.filter(f => f.status === 'SOON').length} ${copy.soonFixtures}`}
                            detail={language === 'en' ? 'Schedule maintenance within 15 days' : 'Cần lên lịch bảo trì trước 15 ngày'}
                            action={copy.viewList}
                            onClick={() => {
                              setActiveNav('fixtures')
                              setActiveStatus('SOON')
                            }}
                          />
                        </div>
                        </div>
                      <div className="panel accent-panel p-5">
                        <div className="flex items-center gap-2 text-primary">
                          <Mail className="size-4" />
                          <p className="eyebrow text-primary">{copy.automaticReminder}</p>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-foreground">
                          {copy.reminderDescription}
                        </p>

                        <p className="mt-3 text-xs leading-5 text-muted-foreground">
                          Gửi tới: {defaultEmailRecipients.join(', ')}. CC: {reminderCc.join(', ')} và kỹ sư phụ trách.
                        </p>
                      </div>
                    </div>
              </section>
            </>
          )}

          {activeNav === 'devices' && <DeviceManager
            initialData={initialProjectDeviceData}
            auditLogs={initialAuditLogs}
            currentUserEmail={currentUser.email}
            currentUserRole={currentUser.role}
            onOpenFixtureForm={() => {
              if (!hasEditPermission(currentUser.role)) {
                showNotice('Vui lòng đăng nhập để chỉnh sửa dữ liệu!')
                return
              }
              setActiveNav('fixtures')
              setEditingItem(null)
              setIsModalOpen(true)
            }}
          />}

          {/* ================= TAB 2: DANH SÁCH FIXTURE CHI TIẾT ================= */}
          {activeNav === 'fixtures' && (
            <div className="panel overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-border p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{copy.fixtureListTitle}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{copy.fixtureListDescription}</p>
                </div>
                <button className="button-ghost" onClick={() => setIsColumnModalOpen(true)}>
                  <SlidersHorizontal className="size-4" /> Tùy chỉnh cột
                </button>
              </div>
              
              <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-4 md:flex-row">
                <div className="search-box">
                  <Search className="size-4 text-muted-foreground" />
                  <input aria-label={copy.searchFixture} placeholder={copy.searchFixture} value={query} onChange={(event) => setQuery(event.target.value)} />
                </div>
                <div className="flex gap-2 overflow-x-auto">
                  <FilterButton label={copy.all} active={activeStatus === 'all'} onClick={() => setActiveStatus('all')} />
                  <FilterButton label="Sắp hết hạn" active={activeStatus === 'SOON'} onClick={() => setActiveStatus('SOON')}/>
                  <FilterButton label="Đã hết hạn" active={activeStatus === 'EXPIRED'} onClick={() => setActiveStatus('EXPIRED')}/>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      {visibleColumns.fixture && <th>Fixture & Serial</th>}
                      {visibleColumns.owner && <th>Owner / Dự án</th>}
                      {visibleColumns.maintained && <th>{copy.recentMaintenance}</th>}
                      {visibleColumns.nextDue && <th>{copy.nextMaintenance}</th>}
                      {visibleColumns.status && <th>Trạng thái</th>}
                      {visibleColumns.actions && <th>{copy.action}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => {
                      const meta = statusMeta[item.status as keyof typeof statusMeta] || statusMeta.ACTIVE
                      const Icon = meta.icon
                      return (
                        <tr key={item.id}>
                          {visibleColumns.fixture && (
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="fixture-icon"><Wrench className="size-4" /></div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-primary">{item.id}</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{item.serialNo}</span>
                                  </div>
                                  <p className="mt-0.5 whitespace-nowrap font-medium">{item.name}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">{item.location}</p>
                                </div>
                              </div>
                            </td>
                          )}

                          {visibleColumns.owner && (
                            <td>
                              <div className="flex items-center gap-2.5">
                                <div className="avatar small">{item.initials}</div>
                                <div>
                                  <p className="whitespace-nowrap text-sm font-medium">{item.owner}</p>
                                  <p className="text-xs text-muted-foreground">{item.project}</p>
                                </div>
                              </div>
                            </td>
                          )}

                          {visibleColumns.maintained && (
                            <td className="whitespace-nowrap text-sm text-muted-foreground">{item.maintained}</td>
                          )}

                          {visibleColumns.nextDue && (
                            <td>
                              <p className="whitespace-nowrap text-sm font-medium">{item.nextDue}</p>
                              <p className="text-xs text-muted-foreground">Chu kỳ {item.interval}</p>
                              <p className={`text-xs ${item.days < 0 ? 'text-destructive font-medium' : item.days < 90 ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                                {item.days < 0 ? `Quá hạn ${Math.abs(item.days)} ngày` : `Còn ${item.days} ngày`}
                              </p>
                            </td>
                          )}

                          {visibleColumns.status && (
                            <td>
                              <span className={`status-badge ${meta.className}`}>
                                <Icon className="size-3.5" />{meta.label}
                              </span>
                            </td>
                          )}

                          {visibleColumns.actions && (
                            <td>
                              {currentUser.role !== 'Guest' && <button className="icon-button subtle" aria-label="Fixture actions" onClick={(event) => setFixtureMenu({ fixture: item, x: event.clientX, y: event.clientY })}><MoreHorizontal className="size-4" /></button>}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 3: LỊCH BẢO TRÌ ================= */}
          {activeNav === 'calendar' && (
            <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
              <div className="panel p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="size-5 text-primary" />
                    <h3 className="font-semibold text-lg">
                      {language === 'en' ? 'Month' : 'Tháng'} {currentCalendarDate.getMonth() + 1}, {currentCalendarDate.getFullYear()}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="button-outline py-1.5 px-3 text-xs"
                      onClick={() => {
                        const d = new Date(currentCalendarDate)
                        d.setMonth(d.getMonth() - 1)
                        setCurrentCalendarDate(d)
                      }}
                    >
                      <ChevronLeft className="size-4" /> Tháng trước
                    </button>
                    <button
                      className="button-outline py-1.5 px-3 text-xs"
                      onClick={() => setCurrentCalendarDate(new Date(2026, 8, 1))}
                    >
                      Hiện tại
                    </button>
                    <button
                      className="button-outline py-1.5 px-3 text-xs"
                      onClick={() => {
                        const d = new Date(currentCalendarDate)
                        d.setMonth(d.getMonth() + 1)
                        setCurrentCalendarDate(d)
                      }}
                    >
                      Tháng sau <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="grid grid-cols-7 text-center font-medium text-xs text-muted-foreground pb-2 border-b border-border">
                    <div>Thứ 2</div>
                    <div>Thứ 3</div>
                    <div>Thứ 4</div>
                    <div>Thứ 5</div>
                    <div>Thứ 6</div>
                    <div>Thứ 7</div>
                    <div>Chủ nhật</div>
                  </div>

                  <div className="grid grid-cols-7 auto-rows-fr gap-1 pt-2">
                    {calendarDaysList.map((dayObj, idx) => (
                    <div
                      key={idx}
                      onClick={() =>
                        dayObj.dateStr &&
                        setSelectedDate(dayObj.dateStr)
                      }
                      className={`min-h-[95px] p-2 rounded-lg border flex flex-col justify-between transition cursor-pointer ${
                        dayObj.dayNumber
                          ? dayObj.hasExpired
                            ? 'bg-rose-50 border-rose-300'
                            : dayObj.hasSoon
                            ? 'bg-amber-50 border-amber-300'
                            : 'bg-background hover:border-primary/40 border-border/50'
                          : 'bg-muted/10 border-transparent'
                      }`}
                    >
                        {dayObj.dayNumber && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-semibold ${dayObj.dayNumber === 1 ? 'w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center' : 'text-muted-foreground'}`}>
                                {dayObj.dayNumber}
                              </span>
                              {dayObj.items.length > 0 && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                                  {dayObj.items.length} đợt
                                </span>
                              )}
                            </div>

                            <div className="mt-1 space-y-1">
                              {dayObj.items.map((item) => (
                                <div
                                  key={item.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingItem(item)
                                    setIsModalOpen(true)
                                  }}
                                  className={`cursor-pointer rounded p-1 text-[11px] leading-tight font-medium truncate border transition ${
                                    item.status === 'EXPIRED'
                                      ? 'bg-rose-50 border-rose-300 text-rose-700'
                                      : item.status === 'SOON'
                                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                                      : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                  }`}
                                  title={`${item.id} - ${item.name}`}
                                >
                                  {item.id}: {item.name}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <div className="panel p-5">
                  <h3 className="mb-1 text-base font-semibold">{copy.monthlyTasks}</h3>
                  <p className="mb-4 text-xs text-muted-foreground">{copy.monthlyTasksDescription}</p>

                  <div className="space-y-3">
                    {selectedDate ? (
                      <>
                        <p className="text-sm font-semibold text-primary">
                          {selectedDate}
                        </p>

                        <div className="space-y-3">
                          {selectedDateFixtures.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {copy.noFixtureOnDate}
                            </p>
                          ) : (
                            selectedDateFixtures.map((item) => (
                              <div
                                key={item.id}
                                className="p-3 rounded-lg border border-border bg-muted/20"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-mono text-xs font-bold text-primary">
                                      {item.id}
                                    </p>

                                    <p className="text-sm font-medium">
                                      {item.name}
                                    </p>
                                  </div>

                                  <span
                                    className={`status-badge ${
                                      statusMeta[item.status as keyof typeof statusMeta]?.className
                                    }`}
                                  >
                                    {statusMeta[item.status as keyof typeof statusMeta]?.label}
                                  </span>
                                </div>

                                <div className="mt-2 text-xs text-muted-foreground">
                                  Owner: {item.owner}
                                </div>

                                <div className="text-xs text-muted-foreground">
                                  Project: {item.project}
                                </div>

                                <div className="text-xs text-muted-foreground">
                                  Due: {item.nextDue}
                                </div>
                                  <button
                                    onClick={() => {
                                      if (!hasEditPermission(currentUser.role)) {
                                        showNotice('Vui lòng đăng nhập để xác nhận bảo trì!')
                                        return
                                      }

                                      handleQuickCompleteMaintenance(item)
                                    }}
                                    className="mt-3 text-xs font-semibold text-primary hover:underline"
                                  >
                                    ✅ Đã bảo trì
                                  </button>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {copy.chooseDate}
                      </p>
                    )}
                  </div>
                </div>

                <div className="panel accent-panel p-5">
                  <div className="flex items-center gap-2 text-primary">
                    <Clock className="size-4" />
                    <p className="eyebrow text-primary">QUY TRÌNH CHUẨN (SOP)</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Kỹ sư thực hiện việc hiệu chuẩn/bảo trì cần kiểm tra lại độ chính xác, cập nhật tem bảo trì dán trên fixture và nhấn nút <strong>"Đã bảo trì"</strong> để hệ thống tự động tính ngày đến hạn đợt sau.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 4: NHẮC NHỞ EMAIL ================= */}
          {currentUser.role === 'Admin' && activeNav === 'email' && (
            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                {/* Panel 1: Trigger Gửi Mail Thủ Công Cho Fixture Sắp Đến Hạn */}
                <div className="panel p-6">
                  <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{copy.sendReminder}</h3>
                      <p className="text-sm text-muted-foreground">{copy.sendReminderDescription}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {urgentFixtures.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition">
                        <div className="flex items-center gap-3">
                          <div className="fixture-icon"><Wrench className="size-4" /></div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-primary">{item.id}</span>
                              <span className="text-xs text-muted-foreground">• Phụ trách: <strong>{item.owner}</strong></span>
                            </div>
                            <p className="font-medium text-sm mt-0.5">{item.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setPreviewFixture(item)
                              setIsPreviewModalOpen(true)
                            }}
                            className="button-ghost py-1.5 px-3 text-xs"
                          >
                            <Eye className="size-3.5" /> Preview
                          </button>
                            <button
                              onClick={() => {
                                if (!hasEditPermission(currentUser.role)) {
                                  showNotice('Vui lòng đăng nhập để gửi Email!')
                                  return
                                }

                                handleSendManualEmail(item)
                              }}
                              className="button-primary py-1.5 px-3 text-xs"
                            >
                            <Send className="size-3.5" /> Gửi mail
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Panel 2: Nhật ký Email Đã Gửi */}
                <div className="panel p-6">
                  <h3 className="mb-1 text-lg font-semibold">{copy.emailLog}</h3>
                  <p className="mb-4 text-sm text-muted-foreground">{copy.emailLogDescription}</p>

                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{copy.sentAt}</th>
                          <th>{copy.recipient} (To)</th>
                          <th>Mã Fixture</th>
                          <th>{copy.notificationType}</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {emailLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="whitespace-nowrap font-mono text-xs text-muted-foreground">{log.sentAt}</td>
                            <td className="font-mono text-xs text-foreground">{log.recipient}</td>
                            <td>
                              <span className="font-mono text-xs font-bold text-primary">{log.fixtureId}</span>
                              <p className="text-xs text-muted-foreground truncate max-w-[140px]">{log.fixtureName}</p>
                            </td>
                            <td className="text-xs font-medium">{log.type}</td>
                            <td>
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                                <Check className="size-3.5" /> Thành công
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Sidebar Cấu hình Quy tắc Email & Danh sách CC */}
              <div className="space-y-6">
                <div className="panel p-5">
                  <h3 className="mb-1 text-base font-semibold">{copy.automaticRules}</h3>
                  <p className="text-xs text-muted-foreground mb-4">Hệ thống Cronjob quét dữ liệu hàng ngày vào lúc 07:00 AM</p>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Nhắc đợt 1 (30 ngày trước hạn)</span>
                        <span className="text-emerald-600">Đang bật</span>
                      </div>
                      <p className="text-muted-foreground">Gửi cho Kỹ sư phụ trách để chuẩn bị vật tư/thiết bị hiệu chuẩn.</p>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Nhắc đợt 2 (14 ngày trước hạn)</span>
                        <span className="text-emerald-600">Đang bật</span>
                      </div>
                      <p className="text-muted-foreground">Nhắc khẩn cấp + CC Trưởng nhóm QC để sắp xếp ngưng máy sản xuất.</p>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-rose-50 border-rose-200 space-y-1">
                      <div className="flex items-center justify-between font-semibold text-rose-800">
                        <span>Cảnh báo Quá hạn (Overdue)</span>
                        <span className="text-rose-700">Ưu tiên cao</span>
                      </div>
                      <p className="text-rose-600">Gửi mail daily lúc 07:00 AM cho đến khi fixture được xác nhận bảo trì.</p>
                    </div>
                  </div>
                </div>

                {/* Quản lý CC list */}
                <div className="panel p-5">
                  <h3 className="mb-1 text-base font-semibold">{copy.ccList}</h3>
                  <p className="text-xs text-muted-foreground mb-4">Những người luôn nhận được bản sao email nhắc nhở</p>

                  <div className="space-y-2 mb-4">
                    {reminderCc.map((email) => (
                      <div key={email} className="flex items-center justify-between p-2 rounded bg-muted/50 text-xs font-mono">
                        <span className="truncate max-w-[220px]">{email}</span>
                        <button onClick={() => handleRemoveCc(email)} className="text-muted-foreground hover:text-destructive">
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddCc} className="flex gap-2">
                    <input
                      type="email"
                      placeholder="Thêm email CC..."
                      value={newCcEmail}
                      onChange={(e) => setNewCcEmail(e.target.value)}
                      className="flex-1 rounded-md border border-input px-2.5 py-1.5 text-xs bg-background"
                    />
                    <button type="submit" className="button-primary py-1.5 px-3 text-xs">
                      Thêm
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 5: LỊCH SỬ THAY ĐỔI (AUDIT LOG - THIẾT KẾ MỚI SHADCN & DARK/LIGHT THEME) ================= */}
          {currentUser.role !== 'Guest' && activeNav === 'logs' && (
            <div className="space-y-6">
              {/* Header điều khiển Theme Switcher & Thông tin Tab */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
                <div>
                      <h3 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
                        <ShieldAlert className="size-5 text-primary" /> {copy.auditTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Ghi vết toàn bộ hành vi khởi tạo, chỉnh sửa và cấu hình hệ thống chuẩn ISO 9001 / IATF 16949
                  </p>
                </div>
              </div>

              {/* Thống kê nhanh Audit Statistics Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Tổng bản ghi Log</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{logsList.length}</p>
                  </div>
                  <div className="rounded-lg p-3 bg-primary/10 text-primary">
                    <History className="size-5" />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Thêm mới Fixture</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {logsList.filter((l) => l.action === 'CREATE').length}
                    </p>
                  </div>
                  <div className="rounded-lg p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <PlusCircle className="size-5" />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Cập nhật / Bảo trì</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {logsList.filter((l) => l.action === 'UPDATE').length}
                    </p>
                  </div>
                  <div className="rounded-lg p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Activity className="size-5" />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Hệ thống & Trạng thái</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {logsList.filter((l) => l.action === 'STATUS_CHANGE' || l.action === 'SYSTEM').length}
                    </p>
                  </div>
                  <div className="rounded-lg p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <RefreshCw className="size-5" />
                  </div>
                </div>
              </div>

              {/* Card Bảng dữ liệu chính */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                {/* Thanh tìm kiếm & Lọc theo Action Segmented Controller */}
                <div className="flex flex-col gap-4 border-b border-border p-4 sm:p-5 md:flex-row md:items-center justify-between bg-muted/20">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Tìm theo ID, Mã Fixture, Tài khoản, Nội dung..."
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                    {[
                      { id: 'ALL', label: 'Tất cả' },
                      { id: 'CREATE', label: 'Tạo mới' },
                      { id: 'UPDATE', label: 'Cập nhật' },
                      { id: 'STATUS_CHANGE', label: 'Trạng thái' },
                      { id: 'SYSTEM', label: 'Hệ thống' },
                    ].map((act) => (
                      <button
                        key={act.id}
                        onClick={() => setLogActionFilter(act.id)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                          logActionFilter === act.id
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-background border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bảng Audit Log */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                      <tr>
                        <th className="py-3 px-4">Mã Log & Thời gian</th>
                        <th className="py-3 px-4">Tài khoản thực hiện</th>
                        <th className="py-3 px-4">Hành động</th>
                        <th className="py-3 px-4">Mã Fixture</th>
                        <th className="py-3 px-4">Chi tiết thay đổi</th>
                        <th className="py-3 px-4">Địa chỉ IP</th>
                        <th className="py-3 px-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-10 text-muted-foreground">
                            Không tìm thấy nhật ký thao tác phù hợp!
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => {
                          const actionBadges = {
                            CREATE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
                            UPDATE: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20',
                            STATUS_CHANGE: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
                            DELETE: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20',
                            SYSTEM: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20',
                          }[log.action] || 'bg-muted text-muted-foreground border-border'

                          return (
                            <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                              <td className="py-3.5 px-4">
                                <span className="font-mono font-semibold text-primary block">{log.id}</span>
                                <span className="font-mono text-[11px] text-muted-foreground">{log.timestamp}</span>
                              </td>

                              <td className="py-3.5 px-4 font-medium text-foreground">
                                <div className="flex items-center gap-1.5">
                                  <UserCheck className="size-3.5 text-muted-foreground" />
                                  <span>{log.user}</span>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-mono font-bold border ${actionBadges}`}>
                                  {log.action}
                                </span>
                              </td>

                              <td className="py-3.5 px-4">
                                <span className="font-mono text-xs font-semibold rounded bg-muted/60 px-1.5 py-0.5 border border-border">
                                  {log.fixtureId}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 max-w-xs sm:max-w-md truncate text-muted-foreground" title={log.details}>
                                {log.details}
                              </td>

                              <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                                {log.ipAddress || '192.168.1.1'}
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <button
                                  onClick={() => setSelectedLogDetail(log)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                                >
                                  <Eye className="size-3.5" /> Xem
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeNav === 'users' && (
            <div className="panel p-6">

              <h3 className="text-lg font-semibold">
                Yêu cầu cấp quyền
              </h3>

              <p className="text-sm text-muted-foreground mt-1 mb-6">
                {copy.pendingAccounts}
              </p>

              {pendingUsers.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Không có yêu cầu nào đang chờ duyệt
                </div>
              ) : (
                <div className="space-y-3">

                  {pendingUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div>
                        <div className="font-medium">
                          {user.username}
                        </div>

                        <div className="text-sm text-muted-foreground">
                          {user.email}
                        </div>
                      </div>

                      <div className="flex gap-2">

                        <button
                          className="bg-green-600 text-white px-3 py-2 rounded-md"
                          onClick={async () => {

                            await approveUser(user.id)

                            setPendingUsers((prev) =>
                              prev.filter((x) => x.id !== user.id)
                            )

                            showNotice('Đã phê duyệt tài khoản')
                          }}
                        >
                          Approve
                        </button>

                        <button
                          className="bg-red-600 text-white px-3 py-2 rounded-md"
                          onClick={async () => {

                            await rejectUser(user.id)

                            setPendingUsers((prev) =>
                              prev.filter((x) => x.id !== user.id)
                            )

                            showNotice('Đã từ chối tài khoản')
                          }}
                        >
                          Reject
                        </button>

                      </div>
                    </div>
                  ))}

                </div>
              )}

            </div>
          )}

          {activeNav === 'settings' && (
            <div className="space-y-6">

              <div className="panel p-6">
                <h3 className="text-lg font-semibold">{copy.appearance}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{copy.appearanceDescription}</p>

                <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2 w-fit">

                  <button
                    onClick={() => setThemeMode('light')}
                    className={`px-4 py-2 rounded-md text-sm ${
                      themeMode === 'light'
                        ? 'bg-primary text-primary-foreground'
                        : ''
                    }`}
                  >
                    ☀️ {copy.light}
                  </button>

                  <button
                    onClick={() => setThemeMode('dark')}
                    className={`px-4 py-2 rounded-md text-sm ${
                      themeMode === 'dark'
                        ? 'bg-primary text-primary-foreground'
                        : ''
                    }`}
                  >
                    🌙 {copy.dark}
                  </button>

                  <button
                    onClick={() => setThemeMode('system')}
                    className={`px-4 py-2 rounded-md text-sm ${
                      themeMode === 'system'
                        ? 'bg-primary text-primary-foreground'
                        : ''
                    }`}
                  >
                    💻 {copy.system}
                  </button>

                </div>
              </div>

              <div className="panel p-6">
                <h3 className="text-lg font-semibold">{copy.language}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{copy.languageDescription}</p>
                <div className="mt-4 flex w-fit items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
                  <button type="button" onClick={() => setLanguage('en')} className={`rounded-md px-4 py-2 text-sm ${language === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{copy.english}</button>
                  <button type="button" onClick={() => setLanguage('vi')} className={`rounded-md px-4 py-2 text-sm ${language === 'vi' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{copy.vietnamese}</button>
                </div>
              </div>

            </div>
          )}

        </div>
        <footer className="border-t border-border px-5 py-5 text-xs text-muted-foreground md:px-10">
          <div className="flex flex-col justify-between gap-1 sm:flex-row">
            <span>© 2026 MAINTAIN {language === 'en' ? 'Asset Operations Center' : 'Trung tâm vận hành tài sản'}</span>
            <span>{copy.version} 1.0.0</span>
          </div>
        </footer>
      </main>

      {fixtureMenu && currentUser.role !== 'Guest' && <div className="fixed z-50 w-64 rounded-lg border border-border bg-card p-4 shadow-2xl" style={{ left: fixtureMenu.x, top: fixtureMenu.y }} onMouseLeave={() => setFixtureMenu(null)}><div className="mb-3 border-b border-border pb-3"><p className="font-mono text-sm font-bold text-primary">{fixtureMenu.fixture.id}</p><p className="text-sm font-medium">{fixtureMenu.fixture.name}</p></div><button className="mb-2 w-full rounded-md border border-primary/30 bg-primary/5 p-2 text-left text-xs font-semibold text-primary hover:bg-accent-panel" onClick={() => { setEditingItem(fixtureMenu.fixture); setFixtureMenu(null); setIsModalOpen(true) }}>Chỉnh sửa Fixture</button><button className="w-full rounded-md border border-border bg-muted/40 p-2 text-left text-xs font-semibold hover:border-primary hover:text-primary" onClick={() => { setHistoryFixture(fixtureMenu.fixture); setFixtureMenu(null) }}>History change ({logsList.filter((log) => log.fixtureId === fixtureMenu.fixture.id).length})</button></div>}

      {historyFixture && currentUser.role !== 'Guest' && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={() => setHistoryFixture(null)}><div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="mb-4 flex items-start justify-between border-b border-border pb-4"><div><p className="eyebrow">HISTORY CHANGE</p><h3 className="mt-1 text-lg font-semibold">{historyFixture.id}</h3><p className="text-sm text-muted-foreground">{historyFixture.name}</p></div><button className="icon-button subtle" onClick={() => setHistoryFixture(null)} aria-label="Đóng"><X className="size-5" /></button></div><div className="max-h-80 space-y-3 overflow-y-auto">{logsList.filter((log) => log.fixtureId === historyFixture.id).length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Chưa có lịch sử thay đổi.</p> : logsList.filter((log) => log.fixtureId === historyFixture.id).map((log) => <div key={log.id} className="rounded-lg border border-border bg-muted/30 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-primary">{log.action === 'CREATE' ? 'Tạo mới' : 'Change'}</span><span className="text-xs text-muted-foreground">{log.timestamp}</span></div><p className="mt-1 text-xs text-muted-foreground">{log.user}</p><p className="mt-2 leading-5">{log.details}</p></div>)}</div></div></div>}

      {/* MODAL XEM CHI TIẾT LOG AUDIT (Dành riêng cho Tab 6) */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <FileText className="size-4 text-primary" /> Chi tiết nhật ký Audit Log
              </h3>
              <button onClick={() => setSelectedLogDetail(null)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg border border-border text-xs">
                <div>
                  <span className="text-muted-foreground block">Mã bản ghi:</span>
                  <span className="font-mono font-bold text-primary">{selectedLogDetail.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Loại hành động:</span>
                  <span className="font-mono font-bold text-foreground">{selectedLogDetail.action}</span>
                </div>
                <div className="mt-2">
                  <span className="text-muted-foreground block">Thời gian thực hiện:</span>
                  <span className="font-mono text-foreground">{selectedLogDetail.timestamp}</span>
                </div>
                <div className="mt-2">
                  <span className="text-muted-foreground block">Địa chỉ IP Client:</span>
                  <span className="font-mono text-foreground">{selectedLogDetail.ipAddress || 'N/A'}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Người thực hiện:</label>
                <p className="font-mono text-xs bg-muted/30 p-2 rounded border border-border text-foreground">{selectedLogDetail.user}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Fixture liên quan:</label>
                <p className="font-mono text-xs font-bold text-primary bg-muted/30 p-2 rounded border border-border">{selectedLogDetail.fixtureId}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Nội dung chi tiết thay đổi:</label>
                <p className="text-xs leading-relaxed bg-muted/30 p-3 rounded border border-border text-foreground">
                  {selectedLogDetail.details}
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-border flex justify-end">
              <button className="button-primary w-full" onClick={() => setSelectedLogDetail(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW EMAIL TEMPLATE */}
      {isPreviewModalOpen && previewFixture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-xl bg-background border border-border p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Mail className="size-4 text-primary" /> Mẫu xem trước Email (Email Template)
              </h3>
              <button onClick={() => setIsPreviewModalOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-white text-gray-900 p-5 space-y-4 font-sans text-sm">
              <div className="border-b pb-3 space-y-1 text-xs text-gray-600">
                <p><strong>To:</strong> {defaultEmailRecipients.join('; ')}</p>
                <p><strong>Cc:</strong> {reminderCc.concat(getOwnerEmail(previewFixture.owner)).join('; ')}</p>
                <p><strong>Subject:</strong> <span className="text-red-600 font-semibold">[CẢNH BÁO BẢO TRÌ FIXTURE]</span> {previewFixture.id} - {previewFixture.name}</p>
              </div>

              <div className="space-y-3">
                <p>Xin chào <strong>{previewFixture.owner}</strong>,</p>
                <p>Hệ thống MAINTAIN thông báo fixture do bạn phụ trách đang đến hạn bảo trì/hiệu chuẩn định kỳ. Chi tiết như sau:</p>

                <div className="bg-gray-50 rounded p-3 border text-xs space-y-1.5 font-mono">
                  <p>• Mã Fixture: <strong>{previewFixture.id}</strong> (Seri: {previewFixture.serialNo})</p>
                  <p>• Tên thiết bị: {previewFixture.name}</p>
                  <p>• Dự án: {previewFixture.project}</p>
                  <p>• Vị trí hiện tại: {previewFixture.location}</p>
                  <p>• Ngày đến hạn: <strong className="text-red-600">{previewFixture.nextDue}</strong></p>
                </div>

                <p className="text-xs text-gray-600">Vui lòng hoàn thành công tác bảo trì đúng hạn và ấn nút xác nhận trên hệ thống để đảm bảo chất lượng dây chuyền.</p>

                <div className="pt-2">
                  <button className="bg-emerald-600 text-white font-medium text-xs px-4 py-2 rounded">
                    Xác nhận đã hoàn thành bảo trì
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-border flex justify-end gap-3">
              <button className="button-outline" onClick={() => setIsPreviewModalOpen(false)}>Đóng</button>
              <button 
                className="button-primary" 
                  onClick={() => {
                    if (!hasEditPermission(currentUser.role)) {
                      showNotice('Vui lòng đăng nhập để gửi Email!')
                      return
                    }

                    handleSendManualEmail(previewFixture)
                    setIsPreviewModalOpen(false)
                  }}
              >
                Gửi ngay email này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TÙY CHỈNH CỘT */}
      {isColumnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-background border border-border p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-primary" /> Tùy chỉnh cột hiển thị
              </h3>
              <button onClick={() => setIsColumnModalOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {[
                { key: 'fixture', label: 'Fixture & Serial' },
                { key: 'owner', label: 'Owner / Dự án' },
                { key: 'maintained', label: 'Lần bảo trì gần nhất' },
                { key: 'nextDue', label: 'Bảo trì tiếp theo' },
                { key: 'status', label: 'Trạng thái' },
                { key: 'actions', label: 'Thao tác' },
              ].map((col) => (
                <label key={col.key} className="flex items-center justify-between cursor-pointer rounded-md p-2 hover:bg-muted/50 transition text-sm">
                  <span>{col.label}</span>
                  <input
                    type="checkbox"
                    checked={visibleColumns[col.key as keyof typeof visibleColumns]}
                    onChange={(e) =>
                      setVisibleColumns((prev) => ({
                        ...prev,
                        [col.key]: e.target.checked,
                      }))
                    }
                    className="size-4 rounded border-input text-primary focus:ring-primary"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 pt-3 border-t border-border flex justify-end">
              <button className="button-primary w-full" onClick={() => setIsColumnModalOpen(false)}>
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÊM / SỬA FIXTURE */}
      {isModalOpen && (
        <ModalFixtureForm
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveFixture}
          initialData={editingItem}
        />
      )}

      {/* MODAL PHÂN QUYỀN */}
      {isAuthModalOpen && (
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          showNotice={showNotice}
        />
      )}
    </div>
  )
}

function NavItem({ icon: Icon, label, count, active = false, onClick }: { icon: typeof Wrench; label: string; count?: string; active?: boolean; onClick?: () => void }) {
  return <button onClick={onClick} className={`nav-item ${active ? 'active' : ''}`}><Icon className="size-[18px]" /><span>{label}</span>{count && <span className="nav-count">{count}</span>}</button>
}
function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof Wrench; tone: string }) {
  return <div className="metric-card"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p></div><div className={`metric-icon ${tone}`}><Icon className="size-4" /></div></div><p className={`mt-3 text-xs ${tone === 'red' ? 'text-destructive' : tone === 'amber' ? 'text-warning' : 'text-muted-foreground'}`}>{detail}</p></div>
}
function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`filter-button ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function Reminder({
  color,
  title,
  detail,
  action,
  onClick,
}: {
  color: string
  title: string
  detail: string
  action: string
  onClick?: () => void
}) {
  return (
    <div className="flex gap-3">
      <div className={`reminder-dot ${color}`} />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {title}
        </p>

        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {detail}
        </p>

        <button
          type="button"
          onClick={onClick}
          className="mt-2 text-xs font-semibold text-primary hover:underline"
        >
          {action} →
        </button>
      </div>
    </div>
  )
}

function ModalFixtureForm({ isOpen, onClose, onSave, initialData }: { isOpen: boolean; onClose: () => void; onSave: (data: Partial<FixtureItem>) => void; initialData: FixtureItem | null }) {
  const formatToInputDate = (str?: string) => {
    if (!str || !str.includes('/')) return ''
    const [d, m, y] = str.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const formatToDisplayDate = (str?: string) => {
    if (!str || !str.includes('-')) return str || ''
    const [y, m, d] = str.split('-')
    return `${d}/${m}/${y}`
  }

  const getMonthNumber = (intervalStr: string) => {
    const num = parseInt(intervalStr)
    return isNaN(num) ? 3 : num
  }

  const calculateNextDueDate = (maintainedDate: string, intervalMonths: string) => {
    if (!maintainedDate) return ''
    const months = parseInt(intervalMonths) || 3
    const parts = maintainedDate.split('-')
    if (parts.length !== 3) return ''

    const year = parseInt(parts[0])
    const month = parseInt(parts[1]) - 1
    const day = parseInt(parts[2])

    const d = new Date(year, month, day)
    d.setMonth(d.getMonth() + months)

    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

const autoCalculateStatus = (nextDueDateStr: string,currentStatus: string) => {
  if (    currentStatus === 'INACTIVE' || currentStatus === 'SCRAPPED') 
  {
    return currentStatus
  }

  if (!nextDueDateStr) return 'ACTIVE'
  const due = new Date(nextDueDateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil(
    (due.getTime() - today.getTime()) /
    (1000 * 60 * 60 * 24)
  )
  return diffDays < 0
    ? 'EXPIRED'
    : diffDays <= 15
    ? 'SOON'
    : 'ACTIVE'
}

  const initialMaintained = formatToInputDate(initialData?.maintained)
  const initialInterval = String(getMonthNumber(initialData?.interval || '3'))
  const initialNextDue = formatToInputDate(initialData?.nextDue) || calculateNextDueDate(initialMaintained, initialInterval)

  const [formData, setFormData] = useState({
    id: initialData?.id || '',
    name: initialData?.name || '',
    project: initialData?.project || '',
    owner: initialData?.owner || '',
    maintained: initialMaintained,
    nextDue: initialNextDue,
    interval: initialInterval,
    status: initialData?.status ||'ACTIVE',
    location: initialData?.location || '',
  })

  const handleMaintainedOrIntervalChange = (maintainedDate: string, intervalMonths: string) => {
    const nextDate = calculateNextDueDate(maintainedDate, intervalMonths)
    const computedStatus = autoCalculateStatus(nextDate, formData.status)

    setFormData((prev) => ({
      ...prev,
      maintained: maintainedDate,
      interval: intervalMonths,
      nextDue: nextDate,
      status: computedStatus as any,
    }))
  }

const isInactive = formData.status === 'INACTIVE'

const isScrapped = formData.status === 'SCRAPPED'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-background border border-border p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-lg font-semibold">{initialData ? 'Chỉnh sửa Fixture' : 'Thêm mới Fixture'}</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted"><X size={18} /></button>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...formData,
            interval: `${formData.interval} tháng`,
            maintained: formatToDisplayDate(formData.maintained),
            nextDue: formatToDisplayDate(formData.nextDue),
          } as any);
          onClose();
        }} className="mt-5 space-y-6">
          <section>
            <div className="mb-3 border-b border-border pb-2">
              <p className="text-sm font-semibold">Nhận diện Fixture</p>
              <p className="mt-1 text-xs text-muted-foreground">Thông tin cơ bản để tra cứu fixture trong hệ thống.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Mã ID Fixture</label>
                <input type="text" disabled={!!initialData} value={formData.id} onChange={(e) => setFormData({ ...formData, id: e.target.value })} placeholder="FX-24105 (tự tạo)" className="w-full rounded-md border border-input p-2 text-sm bg-background disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tên Fixture / Thiết bị</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ví dụ: JIG Assembly A12" className="w-full rounded-md border border-input p-2 text-sm bg-background" />
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 border-b border-border pb-2">
              <p className="text-sm font-semibold">Phụ trách & dự án</p>
              <p className="mt-1 text-xs text-muted-foreground">Xác định người phụ trách và project đang sử dụng fixture.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Kỹ sư phụ trách</label>
                <input type="text" required value={formData.owner} onChange={(e) => setFormData({ ...formData, owner: e.target.value })} placeholder="Nguyễn Văn A" className="w-full rounded-md border border-input p-2 text-sm bg-background" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Dự án</label>
                <input type="text" required value={formData.project} onChange={(e) => setFormData({ ...formData, project: e.target.value })} placeholder="Dự án Orion" className="w-full rounded-md border border-input p-2 text-sm bg-background" />
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 border-b border-border pb-2">
              <p className="text-sm font-semibold">Lịch bảo trì & lưu kho</p>
              <p className="mt-1 text-xs text-muted-foreground">Ngày bảo trì tiếp theo được tự động tính theo chu kỳ.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Bảo trì gần nhất</label>
                <input type="date" required disabled={isInactive || isScrapped} value={formData.maintained} onChange={(e) => handleMaintainedOrIntervalChange(e.target.value, formData.interval)} className="w-full rounded-md border border-input p-2 text-sm bg-background" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Bảo trì tiếp theo</label>
                <input type="date" disabled value={formData.nextDue} className="w-full rounded-md border border-input p-2 text-sm bg-muted text-muted-foreground cursor-not-allowed opacity-75" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Chu kỳ bảo trì</label>
                <select disabled={isInactive || isScrapped} value={formData.interval} onChange={(e) => handleMaintainedOrIntervalChange(formData.maintained, e.target.value)} className="w-full rounded-md border border-input p-2 text-sm bg-background">
                  <option value="3">3 tháng</option><option value="6">6 tháng</option><option value="9">9 tháng</option><option value="12">12 tháng</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Vị trí lưu kho</label>
                <input type="text" disabled={isScrapped} value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="Line 01 / QA Lab" className="w-full rounded-md border border-input p-2 text-sm bg-background disabled:bg-muted disabled:opacity-75" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Trạng thái</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })} className="w-full rounded-md border border-input p-2 text-sm bg-background">
                <option value="ACTIVE">Đang sử dụng</option><option value="INACTIVE">Tạm ngừng</option><option value="SCRAPPED">Đã hủy</option>
              </select>
            </div>
          </section>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="button-outline">Hủy</button>
            <button type="submit" className="button-primary">Lưu dữ liệu</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AuthModal({ isOpen, onClose, currentUser, setCurrentUser, showNotice }: { isOpen: boolean; onClose: () => void; currentUser: any; setCurrentUser: any; showNotice: any }) {
  const [step, setStep] = useState<'choose' | 'login' | 'register'>('choose')
  const [emailInput, setEmailInput] = useState('')
  const [otpInput, setOtpInput] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-background border border-border p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Lock className="size-4 text-primary" /> Phân quyền hệ thống</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted"><X size={18} /></button>
        </div>

        {step === 'choose' && (
          <div className="mt-4 space-y-3">

            {currentUser.role !== 'Guest' ? (
              <>
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3">
                  <p className="text-sm font-medium text-emerald-700">Đang đăng nhập với quyền {currentUser.role}</p>
                  <p className="text-xs text-emerald-600 mt-1"> {currentUser.email}</p>
                </div>

                <button
                  onClick={() => {setCurrentUser({email: 'Guest (Chỉ xem)', role: 'Guest',})
                    showNotice('Đã đăng xuất!')
                    onClose()
                  }}
                  className="w-full bg-red-600 text-white rounded-md py-2.5 hover:bg-red-700"
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Hiện tại bạn đang truy cập ở chế độ chỉ xem.
                </p>

                <button
                  onClick={() => setStep('login')}
                  className="w-full button-primary py-2.5"
                >
                  Đăng nhập
                </button>

                <button
                  onClick={() => setStep('register')}
                  className="w-full button-outline py-2.5"
                >
                  Đăng ký tài khoản mới
                </button>
              </>
            )}

          </div>
        )}

        {step === 'login' && (
          <form onSubmit={(e) => {
            e.preventDefault()

console.log({
  usernameInput,
  passwordInput,
})
            loginUser(usernameInput, passwordInput).then((user) => {
              if (user) {
                const normalizedRole = normalizeUserRole(user.role)
                if (!normalizedRole) {
                  showNotice('Tài khoản chưa được cấp quyền hợp lệ!')
                  return
                }
                setCurrentUser({ email: user.email, role: normalizedRole })
                console.log("SET CURRENT USER")
                showNotice('Đăng nhập thành công!')
                onClose()
              } else {
                showNotice('Email hoặc mật khẩu không đúng!')
              }
            })
          }} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Email công ty
              </label>
              <input
                type="email"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full rounded-md border border-input p-2 text-sm bg-background"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Mật khẩu
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full rounded-md border border-input p-2 text-sm bg-background"
              />
            </div>

            <button
              type="submit"
              className="w-full button-primary"
            >
              Đăng nhập
            </button>
          </form>
        )}

        {step === 'register' && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()

              const result = await registerUser({
                username: usernameInput,
                email: emailInput,
                password: passwordInput,
              })

              if (!result.success) {
                showNotice(result.message)
                return
              }

              showNotice(
                'Đăng ký thành công! Vui lòng đợi Admin phê duyệt.'
              )

              setStep('choose')
            }}
            className="mt-4 space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Tên người dùng
              </label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full rounded-md border border-input p-2 text-sm bg-background"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Email công ty
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full rounded-md border border-input p-2 text-sm bg-background"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Mật khẩu
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full rounded-md border border-input p-2 text-sm bg-background"
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                Mọi yêu cầu cấp quyền sẽ được gửi tới Admin:
              </p>

              <p className="mt-1 text-sm font-semibold text-primary">
                testing.spartronics@gmail.com
              </p>
            </div>

            <button
              type="submit"
              className="w-full button-primary"
            >
              Gửi yêu cầu cấp quyền
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default FixtureDashboard