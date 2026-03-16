interface ClientRowProps {
  id?: number;
  petImage: string;
  petName: string;
  ownerName: string;
  breed: string;
  lastVisit: string;
  status: 'Healthy' | 'Follow-up' | 'Critical';
  onClick?: () => void;
}

export function ClientRow({ petImage, petName, ownerName, breed, lastVisit, status, onClick }: ClientRowProps) {
  const statusColors = {
    Healthy: { bg: '#74C69D20', text: 'var(--brand-green-text)' },
    'Follow-up': { bg: '#F4A26120', text: '#F4A261' },
    Critical: { bg: '#d4183d20', text: '#d4183d' },
  };

  const statusStyle = statusColors[status];

  return (
    <tr
      className={`border-b border-[var(--border-color)] transition-colors ${
        onClick ? 'cursor-pointer hover:bg-[var(--surface-elevated)]' : ''
      }`}
      onClick={onClick}
    >
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <img
            src={petImage}
            alt={petName}
            className="w-10 h-10 object-cover"
            style={{ borderRadius: '9999px' }}
          />
          <span className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 600 }}>
            {petName}
          </span>
        </div>
      </td>
      <td className="py-4 px-4">
        <span className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
          {ownerName}
        </span>
      </td>
      <td className="py-4 px-4">
        <span className="text-[var(--text-secondary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
          {breed}
        </span>
      </td>
      <td className="py-4 px-4">
        <span className="text-[var(--text-secondary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
          {lastVisit}
        </span>
      </td>
      <td className="py-4 px-4">
        <span
          className="inline-block px-3 py-1"
          style={{
            backgroundColor: statusStyle.bg,
            color: statusStyle.text,
            borderRadius: '9999px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {status}
        </span>
      </td>
    </tr>
  );
}
