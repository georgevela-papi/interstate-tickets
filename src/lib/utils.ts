// Utility functions for service forms and validation
// Updated: Fix pass

import type { ServiceFieldConfig } from './types';
import { validateTireSize, validatePhone } from './types';

// Hardcoded field definitions for legacy service types.
// New services added via Command Center use service_fields table instead.
// customer_name and customer_phone are collected globally
// on ALL service types (handled in DynamicServiceForm).
export const SERVICE_FIELDS: Record<string, ServiceFieldConfig[]> = {
  MOUNT_BALANCE: [
    {
      name: 'tire_count',
      label: 'Number of Tires',
      type: 'radio',
      required: true,
      options: ['1', '2', '3', '4'],
    },
  ],
  FLAT_REPAIR: [
    {
      name: 'tire_position',
      label: 'Which Tire?',
      type: 'radio',
      required: true,
      options: [
        { value: 'FL', label: 'Front Left' },
        { value: 'FR', label: 'Front Right' },
        { value: 'RL', label: 'Rear Left' },
        { value: 'RR', label: 'Rear Right' },
      ],
    },
  ],
  ROTATION: [
    {
      name: 'pattern',
      label: 'Rotation Pattern (Optional)',
      type: 'select',
      required: false,
      options: [
        { value: 'Forward', label: 'Forward Cross' },
        { value: 'X', label: 'X-Pattern' },
        { value: 'Rearward', label: 'Rearward Cross' },
      ],
    },
  ],
  NEW_TIRES: [
    {
      name: 'tire_size',
      label: 'Tire Size',
      type: 'text',
      required: true,
      placeholder: '225/65R17',
      validation: validateTireSize,
      errorMessage: 'Format: 225/65R17',
    },
    {
      name: 'quantity',
      label: 'Quantity',
      type: 'radio',
      required: true,
      options: ['1', '2', '3', '4'],
    },
    {
      name: 'brand',
      label: 'Brand (Optional)',
      type: 'text',
      required: false,
      placeholder: 'Michelin, Goodyear, etc.',
    },
  ],
  USED_TIRES: [
    {
      name: 'tire_size',
      label: 'Tire Size',
      type: 'text',
      required: true,
      placeholder: '225/65R17',
      validation: validateTireSize,
      errorMessage: 'Format: 225/65R17',
    },
    {
      name: 'quantity',
      label: 'Quantity',
      type: 'radio',
      required: true,
      options: ['1', '2', '3', '4'],
    },
  ],
  DETAILING: [
    {
      name: 'service_level',
      label: 'Service Level',
      type: 'radio',
      required: true,
      options: [
        { value: 'Basic', label: 'Basic Detail' },
        { value: 'Full', label: 'Full Detail' },
      ],
    },
  ],
  APPOINTMENT: [
    {
      name: 'appointment_service',
      label: 'Service Being Scheduled',
      type: 'select',
      required: true,
      options: [
        { value: '', label: 'Select a service...' },
        { value: 'MOUNT_BALANCE', label: 'Mount/Balance' },
        { value: 'FLAT_REPAIR', label: 'Flat Repair' },
        { value: 'ROTATION', label: 'Rotation' },
        { value: 'NEW_TIRES', label: 'New Tires' },
        { value: 'USED_TIRES', label: 'Used Tires' },
        { value: 'DETAILING', label: 'Detailing' },
        { value: 'MAINTENANCE', label: 'Maintenance' },
      ],
    },
    {
      name: 'scheduled_date',
      label: 'Appointment Date',
      type: 'date',
      required: true,
    },
    {
      name: 'scheduled_time',
      label: 'Appointment Time',
      type: 'time',
      required: true,
    },
  ],
  MAINTENANCE: [
    {
      name: 'maintenance_type',
      label: 'Type of Maintenance',
      type: 'select',
      required: true,
      options: [
        { value: 'Oil Change', label: 'Oil Change' },
        { value: 'Brake Service', label: 'Brake Service' },
        { value: 'Rotor Replacement', label: 'Rotor Replacement' },
        { value: 'Alignment', label: 'Alignment' },
        { value: 'Inspection', label: 'Inspection' },
        { value: 'Battery', label: 'Battery' },
        { value: 'Wiper Blades', label: 'Wiper Blades' },
        { value: 'General Repair', label: 'General Repair' },
        { value: 'Other', label: 'Other' },
      ],
    },
    {
      name: 'description',
      label: 'Description (Optional)',
      type: 'textarea',
      required: false,
      placeholder: 'Describe the maintenance needed...',
    },
  ],
};

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function getTimeElapsed(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function getServiceDataText(serviceType: string, data: any): string {
  if (!data) return '';

  switch (serviceType) {
    case 'MOUNT_BALANCE':
      return `${data.tire_count || '?'} tire(s)`;
    case 'FLAT_REPAIR': {
      const pos: Record<string, string> = { FL: 'Front Left', FR: 'Front Right', RL: 'Rear Left', RR: 'Rear Right' };
      return pos[data.tire_position] || data.tire_position || '';
    }
    case 'ROTATION':
      return data.pattern ? `${data.pattern} pattern` : 'Standard rotation';
    case 'NEW_TIRES':
    case 'USED_TIRES':
      return `${data.tire_size || '?'} × ${data.quantity || '?'}${data.brand ? ` (${data.brand})` : ''}`;
    case 'DETAILING':
      return `${data.service_level || ''} Detail`;
    case 'MAINTENANCE':
      return data.maintenance_type || data.description || 'General maintenance';
    case 'APPOINTMENT':
      return `${data.customer_name || ''} - ${data.phone || ''}`;
    default: {
      // Dynamic services: summarize the JSONB service_data keys
      const entries = Object.entries(data).filter(([, v]) => v != null && v !== '');
      if (entries.length === 0) return '';
      return entries.map(([, v]) => String(v)).join(' · ');
    }
  }
}

// Check if appointment should be visible in queue
export function shouldShowAppointment(scheduledTime: string | null): boolean {
  if (!scheduledTime) return true;
  return new Date(scheduledTime) <= new Date();
}

// Generate ID code suggestions for new staff
export function suggestIdCode(role: 'SERVICE_WRITER' | 'TECHNICIAN' | 'MANAGER'): string {
  const prefix = {
    SERVICE_WRITER: 'SW',
    TECHNICIAN: 'T',
    MANAGER: 'M',
  }[role];

  const num = String(Math.floor(Math.random() * 90) + 10);
  return `${prefix}${num}`;
}

// Normalize phone number to digits only for storage/matching
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}
