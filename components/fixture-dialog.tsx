'use client';

import React, { useState } from 'react';
import { Fixture } from '@/lib/types';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fixture: Partial<Fixture>) => void;
  initialData?: Fixture | null;
}

export default function FixtureDialog({ isOpen, onClose, onSave, initialData }: Props) {
  if (!isOpen) return null;

  const [formData, setFormData] = useState({
    id: initialData?.id || '',
    description: initialData?.description || '',
    projectName: initialData?.projectName || '',
    inchargeEngineer: initialData?.inchargeEngineer || '',
    lastMaintenanceDate: initialData?.lastMaintenanceDate || new Date().toISOString().split('T')[0],
    maintenanceIntervalMonths: initialData?.maintenanceIntervalMonths || 3,
    status: initialData?.status || 'Active',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Partial<Fixture>);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-lg font-bold text-slate-800">
            {initialData ? 'Chỉnh sửa Fixture' : 'Thêm mới Fixture'}
          </h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Mã ID Fixture</label>
            <input
              type="text"
              required
              disabled={!!initialData}
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              placeholder="Vd: FX-24020"
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Tên / Description</label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Mô tả chi tiết fixture"
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Dự án (Project)</label>
              <input
                type="text"
                required
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                placeholder="Vd: Dự án Orion"
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Kỹ sư phụ trách</label>
              <input
                type="text"
                required
                value={formData.inchargeEngineer}
                onChange={(e) => setFormData({ ...formData, inchargeEngineer: e.target.value })}
                placeholder="Tên kỹ sư"
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Lần bảo trì gần nhất</label>
              <input
                type="date"
                required
                value={formData.lastMaintenanceDate}
                onChange={(e) => setFormData({ ...formData, lastMaintenanceDate: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Chu kỳ bảo trì</label>
              <select
                value={formData.maintenanceIntervalMonths}
                onChange={(e) => setFormData({ ...formData, maintenanceIntervalMonths: Number(e.target.value) })}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value={3}>3 Tháng</option>
                <option value={6}>6 Tháng</option>
                <option value={9}>9 Tháng</option>
                <option value={12}>12 Tháng</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Trạng thái</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="Active">Active (Còn hiệu lực)</option>
              <option value="Maintenance Due">Maintenance Due (Sắp/Đã đến hạn)</option>
              <option value="Inactive">Inactive (Tạm ngừng)</option>
              <option value="Scrapped">Scrapped (Hủy bỏ)</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Lưu dữ liệu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}