// Utility functions for service forms and validation

import type { ServiceType, ServiceFieldConfig } from './types';
import { validateTireSize, validatePhone } from './types';

// Service field definitions for each service type
export const SERVICE_FIELDS: Record<ServiceType, ServiceFieldConfig[]> = {
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
      label: 'Tire Position',
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
        { value: '', label: 'Standard' },
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
      pattern: '^\\d{3}\\/\\d{2}[R\\/]\\d{2}$',
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
      pattern: '^\\d{3}\\/\\d{2}[R\\/]\\d{2}$',
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
      name: 'customer_name',
      label: 'Customer Name',
      type: 'text',
      required: true,
      placeholder: 'John Smith',
    },
    {
      name: 'phone',
      label: 'Phone Number',
      type: 'tel',
      required: true,
      placeholder: '423-555-1234',
      validation: validatePhone,
      errorMessage: 'Enter 10-digit phone number',
    },
    {
      name: 'scheduled_time',
      label: 'Scheduled Time',
      type: 'time',
      required: true,
    },
  ],
};

// Format minutes into readable time
export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Format date/time for display
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

// Get service data display text
export function getServiceDataText(serviceType: ServiceType, serviceData: any): string {
  switch (serviceType) {
    case 'MOUNT_BALANCE':
      return `${serviceData.tire_count || 0} tires`;
    case 'FLAT_REPAIR':
      return serviceData.tire_position || '';
    case 'ROTATION':
      return serviceData.pattern || 'Standard';
    case 'NEW_TIRES':
    case 'USED_TIRES':
      return `${serviceData.tire_size || ''} × ${serviceData.quantity || 0}${
        serviceData.brand ? ` (${serviceData.brand})` : ''
      }`;
    case 'DETAILING':
      return `${serviceData.service_level || ''} Detail`;
    case 'APPOINTMENT':
      return `${serviceData.customer_name || ''} - ${serviceData.phone || ''}`;
    default:
      return '';
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
