'use client';

import type { DbServiceType } from '@/lib/types';

interface ServicePickerProps {
  selectedService: string | null;
  onSelect: (slug: string) => void;
  services: DbServiceType[];
}

// Fallback icons for legacy slugs
const LEGACY_ICONS: Record<string, string> = {
  MOUNT_BALANCE: '⚙️',
  FLAT_REPAIR: '🔧',
  ROTATION: '🔄',
  NEW_TIRES: '🆕',
  USED_TIRES: '♻️',
  DETAILING: '✨',
  MAINTENANCE: '🛠️',
  APPOINTMENT: '📅',
};

function getIcon(service: DbServiceType): string {
  if (service.icon) return service.icon;
  return LEGACY_ICONS[service.slug] || '📋';
}

function formatPrice(cents: number): string {
  if (!cents) return '';
  return `$${(cents / 1).toFixed(0)}`;
}

export default function ServicePicker({ selectedService, onSelect, services }: ServicePickerProps) {
  // Only show active services, sorted by display_order
  const activeServices = services
    .filter((s) => s.active)
    .sort((a, b) => a.display_order - b.display_order);

  if (activeServices.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No services configured yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Select Service Type</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {activeServices.map((service) => (
          <button
            key={service.slug}
            type="button"
            onClick={() => onSelect(service.slug)}
            className={`
              flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200
              ${
                selectedService === service.slug
                  ? 'bg-sky-500 border-sky-600 text-white shadow-lg scale-105'
                  : 'bg-white border-gray-300 text-gray-700 hover:border-sky-400 hover:shadow-md active:scale-95'
              }
            `}
          >
            <span className="text-4xl mb-2">{getIcon(service)}</span>
            <span className="text-sm font-semibold text-center">{service.name}</span>
            {service.base_price > 0 && (
              <span className={`text-xs mt-1 ${selectedService === service.slug ? 'text-sky-100' : 'text-gray-400'}`}>
                {formatPrice(service.base_price)}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
