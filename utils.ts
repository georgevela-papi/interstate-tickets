import type { ServiceType, ServiceFieldConfig } from './types';
import { validateTireSize, validatePhone } from './types';

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
  MAINTENANCE: [
    {
      name: 'maintenance_type',
      label: 'Type of Maintenance',
      type: 'select',
      required: true,
      options: [
        { value: 'Oil Change', label: 'Oil Change' },
        { value: 'Brake Service', label: 'Brake Service' },
        { value: 'Alignment', label: 'Alignment' },
        { value: 'Inspection', label: 'Inspection' },
        { value: 'Battery', label: 'Battery' },
        { value: 'Wiper Blades', label: 'Wiper Blades' },
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
    case 'MAINTENANCE':
      return `${serviceData.maintenance_type || 'General'}${
        serviceData.description ? ` - ${serviceData.description}` : ''
      }`;
    default:
      return '';
  }
}

export function shouldShowAppointment(scheduledTime: string | null): boolean {
  if (!scheduledTime) return true;
  return new Date(scheduledTime) <= new Date();
}
