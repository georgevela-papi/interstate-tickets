// Type definitions for Interstate Tires Job Ticket System
// Updated: Fix pass — adds MAINTENANCE, customer fields, metrics exclusion

export type TicketStatus = 'PENDING' | 'COMPLETED';
export type PriorityLevel = 'LOW' | 'NORMAL' | 'HIGH';
export type StaffRole = 'SERVICE_WRITER' | 'TECHNICIAN' | 'MANAGER';

export type ServiceType =
  | 'MOUNT_BALANCE'
  | 'FLAT_REPAIR'
  | 'ROTATION'
  | 'NEW_TIRES'
  | 'USED_TIRES'
  | 'DETAILING'
  | 'MAINTENANCE'
  | 'APPOINTMENT';

export interface Staff {
  id: string;
  id_code: string;
  name: string;
  role: StaffRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Technician {
  id: string;
  staff_id: string | null;
  name: string;
  active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone_raw: string | null;
  phone_normalized: string | null;
  last_vehicle_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerSearchResult {
  id: string;
  name: string;
  phone_raw: string | null;
  phone_normalized: string | null;
  last_vehicle_text: string | null;
  created_at: string;
  last_visit_date: string | null;
  total_visits: number;
}

export interface Ticket {
  id: string;
  ticket_number: number;
  service_type: ServiceType;
  priority: PriorityLevel;
  status: TicketStatus;
  vehicle: string;
  service_data: any;
  notes: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  scheduled_time: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  created_by: string | null;
  customer_id: string | null;
}

export interface ActiveQueueItem {
  id: string;
  ticket_number: number;
  service_type: ServiceType;
  priority: PriorityLevel;
  vehicle: string;
  service_data: any;
  notes: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  scheduled_time: string | null;
  created_at: string;
  minutes_waiting: number;
}

// Service-specific data types
export type ServiceData =
  | MountBalanceData
  | FlatRepairData
  | RotationData
  | TireData
  | DetailingData
  | AppointmentData
  | MaintenanceData
  | Record<string, never>;

export interface MountBalanceData {
  tire_count: number;
}

export interface FlatRepairData {
  tire_position: 'FL' | 'FR' | 'RL' | 'RR';
}

export interface RotationData {
  pattern?: string;
}

export interface TireData {
  tire_size: string;
  quantity: number;
  brand?: string;
}

export interface DetailingData {
  service_level: 'Basic' | 'Full';
}

export interface AppointmentData {
  customer_name: string;
  phone: string;
  scheduled_date: string;
  scheduled_time: string;
  appointment_service: ServiceType;
}

export interface MaintenanceData {
  maintenance_type: string;
  description?: string;
}

export interface ServiceFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'radio' | 'textarea' | 'time' | 'tel' | 'date';
  required: boolean;
  options?: string[] | { value: string; label: string }[];
  min?: number;
  max?: number;
  pattern?: string;
  placeholder?: string;
  validation?: (value: any) => boolean;
  errorMessage?: string;
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  MOUNT_BALANCE: 'Mount/Balance',
  FLAT_REPAIR: 'Flat Repair',
  ROTATION: 'Rotation',
  NEW_TIRES: 'New Tires',
  USED_TIRES: 'Used Tires',
  DETAILING: 'Detailing',
  MAINTENANCE: 'Maintenance',
  APPOINTMENT: 'Appointment',
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
};

export const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  HIGH: 'bg-red-100 border-red-500 text-red-900',
  NORMAL: 'bg-white border-gray-300 text-gray-900',
  LOW: 'bg-blue-100 border-blue-500 text-blue-900',
};

// Services that can be booked as an appointment
export const APPOINTABLE_SERVICES: { value: ServiceType; label: string }[] = [
  { value: 'MOUNT_BALANCE', label: 'Mount/Balance' },
  { value: 'FLAT_REPAIR', label: 'Flat Repair' },
  { value: 'ROTATION', label: 'Rotation' },
  { value: 'NEW_TIRES', label: 'New Tires' },
  { value: 'USED_TIRES', label: 'Used Tires' },
  { value: 'DETAILING', label: 'Detailing' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
];

export function validateTireSize(size: string): boolean {
  const pattern = /^\d{3}\/\d{2}[R\/]\d{2}$/;
  return pattern.test(size);
}

export function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10;
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}
