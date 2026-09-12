'use client'

import { useEffect, useMemo, useState } from 'react'
import { createAuditLog, createProjectDevice, syncDeviceProjects } from '@/app/actions'
import { Boxes, CheckCircle2, Download, FolderKanban, MoreHorizontal, Plus, Search, X } from 'lucide-react'

type Device = {
  id: string
  code: string
  name: string
  customerName: string | null
  serialNumber: string | null
  assetType: string
  category: string
  fgCode: string | null
  quantity: number
  availableQuantity: number
  status: string
  location: string | null
  notes: string | null
}

type Project = {
  id: string
  code: string
  name: string
  description: string
  deviceIds: string[]
}

type DeviceAuditLog = {
  id: string
  timestamp: string
  user: string
  action: string
  fixtureId: string
  details: string
}

const catalogOptions = [
  'Digital Multimeter', 'Power Supply', 'VOM', 'Computer', 'Monitor', 'Mouse',
  'Keyboard', 'TestPlug', 'Oscilloscope', 'Fixture', 'Other',
]

const normalizeSearchText = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim()

export default function DeviceManager({ initialData, auditLogs, currentUserEmail, currentUserRole, onOpenFixtureForm }: { initialData: { projects: Project[]; devices: Device[] }; auditLogs: DeviceAuditLog[]; currentUserEmail: string; currentUserRole: 'Guest' | 'Admin' | 'ENG' | 'TECH'; onOpenFixtureForm: () => void }) {
  const [projects, setProjects] = useState(initialData.projects)
  const [devices, setDevices] = useState(initialData.devices)
  const [selectedProject, setSelectedProject] = useState('')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [notice, setNotice] = useState('')
  const [activeTab, setActiveTab] = useState<'list' | 'project'>('list')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ device: Device; x: number; y: number } | null>(null)
  const [deviceLogs, setDeviceLogs] = useState(auditLogs)
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null)
  const [historyDevice, setHistoryDevice] = useState<Device | null>(null)

  useEffect(() => {
    if (currentUserRole === 'Guest') setHistoryDevice(null)
  }, [currentUserRole])
  const [form, setForm] = useState({
    projectCodes: [''], deviceCode: '', deviceName: '', customerName: '', serialNumber: '', assetType: 'DEVICE', category: 'Digital Multimeter',
    customCategory: '', fgCode: '', quantity: 1, availableQuantity: 1, location: '', notes: '',
  })

  const deviceProjects = useMemo(() => {
    return new Map(devices.map((device) => [
      device.id,
      projects.filter((project) => project.deviceIds.includes(device.id)),
    ]))
  }, [devices, projects])

  const visibleDevices = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query)
    return devices.filter((device) => {
      const projectText = (deviceProjects.get(device.id) ?? []).map((project) => `${project.code} ${project.name}`).join(' ')
      const searchText = normalizeSearchText([
        device.code,
        device.name,
        device.category,
        device.fgCode,
        device.location,
        projectText,
      ].join(' '))
      const matchesQuery = searchText.includes(normalizedQuery)
      const matchesProject = projectFilter === 'all' || (deviceProjects.get(device.id) ?? []).some((project) => project.id === projectFilter)
      const matchesStatus = statusFilter === 'all' || device.status === statusFilter
      const matchesCustomer = customerFilter === 'all' || (device.customerName || '') === customerFilter
      const matchesLocation = locationFilter === 'all' || (device.location || '') === locationFilter
      return matchesQuery && (categoryFilter === 'all' || device.category === categoryFilter) && matchesProject && matchesStatus && matchesCustomer && matchesLocation
    })
  }, [devices, deviceProjects, query, categoryFilter, projectFilter, statusFilter, customerFilter, locationFilter])

  const categories = useMemo(() => Array.from(new Set([
    ...catalogOptions,
    ...devices.map((device) => device.category).filter(Boolean),
  ])).sort(), [devices])

  const customers = useMemo(() => Array.from(new Set(devices.map((device) => device.customerName).filter((value): value is string => Boolean(value)))).sort(), [devices])
  const locations = useMemo(() => Array.from(new Set(devices.map((device) => device.location).filter((value): value is string => Boolean(value)))).sort(), [devices])

  const hasActiveFilters = query || categoryFilter !== 'all' || projectFilter !== 'all' || statusFilter !== 'all' || customerFilter !== 'all' || locationFilter !== 'all'
  const extraFilterCount = Number(customerFilter !== 'all') + Number(locationFilter !== 'all')
  const clearFilters = () => {
    setQuery('')
    setCategoryFilter('all')
    setProjectFilter('all')
    setStatusFilter('all')
    setCustomerFilter('all')
    setLocationFilter('all')
  }

  const exportDevices = () => {
    if (visibleDevices.length === 0) {
      setNotice('Không có device phù hợp để xuất')
      return
    }

    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const rows = visibleDevices.map((device) => [
      device.code,
      device.category,
      (deviceProjects.get(device.id) ?? []).map((project) => project.code).join('; '),
      device.quantity,
      device.location || '',
      device.status,
    ].map(escapeCsv).join(','))
    const csv = '\uFEFF' + [
      ['ID thiết bị', 'Catalog', 'Mã FG dự án', 'Số lượng', 'Vị trí lưu', 'Trạng thái'].map(escapeCsv).join(','),
      ...rows,
    ].join('\n')
    const link = document.createElement('a')
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
    link.download = `Danh_sach_device_${categoryFilter === 'all' ? 'tat-ca' : categoryFilter}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setNotice(`Đã xuất ${visibleDevices.length} device`)
  }

  const projectDevices = useMemo(() => {
    const project = projects.find((item) => item.id === selectedProject)
    return devices.filter((device) => project?.deviceIds.includes(device.id))
  }, [devices, projects, selectedProject])

  const openEditDevice = (device: Device) => {
    const linkedProjects = deviceProjects.get(device.id) ?? []
    const isCustomCategory = !catalogOptions.includes(device.category)
    setForm({
      projectCodes: linkedProjects.length > 0 ? linkedProjects.map((project) => project.code) : [''],
      deviceCode: device.code,
      deviceName: device.name,
      customerName: device.customerName || '',
      serialNumber: device.serialNumber || '',
      assetType: device.assetType,
      category: isCustomCategory ? '__custom__' : device.category,
      customCategory: isCustomCategory ? device.category : '',
      fgCode: device.fgCode || '',
      quantity: device.quantity,
      availableQuantity: device.availableQuantity,
      location: device.location || '',
      notes: device.notes || '',
    })
    setEditingDeviceId(device.id)
    setIsFormOpen(true)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (currentUserRole === 'Guest') {
      setNotice('Vui lòng đăng nhập để thêm hoặc chỉnh sửa device')
      return
    }
    if (form.category === 'Fixture') {
      setIsFormOpen(false)
      onOpenFixtureForm()
      return
    }
    const deviceCategory = form.category === '__custom__' ? form.customCategory.trim() : form.category.trim()
    if (!deviceCategory) {
      setNotice('Vui lòng nhập tên catalog mới')
      return
    }
    const isEditing = Boolean(editingDeviceId)
    const projectCodes = form.projectCodes.map((code) => code.trim()).filter(Boolean)
    if (projectCodes.length === 0) {
      setNotice('Vui lòng nhập ít nhất một mã FG của dự án')
      return
    }
    const results = await Promise.all(projectCodes.map((projectCode) => createProjectDevice({
      project: { code: projectCode, name: projectCode },
      device: {
        code: form.deviceCode.trim(),
        name: form.deviceCode.trim(),
        customerName: form.customerName.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
        assetType: form.assetType,
        category: deviceCategory,
        fgCode: undefined, quantity: Number(form.quantity),
        availableQuantity: Number(form.quantity), location: form.location.trim() || undefined,
        notes: undefined,
      },
    })))
    const failedResult = results.find((result) => !result.success)
    if (failedResult) {
      setNotice(failedResult.message ?? 'Không thể lưu dữ liệu')
      return
    }
    const savedProjects = results
      .map((result) => result.project)
      .filter((project): project is Project => Boolean(project))
    const savedDevice = results[0].device
    if (!savedDevice || savedProjects.length !== projectCodes.length) {
      setNotice('Đã lưu. Hãy tải lại trang để xem dữ liệu mới.')
      setIsFormOpen(false)
      return
    }
    if (isEditing) {
      const syncResult = await syncDeviceProjects(savedDevice.id, projectCodes)
      if (!syncResult.success) {
        setNotice(syncResult.message ?? 'Không thể đồng bộ project của device')
        return
      }
    }
    const existingDevice = editingDeviceId ? devices.find((device) => device.id === editingDeviceId) : undefined
    const previousProjects = existingDevice ? (deviceProjects.get(existingDevice.id) ?? []).map((project) => project.code) : []
    const changes: string[] = []
    if (existingDevice) {
      if (existingDevice.customerName !== (form.customerName.trim() || null)) changes.push(`Khách hàng ${existingDevice.customerName || '-'} to ${form.customerName.trim() || '-'}`)
      if (existingDevice.serialNumber !== (form.serialNumber.trim() || null)) changes.push(`Serial ${existingDevice.serialNumber || '-'} to ${form.serialNumber.trim() || '-'}`)
      if (existingDevice.category !== deviceCategory) changes.push(`Catalog ${existingDevice.category} to ${deviceCategory}`)
      if (existingDevice.quantity !== Number(form.quantity)) changes.push(`Số lượng ${existingDevice.quantity} to ${Number(form.quantity)}`)
      if ((existingDevice.location || '') !== form.location.trim()) changes.push(`Vị trí ${existingDevice.location || '-'} to ${form.location.trim() || '-'}`)
      if (previousProjects.join(', ') !== projectCodes.join(', ')) changes.push(`Project sử dụng ${previousProjects.join(', ') || '-'} to ${projectCodes.join(', ') || '-'}`)
    }
    const auditAction = isEditing ? 'UPDATE' : 'CREATE'
    const auditDetails = isEditing
      ? (changes.length > 0 ? changes.join('; ') : `Cập nhật device ${form.deviceCode.trim()} nhưng không thay đổi dữ liệu`)
      : `Tạo mới device ${form.deviceCode.trim()} (${deviceCategory}) với project: ${projectCodes.join(', ')}`
    const auditResult = await createAuditLog({
      user: currentUserEmail,
      action: auditAction,
      fixtureId: form.deviceCode.trim(),
      details: auditDetails,
      ipAddress: '192.168.1.102',
    })
    if (auditResult.success) {
      setDeviceLogs((items) => [{ id: `LOCAL-${Date.now()}`, timestamp: new Date().toLocaleString('vi-VN'), user: currentUserEmail, action: auditAction, fixtureId: form.deviceCode.trim(), details: auditDetails }, ...items])
    }
    setProjects((items) => {
      const savedProjectMap = new Map(savedProjects.map((project) => [project!.id, project!]))
      return items
        .map((item) => savedProjectMap.get(item.id) ?? item)
        .concat(savedProjects.filter((project) => !items.some((item) => item.id === project!.id)))
    })
    setDevices((items) => {
      const exists = items.some((item) => item.id === savedDevice.id)
      return exists ? items.map((item) => item.id === savedDevice.id ? savedDevice : item) : [...items, savedDevice]
    })
    setSelectedProject(savedProjects[0].id)
    setActiveTab('project')
    setNotice('Đã lưu và liên kết device vào dự án')
    setIsFormOpen(false)
    setEditingDeviceId(null)
    setQuery('')
  }

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">PROJECT ASSET REGISTER</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Dự án & device</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Tra cứu thiết bị, fixture test và các dự án đang sử dụng chúng.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Boxes className="size-4 text-primary" />{projects.length} dự án / {devices.length} device</div>
            {currentUserRole !== 'Guest' && <button className="button-primary" onClick={() => setIsFormOpen(true)}><Plus className="size-4" />Thêm mới</button>}
          </div>
        </div>

        <div className="mb-4 flex items-center gap-1 border-b border-border">
          <button className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === 'list' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`} onClick={() => setActiveTab('list')}>Danh sách device</button>
          <button className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === 'project' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`} onClick={() => setActiveTab('project')}>Theo mã FG / project</button>
        </div>

        {activeTab === 'list' && <div className="panel overflow-hidden">
          <div className="space-y-3 border-b border-border p-4">
            <div className="search-box"><Search className="size-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã device, tên, FG hoặc project..." /></div>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Lọc theo catalog" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="min-w-36 rounded-md border bg-transparent p-2 text-sm text-foreground">
                <option value="all">Tất cả catalog</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <select aria-label="Lọc theo project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="min-w-36 rounded-md border bg-transparent p-2 text-sm text-foreground">
                <option value="all">Tất cả project / FG</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.code}</option>)}
              </select>
              <select aria-label="Lọc theo trạng thái" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-32 rounded-md border bg-transparent p-2 text-sm text-foreground">
                <option value="all">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang dùng</option>
                <option value="INACTIVE">Tạm ngừng</option>
                <option value="SCRAPPED">Đã hủy</option>
              </select>
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:border-primary">
                  Bộ lọc khác{extraFilterCount > 0 && <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">{extraFilterCount}</span>}
                </summary>
                <div className="absolute left-0 top-11 z-10 grid w-64 gap-2 rounded-lg border border-border bg-card p-3 shadow-xl">
                  <label className="text-xs font-medium text-muted-foreground">Khách hàng
                    <select aria-label="Lọc theo khách hàng" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} className="mt-1 w-full rounded-md border bg-transparent p-2 text-sm text-foreground">
                      <option value="all">Tất cả khách hàng</option>
                      {customers.map((customer) => <option key={customer} value={customer}>{customer}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">Vị trí lưu
                    <select aria-label="Lọc theo vị trí" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="mt-1 w-full rounded-md border bg-transparent p-2 text-sm text-foreground">
                      <option value="all">Tất cả vị trí</option>
                      {locations.map((location) => <option key={location} value={location}>{location}</option>)}
                    </select>
                  </label>
                </div>
              </details>
              {hasActiveFilters && <button className="button-ghost" onClick={clearFilters}>Xóa bộ lọc</button>}
              <button className="button-outline md:ml-auto" onClick={exportDevices}><Download className="size-4" />Xuất Excel</button>
            </div>
            <span className="text-xs text-muted-foreground">Đang hiển thị {visibleDevices.length}/{devices.length} device · Chuột phải vào một dòng để xem project đang dùng</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[1080px]"><thead><tr><th>ID</th><th>Khách hàng</th><th>Tên / catalog</th><th>Project sử dụng</th><th>Số lượng</th><th>Vị trí lưu</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>{visibleDevices.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">Chưa có device. Bấm “Thêm mới” để bắt đầu.</td></tr>}
                {visibleDevices.map((device) => <tr key={device.id} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ device, x: event.clientX, y: event.clientY }) }}>
                  <td><span className="font-mono text-sm font-bold text-primary">{device.code}</span></td>
                  <td className="max-w-[180px] text-sm text-muted-foreground">{device.customerName || '-'}</td>
                  <td><p className="font-medium">{device.category}</p></td>
                  <td><div className="flex max-w-[260px] flex-wrap gap-1">{(deviceProjects.get(device.id) ?? []).map((project) => <span key={project.id} className="rounded-full bg-muted px-2 py-1 font-mono text-[10px]">{project.code}</span>)}{(deviceProjects.get(device.id) ?? []).length === 0 && <span className="text-xs text-muted-foreground">Chưa liên kết</span>}</div></td>
                  <td><span className="font-semibold">{device.availableQuantity}</span><span className="text-muted-foreground"> / {device.quantity}</span></td>
                  <td className="text-sm text-muted-foreground">{device.location || '-'}</td>
                  <td><span className="status-badge status-valid"><CheckCircle2 className="size-3" />{device.status === 'ACTIVE' ? 'Đang dùng' : device.status}</span></td>
                  <td><button className="icon-button subtle" aria-label="Xem project đang dùng" onClick={() => setContextMenu({ device, x: 0, y: 0 })}><MoreHorizontal className="size-4" /></button></td>
                </tr>)}
              </tbody></table>
          </div>
        </div>}

        {activeTab === 'project' && <div className="panel overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mã FG / project</p>
                <p className="mt-1 text-sm text-muted-foreground">Chọn một ô mã để xem các device được liên kết.</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{projects.length} mã</span>
            </div>
            {projects.length === 0 ? <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Chưa có mã FG / project. Bấm “Thêm mới” để bắt đầu.</p> : <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((project) => {
                const deviceCount = project.deviceIds.length
                const isSelected = selectedProject === project.id
                return <button key={project.id} type="button" onClick={() => setSelectedProject(project.id)} className={`group min-h-28 rounded-lg border p-4 text-left transition ${isSelected ? 'border-primary bg-accent-panel shadow-sm' : 'border-border bg-card hover:border-primary/60 hover:bg-muted/40'}`}>
                  <div className="flex items-start justify-between gap-3"><span className={`flex size-9 shrink-0 items-center justify-center rounded-md ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-primary'}`}><FolderKanban className="size-4" /></span><span className="rounded-full bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">{deviceCount} device</span></div>
                  <p className="mt-3 truncate font-mono text-sm font-bold text-primary">{project.code}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{project.name}</p>
                </button>
              })}
            </div>}
          </div>
          {selectedProject ? <div className="overflow-x-auto"><table className="data-table min-w-[1050px]"><thead><tr><th>ID</th><th>Serial number</th><th>Khách hàng</th><th>Tên / catalog</th><th>Số lượng</th><th>Vị trí lưu</th><th>Ghi chú</th></tr></thead><tbody>{projectDevices.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Project này chưa có device hoặc fixture test.</td></tr> : projectDevices.map((device) => <tr key={device.id} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ device, x: event.clientX, y: event.clientY }) }}><td className="font-mono text-sm font-bold text-primary">{device.code}</td><td className="font-mono text-sm text-muted-foreground">{device.serialNumber || '-'}</td><td className="text-sm text-muted-foreground">{device.customerName || '-'}</td><td><p className="font-medium">{device.category}</p></td><td><span className="font-semibold">{device.availableQuantity}</span> / {device.quantity}</td><td className="text-sm text-muted-foreground">{device.location || '-'}</td><td className="text-sm text-muted-foreground">{device.notes || '-'}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-muted-foreground">Chọn một project để xem danh sách.</p>}
        </div>}

        {isFormOpen && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onMouseDown={() => setIsFormOpen(false)}><div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><div><p className="eyebrow">NEW ASSET LINK</p><h3 className="mt-1 text-lg font-semibold">Thêm device vào project</h3></div><button className="icon-button subtle" onClick={() => setIsFormOpen(false)} aria-label="Đóng"><X className="size-5" /></button></div>
              <form onSubmit={save} className="space-y-6">
                <div>
                  <div className="mb-3 border-b border-border pb-2"><p className="text-sm font-semibold">Thông tin device</p><p className="mt-1 text-xs text-muted-foreground">Nhập thông tin nhận diện và catalog của thiết bị.</p></div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-xs font-medium text-muted-foreground">ID thiết bị
                      <input required value={form.deviceCode} onChange={(e) => setForm({ ...form, deviceCode: e.target.value })} placeholder="Ví dụ: DI-001" className="mt-1 w-full rounded-md border bg-transparent p-2 text-sm text-foreground" />
                    </label>
                    <label className="text-xs font-medium text-muted-foreground">Tên khách hàng
                      <input required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Ví dụ: Samsung Electronics" className="mt-1 w-full rounded-md border bg-transparent p-2 text-sm text-foreground" />
                    </label>
                    <label className="text-xs font-medium text-muted-foreground">Catalog thiết bị
                      <select required value={form.category} onChange={(e) => {
                        const category = e.target.value
                        if (category === 'Fixture') {
                          setIsFormOpen(false)
                          onOpenFixtureForm()
                          return
                        }
                        setForm({ ...form, category })
                      }} className="mt-1 w-full rounded-md border bg-transparent p-2 text-sm text-foreground">
                        <option>Digital Multimeter</option><option>Power Supply</option><option>VOM</option><option>Computer</option><option>Monitor</option><option>Mouse</option><option>Keyboard</option><option>TestPlug</option><option>Oscilloscope</option><option>Fixture</option><option>Other</option><option value="__custom__">+ Thêm catalog mới...</option>
                      </select>
                    </label>
                    {form.category === '__custom__' && <label className="text-xs font-medium text-muted-foreground">Tên catalog mới
                      <input required autoFocus value={form.customCategory} onChange={(e) => setForm({ ...form, customCategory: e.target.value })} placeholder="Ví dụ: Thermal Camera" className="mt-1 w-full rounded-md border bg-transparent p-2 text-sm text-foreground" />
                    </label>}
                    {form.category !== 'Fixture' && <label className="text-xs font-medium text-muted-foreground">Serial number
                      <input required value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="Ví dụ: SN-2026-001" className="mt-1 w-full rounded-md border bg-transparent p-2 text-sm text-foreground" />
                    </label>}
                  </div>
                </div>
                <div>
                  <div className="mb-3 border-b border-border pb-2"><p className="text-sm font-semibold">Liên kết project</p><p className="mt-1 text-xs text-muted-foreground">Một device có thể dùng cho nhiều mã FG/project.</p></div>
                  <div className="space-y-2">
                    {form.projectCodes.map((projectCode, index) => <div key={index} className="flex items-center gap-2">
                      <input required={index === 0} value={projectCode} onChange={(e) => setForm({ ...form, projectCodes: form.projectCodes.map((item, itemIndex) => itemIndex === index ? e.target.value : item) })} placeholder="Ví dụ: FG-4587" className="w-full rounded-md border bg-transparent p-2 text-sm text-foreground" />
                      {index === form.projectCodes.length - 1 && <button type="button" onClick={() => setForm({ ...form, projectCodes: [...form.projectCodes, ''] })} className="icon-button subtle shrink-0" aria-label="Thêm dự án"><Plus className="size-4" /></button>}
                      {form.projectCodes.length > 1 && <button type="button" onClick={() => setForm({ ...form, projectCodes: form.projectCodes.filter((_, itemIndex) => itemIndex !== index) })} className="icon-button subtle shrink-0" aria-label="Xóa dự án"><X className="size-4" /></button>}
                    </div>)}
                  </div>
                </div>
                <div>
                  <div className="mb-3 border-b border-border pb-2"><p className="text-sm font-semibold">Thông tin lưu kho</p><p className="mt-1 text-xs text-muted-foreground">Số lượng và vị trí hiện tại của thiết bị.</p></div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-xs font-medium text-muted-foreground">Số lượng
                      <input type="number" min="1" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="mt-1 w-full rounded-md border bg-transparent p-2 text-sm text-foreground" />
                    </label>
                    <label className="text-xs font-medium text-muted-foreground">Vị trí lưu
                      <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ví dụ: Kho A / Kệ B2" className="mt-1 w-full rounded-md border bg-transparent p-2 text-sm text-foreground" />
                    </label>
                  </div>
                </div>
                <button className="button-primary w-full justify-center" type="submit"><Plus className="size-4" />Lưu và liên kết</button>
              </form>
              {notice && <p className="mt-3 text-sm text-primary">{notice}</p>}
            </div></div>}

        {contextMenu && <div className="fixed z-50 w-64 rounded-lg border border-border bg-card p-4 shadow-2xl" style={{ left: contextMenu.x || '50%', top: contextMenu.y || '50%', transform: contextMenu.x ? undefined : 'translate(-50%, -50%)' }} onMouseLeave={() => setContextMenu(null)}><div className="mb-3 border-b border-border pb-3"><p className="font-mono text-sm font-bold text-primary">{contextMenu.device.code}</p><p className="text-sm font-medium">{contextMenu.device.name}</p></div>{currentUserRole !== 'Guest' && <><button className="mb-2 w-full rounded-md border border-primary/30 bg-primary/5 p-2 text-left text-xs font-semibold text-primary hover:bg-accent-panel" onClick={() => { setContextMenu(null); openEditDevice(contextMenu.device) }}>Chỉnh sửa device</button><button className="w-full rounded-md border border-border bg-muted/40 p-2 text-left text-xs font-semibold hover:border-primary hover:text-primary" onClick={() => { setHistoryDevice(contextMenu.device); setContextMenu(null) }}>History change ({deviceLogs.filter((log) => log.fixtureId === contextMenu.device.code).length})</button></>}</div>}
        {currentUserRole !== 'Guest' && historyDevice && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={() => setHistoryDevice(null)}><div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="mb-4 flex items-start justify-between border-b border-border pb-4"><div><p className="eyebrow">HISTORY CHANGE</p><h3 className="mt-1 text-lg font-semibold">{historyDevice.code}</h3><p className="text-sm text-muted-foreground">{historyDevice.name}</p></div><button className="icon-button subtle" onClick={() => setHistoryDevice(null)} aria-label="Đóng"><X className="size-5" /></button></div><div className="max-h-80 space-y-3 overflow-y-auto">{deviceLogs.filter((log) => log.fixtureId === historyDevice.code).length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Chưa có lịch sử thay đổi.</p> : deviceLogs.filter((log) => log.fixtureId === historyDevice.code).map((log) => <div key={log.id} className="rounded-lg border border-border bg-muted/30 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-primary">{log.action === 'CREATE' ? 'Tạo mới' : 'Change'}</span><span className="text-xs text-muted-foreground">{log.timestamp}</span></div><p className="mt-1 text-xs text-muted-foreground">{log.user}</p><p className="mt-2 leading-5">{log.details}</p></div>)}</div></div></div>}
      </div>
    </section>
  )
}
