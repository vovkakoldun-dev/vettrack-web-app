import { Clock } from 'lucide-react';

interface AppointmentCardProps {
  time: string;
  petName: string;
  ownerName: string;
  service: string;
  petImage: string;
  onClick?: () => void;
}

export function AppointmentCard({ time, petName, ownerName, service, petImage, onClick }: AppointmentCardProps) {
  return (
    <div
      className={`bg-[var(--surface-white)] p-4 border border-[var(--border-color)] hover:border-[#2D6A4F] transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
      style={{ borderRadius: '12px' }}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {petImage ? (
          <img
            src={petImage}
            alt={petName}
            className="w-12 h-12 object-cover flex-shrink-0"
            style={{ borderRadius: '9999px' }}
          />
        ) : (
          <div
            className="w-12 h-12 flex items-center justify-center flex-shrink-0"
            style={{ borderRadius: '9999px', backgroundColor: '#2D6A4F20', color: '#2D6A4F', fontSize: '16px', fontWeight: 700 }}
          >
            {petName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
              {time}
            </span>
          </div>
          <p className="text-[var(--text-primary)] mb-1" style={{ fontSize: '16px', fontWeight: 600 }}>
            {petName}
          </p>
          <p className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '14px', fontWeight: 400 }}>
            Owner: {ownerName}
          </p>
          <span
            className="inline-block px-3 py-1 bg-[#74C69D20] text-[var(--brand-green-text)]"
            style={{
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {service}
          </span>
        </div>
      </div>
    </div>
  );
}
