'use client';

import type { ServiceType } from '@/lib/types';
import { SERVICE_TYPE_LABELS } from '@/lib/types';

interface ServicePickerProps {
  selectedService: ServiceType | null;
  onSelect: (service: ServiceType) => void;
}

const SERVICE_ICONS: Record<ServiceType, string> = {
  MOUNT_BALANCE: '⚙️',
  FLAT_REPAIR: '🔧',
  ROTATION: '🔄',
  NEW_TIRES: '🆕',
  USED_TIRES: '♻️',
  DETAILING: '✨',
  MAINTENANCE: '🔩',
  APPOINTMENT: '📅',
};

export default function ServicePicker({ selectedService, onSelect }: ServicePickerProps) {
  const services = Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][];

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Select Service Type</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {services.map(([type, label]) => (
          <button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            className={`
              flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200
              ${
                selectedService === type
                  ? 'bg-sky-500 border-sky-600 text-white shadow-lg scale-105'
                  : 'bg-white border-gray-300 text-gray-700 hover:border-sky-400 hover:shadow-md active:scale-95'
              }
            `}
          >
            <span className="text-4xl mb-2">{SERVICE_ICONS[type]}</span>
            <span className="text-sm font-semibold text-center">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
