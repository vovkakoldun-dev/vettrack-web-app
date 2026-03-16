import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  PawPrint, Calendar, AlertCircle, CheckCircle2,
  ChevronRight, Scale, Heart, Syringe, Activity,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { usePets } from '../../hooks/usePets';

// ─── Brand ───────────────────────────────────────────────────
const BRAND = '#2D6A4F';
const BRAND_TEXT = 'var(--brand-green-text)';

const STATUS_CONFIG = {
  Healthy:     { bg: '#74C69D20', text: BRAND_TEXT,  border: '#74C69D50', icon: CheckCircle2, label: 'Healthy' },
  'Follow-up': { bg: '#F4A26120', text: '#F4A261',   border: '#F4A26150', icon: AlertCircle,  label: 'Follow-up needed' },
  Critical:    { bg: '#d4183d20', text: '#d4183d',   border: '#d4183d50', icon: AlertCircle,  label: 'Critical' },
};

const PET_EMOJI = { Dog: '🐕', Cat: '🐈', default: '🐾' };

export default function OwnerPetsPage() {
  const navigate = useNavigate();
  const { pets: supaPets } = usePets();

  const PETS = useMemo(() =>
    supaPets.map((p) => {
      const age = p.date_of_birth
        ? `${Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))}y`
        : '—';
      return {
        id: p.id,
        name: p.name,
        species: p.species,
        breed: p.breed ?? '—',
        age,
        weight: p.weight_kg ? `${p.weight_kg} kg` : '—',
        sex: '—',
        image: p.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=74C69D&color=fff&size=400`,
        status: 'Healthy' as const,
        vaccinesUpToDate: 0,
        vaccinesDue: 0,
        activeConditions: [] as string[],
        allergies: [] as string[],
        nextAppointment: { reason: 'No upcoming', date: '—', time: '—' },
        vet: 'Dr. Chen',
        lastVisit: new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        microchip: p.microchip_no ?? '—',
      };
    }),
    [supaPets],
  );

  return (
    <div className="p-4 md:p-8" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: `linear-gradient(135deg, ${BRAND}, #52B788)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <PawPrint style={{ width: '20px', height: '20px', color: '#fff' }} />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>My Pets</h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, paddingLeft: '48px' }}>
            {PETS.length} pets registered · John Smith
          </p>
        </div>

        {/* ── Pet cards ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {PETS.map((pet) => {
            const statusConf = STATUS_CONFIG[pet.status] ?? STATUS_CONFIG.Healthy;
            const StatusIcon = statusConf.icon;
            const emoji = PET_EMOJI[pet.species as keyof typeof PET_EMOJI] ?? PET_EMOJI.default;

            return (
              <div
                key={pet.id}
                onClick={() => navigate(`/owner/pets/${pet.id}`)}
                style={{
                  backgroundColor: 'var(--surface-white)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s, transform 0.15s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 24px rgba(45,106,79,0.14)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }}
              >
                {/* Cover photo */}
                <div style={{ position: 'relative', height: '180px', overflow: 'hidden' }}>
                  <img
                    src={pet.image}
                    alt={pet.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%)',
                  }} />
                  {/* Name overlay */}
                  <div style={{ position: 'absolute', bottom: '14px', left: '16px', right: '16px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: '24px', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.1, textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>
                        {emoji} {pet.name}
                      </p>
                      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: '3px 0 0', fontWeight: 500 }}>
                        {pet.breed} · {pet.age}
                      </p>
                    </div>
                    {/* Status badge */}
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '9999px',
                      backgroundColor: '#fff',
                      color: statusConf.text,
                      boxShadow: '0 1px 8px rgba(0,0,0,0.22)',
                      display: 'flex', alignItems: 'center', gap: '5px',
                    }}>
                      <StatusIcon style={{ width: '11px', height: '11px' }} />
                      {statusConf.label}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: '18px 20px 0' }}>

                  {/* Quick stats strip */}
                  <div style={{ display: 'flex', gap: '0px', marginBottom: '16px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    {[
                      { label: 'Weight', value: pet.weight,  icon: Scale },
                      { label: 'Sex',    value: pet.sex.split(' ')[0], icon: Heart },
                      { label: 'Vaccines OK', value: `${pet.vaccinesUpToDate}/${pet.vaccinesUpToDate + pet.vaccinesDue}`, icon: Syringe },
                      { label: 'Conditions', value: `${pet.activeConditions.length} active`, icon: Activity },
                    ].map(({ label, value, icon: Icon }, i, arr) => (
                      <div
                        key={label}
                        style={{
                          flex: 1, padding: '9px 0', textAlign: 'center',
                          backgroundColor: 'var(--surface-elevated)',
                          borderRight: i < arr.length - 1 ? '1px solid var(--border-color)' : 'none',
                        }}
                      >
                        <Icon style={{ width: '13px', height: '13px', color: BRAND_TEXT, margin: '0 auto 3px', display: 'block' }} />
                        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }}>{value}</p>
                        <p style={{ fontSize: '9px', color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Conditions */}
                  {pet.activeConditions.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>Active Conditions</p>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {pet.activeConditions.map((c) => (
                          <Badge
                            key={c}
                            style={{
                              fontSize: '11px', fontWeight: 600,
                              backgroundColor: '#F4A26115', color: '#F4A261',
                              border: '1px solid #F4A26130',
                            }}
                          >
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Allergies */}
                  <div style={{ marginBottom: '14px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>Allergies</p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {pet.allergies.map((a) => (
                        <Badge
                          key={a}
                          style={{
                            fontSize: '11px', fontWeight: 600,
                            backgroundColor: '#d4183d10', color: '#d4183d',
                            border: '1px solid #d4183d25',
                          }}
                        >
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Next appointment */}
                  <div style={{
                    padding: '11px 14px', borderRadius: '10px',
                    backgroundColor: `${BRAND}0c`,
                    border: `1px solid ${BRAND}25`,
                    marginBottom: '16px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: `${BRAND}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Calendar style={{ width: '15px', height: '15px', color: BRAND_TEXT }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: BRAND_TEXT, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Next Appointment</p>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pet.nextAppointment.reason}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '1px 0 0' }}>
                        {pet.nextAppointment.date} · {pet.nextAppointment.time}
                      </p>
                    </div>
                  </div>

                  {/* Attending vet */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #2D6A4F, #52B788)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: '#fff' }}>DC</span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Attending: <strong style={{ color: 'var(--text-primary)' }}>{pet.vet}</strong>
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Last visit {pet.lastVisit}
                    </span>
                  </div>
                </div>

                {/* Footer CTA */}
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Chip: {pet.microchip}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/owner/pets/${pet.id}`); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '7px 16px', borderRadius: '8px',
                      backgroundColor: BRAND, color: '#fff',
                      border: 'none', fontSize: '13px', fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    View Profile <ChevronRight style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Add pet prompt ── */}
        <div
          style={{
            marginTop: '24px',
            border: '2px dashed var(--border-color)',
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          <PawPrint style={{ width: '28px', height: '28px', margin: '0 auto 10px', opacity: 0.4 }} />
          <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>Want to add another pet?</p>
          <p style={{ fontSize: '13px', margin: '0 0 14px', opacity: 0.8 }}>Contact your clinic and they'll add your new pet to the system.</p>
          <button
            onClick={() => (window.location.href = '/owner/contact')}
            style={{
              padding: '8px 20px', borderRadius: '9px',
              border: `1.5px solid ${BRAND}`,
              backgroundColor: 'transparent', color: BRAND_TEXT,
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Contact Clinic
          </button>
        </div>

      </div>
    </div>
  );
}
