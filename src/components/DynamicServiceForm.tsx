'use client';

import { useState } from 'react';
import type { ServiceType, PriorityLevel } from '@/lib/types';
import { PRIORITY_LABELS } from '@/lib/types';
import { SERVICE_FIELDS } from '@/lib/utils';
import { formatPhone } from '@/lib/types';

interface DynamicServiceFormProps {
  serviceType: ServiceType;
  onSubmit: (data: {
    vehicle: string;
    priority: PriorityLevel;
    serviceData: any;
    scheduledTime: string | null;
    notes: string;
    customerName: string;
    customerPhone: string;
  }) => void;
  onCancel: () => void;
}

export default function DynamicServiceForm({
  serviceType,
  onSubmit,
  onCancel,
}: DynamicServiceFormProps) {
  const [vehicle, setVehicle] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('NORMAL');
  const [notes, setNotes] = useState('');
  const [serviceData, setServiceData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  // FIX 1C: customer info collected for ALL service types
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const fields = SERVICE_FIELDS[serviceType];
  const isAppointment = serviceType === 'APPOINTMENT';

  const handleFieldChange = (name: string, value: any) => {
    setServiceData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!vehicle.trim()) {
      newErrors.vehicle = 'Vehicle is required';
    }

    // FIX 1C: validate customer info for ALL types
    if (!customerName.trim()) {
      newErrors.customerName = 'Customer name is required';
    }
    if (!customerPhone.trim()) {
      newErrors.customerPhone = 'Phone number is required';
    } else {
      const cleaned = customerPhone.replace(/\D/g, '');
      if (cleaned.length !== 10) {
        newErrors.customerPhone = 'Enter 10-digit phone number';
      }
    }

    fields.forEach((field) => {
      if (field.required && !serviceData[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      }
      if (field.validation && serviceData[field.name]) {
        if (!field.validation(serviceData[field.name])) {
          newErrors[field.name] = field.errorMessage || 'Invalid value';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const formattedPhone = formatPhone(customerPhone);

    // FIX 1B: Build scheduled_time from date + time for appointments
    let scheduledTime = null;
    if (isAppointment && serviceData.scheduled_date && serviceData.scheduled_time) {
      scheduledTime = `${serviceData.scheduled_date}T${serviceData.scheduled_time}:00`;
    }

    onSubmit({
      vehicle,
      // FIX 1B: Appointments don't have user-selectable priority; default NORMAL
      priority: isAppointment ? 'NORMAL' : priority,
      serviceData,
      scheduledTime,
      notes,
      customerName: customerName.trim(),
      customerPhone: formattedPhone,
    });
  };

  const renderField = (field: (typeof fields)[0]) => {
    const value = serviceData[field.name] || '';
    const hasError = !!errors[field.name];

    switch (field.type) {
      case 'text':
      case 'tel':
      case 'time':
      case 'date':
      case 'datetime-local':
        return (
          <div key={field.name}>
            <label className="label">{field.label}</label>
            <input
              type={field.type}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={`input ${hasError ? 'input-error' : ''}`}
              placeholder={field.placeholder}
            />
            {hasError && <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>}
          </div>
        );

      case 'number':
        return (
          <div key={field.name}>
            <label className="label">{field.label}</label>
            <input
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(field.name, parseInt(e.target.value))}
              className={`input ${hasError ? 'input-error' : ''}`}
              min={field.min}
              max={field.max}
            />
            {hasError && <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.name}>
            <label className="label">{field.label}</label>
            <select
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={`input ${hasError ? 'input-error' : ''}`}
            >
              <option value="">Select...</option>
              {field.options?.map((opt) => {
                const optValue = typeof opt === 'string' ? opt : opt.value;
                const optLabel = typeof opt === 'string' ? opt : opt.label;
                return (
                  <option key={optValue} value={optValue}>
                    {optLabel}
                  </option>
                );
              })}
            </select>
            {hasError && <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>}
          </div>
        );

      case 'radio':
        return (
          <div key={field.name}>
            <label className="label">{field.label}</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {field.options?.map((opt) => {
                const optValue = typeof opt === 'string' ? opt : opt.value;
                const optLabel = typeof opt === 'string' ? opt : opt.label;
                return (
                  <button
                    key={optValue}
                    type="button"
                    onClick={() => handleFieldChange(field.name, optValue)}
                    className={`py-3 px-4 rounded-lg border-2 font-semibold transition-all ${
                      value === optValue
                        ? 'bg-sky-500 border-sky-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {optLabel}
                  </button>
                );
              })}
            </div>
            {hasError && <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.name}>
            <label className="label">{field.label}</label>
            <textarea
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={`input min-h-[80px] ${hasError ? 'input-error' : ''}`}
              placeholder={field.placeholder}
            />
            {hasError && <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── FIX 1C: Customer Info (all service types) ── */}
      <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 space-y-4">
        <h3 className="font-semibold text-sky-800">Customer Information</h3>
        <div>
          <label className="label">Customer Name *</label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
              if (errors.customerName) setErrors((prev) => ({ ...prev, customerName: '' }));
            }}
            className={`input ${errors.customerName ? 'input-error' : ''}`}
            placeholder="John Smith"
            maxLength={100}
          />
          {errors.customerName && <p className="mt-1 text-sm text-red-600">{errors.customerName}</p>}
        </div>
        <div>
          <label className="label">Phone Number *</label>
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => {
              setCustomerPhone(e.target.value);
              if (errors.customerPhone) setErrors((prev) => ({ ...prev, customerPhone: '' }));
            }}
            className={`input ${errors.customerPhone ? 'input-error' : ''}`}
            placeholder="423-555-1234"
            maxLength={14}
          />
          {errors.customerPhone && <p className="mt-1 text-sm text-red-600">{errors.customerPhone}</p>}
        </div>
      </div>

      {/* Vehicle */}
      <div>
        <label className="label">Vehicle *</label>
        <input
          type="text"
          value={vehicle}
          onChange={(e) => {
            setVehicle(e.target.value);
            if (errors.vehicle) setErrors((prev) => ({ ...prev, vehicle: '' }));
          }}
          className={`input ${errors.vehicle ? 'input-error' : ''}`}
          placeholder="2019 Honda Civic - Blue"
          maxLength={100}
        />
        {errors.vehicle && <p className="mt-1 text-sm text-red-600">{errors.vehicle}</p>}
      </div>

      {/* Service-Specific Fields */}
      {fields.map((field) => renderField(field))}

      {/* Notes */}
      <div>
        <label className="label">Notes (Optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input min-h-[80px]"
          placeholder="Additional instructions or information..."
        />
      </div>

      {/* ── FIX 1B: Priority hidden for Appointments ── */}
      {!isAppointment && (
        <div>
          <label className="label">Priority</label>
          <div className="grid grid-cols-3 gap-3">
            {(['LOW', 'NORMAL', 'HIGH'] as PriorityLevel[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`py-3 px-4 rounded-lg border-2 font-semibold transition-all ${
                  priority === p
                    ? p === 'HIGH'
                      ? 'bg-red-600 border-red-700 text-white'
                      : p === 'NORMAL'
                      ? 'bg-sky-500 border-sky-600 text-white'
                      : 'bg-blue-500 border-blue-600 text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 pt-4">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          Cancel
        </button>
        <button type="submit" className="btn-primary flex-1">
          Create Ticket
        </button>
      </div>
    </form>
  );
}
