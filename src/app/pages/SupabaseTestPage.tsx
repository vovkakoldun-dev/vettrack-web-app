import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { CheckCircle, XCircle, Loader2, Database, RefreshCw, Clock } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────

interface QueryResult {
  label: string
  table: string
  status: 'idle' | 'loading' | 'success' | 'error'
  data: unknown[] | null
  error: string | null
  durationMs: number | null
  count: number | null
}

// ─── Helpers ─────────────────────────────────────────────────

function StatusIcon({ status }: { status: QueryResult['status'] }) {
  if (status === 'loading') return <Loader2 style={{ width: 16, height: 16, color: '#3B82F6', animation: 'spin 1s linear infinite' }} />
  if (status === 'success') return <CheckCircle style={{ width: 16, height: 16, color: '#22C55E' }} />
  if (status === 'error')   return <XCircle    style={{ width: 16, height: 16, color: '#EF4444' }} />
  return <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: 'var(--border-color)' }} />
}

function StatusPill({ status }: { status: QueryResult['status'] }) {
  const cfg = {
    idle:    { bg: '#F3F4F6', text: '#6B7280', label: 'idle'    },
    loading: { bg: '#EFF6FF', text: '#3B82F6', label: 'running' },
    success: { bg: '#F0FDF4', text: '#16A34A', label: 'success' },
    error:   { bg: '#FEF2F2', text: '#DC2626', label: 'error'   },
  }[status]
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 999, backgroundColor: cfg.bg, color: cfg.text,
    }}>
      {cfg.label}
    </span>
  )
}

// ─── Query Card ───────────────────────────────────────────────

function QueryCard({ result }: { result: QueryResult }) {
  const isSuccess = result.status === 'success'
  const isError   = result.status === 'error'

  return (
    <div style={{
      backgroundColor: 'var(--surface-white)',
      border: `1.5px solid ${isSuccess ? '#22C55E30' : isError ? '#EF444430' : 'var(--border-color)'}`,
      borderRadius: 14,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--surface-elevated)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusIcon status={result.status} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 1 }}>
              {result.label}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              SELECT * FROM <strong>{result.table}</strong> LIMIT 5
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {result.durationMs !== null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
              <Clock style={{ width: 12, height: 12 }} />
              {result.durationMs}ms
            </span>
          )}
          <StatusPill status={result.status} />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 18px' }}>
        {result.status === 'loading' && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>Running query…</p>
        )}

        {result.status === 'idle' && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>Waiting to run…</p>
        )}

        {result.status === 'error' && (
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5',
          }}>
            <p style={{ fontSize: 13, color: '#DC2626', fontFamily: 'monospace' }}>{result.error}</p>
          </div>
        )}

        {result.status === 'success' && (
          <>
            {/* Count badge */}
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                backgroundColor: result.count === 0 ? '#F3F4F6' : '#F0FDF4',
                color: result.count === 0 ? '#6B7280' : '#16A34A',
              }}>
                {result.count === 0 ? 'No rows yet' : `${result.count} row${result.count !== 1 ? 's' : ''} returned`}
              </span>
              {result.count === 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Connection works — table is empty (no seed data yet)
                </span>
              )}
            </div>

            {/* Data rows */}
            {result.data && result.data.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
                  <thead>
                    <tr>
                      {Object.keys(result.data[0] as object).map(col => (
                        <th key={col} style={{
                          padding: '6px 10px', textAlign: 'left', fontWeight: 700,
                          color: 'var(--text-secondary)', backgroundColor: 'var(--surface-elevated)',
                          borderBottom: '1px solid var(--border-color)',
                          whiteSpace: 'nowrap',
                        }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row as object).map((val, j) => (
                          <td key={j} style={{
                            padding: '6px 10px',
                            borderBottom: i < result.data!.length - 1 ? '1px solid var(--border-color)' : 'none',
                            color: val === null ? '#9CA3AF' : 'var(--text-primary)',
                            fontStyle: val === null ? 'italic' : 'normal',
                            maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {val === null ? 'null' : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

const QUERIES: Array<{ label: string; table: keyof import('../../types/database.types').Database['public']['Tables'] }> = [
  { label: 'Organizations',  table: 'organizations'    },
  { label: 'Clinics',        table: 'clinics'          },
  { label: 'Staff',          table: 'staff'            },
  { label: 'Clients',        table: 'clients'          },
  { label: 'Pets',           table: 'pets'             },
  { label: 'Appointments',   table: 'appointments'     },
  { label: 'Medical Records',table: 'medical_records'  },
  { label: 'Services',       table: 'services'         },
]

export default function SupabaseTestPage() {
  const [results, setResults] = useState<QueryResult[]>(
    QUERIES.map(q => ({
      label: q.label,
      table: q.table,
      status: 'idle',
      data: null,
      error: null,
      durationMs: null,
      count: null,
    }))
  )
  const [runCount, setRunCount] = useState(0)
  const [overallStatus, setOverallStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [pingMs, setPingMs] = useState<number | null>(null)

  const runAll = async () => {
    setRunCount(c => c + 1)
    setOverallStatus('running')
    setPingMs(null)

    // Reset all to loading
    setResults(prev => prev.map(r => ({ ...r, status: 'loading', data: null, error: null, durationMs: null, count: null })))

    // Ping test — simple health check via organizations table
    const pingStart = performance.now()

    // Run all queries concurrently
    const promises = QUERIES.map(async (q, idx) => {
      const start = performance.now()
      try {
        const { data, error, count } = await supabase
          .from(q.table)
          .select('*', { count: 'exact' })
          .limit(5)

        const durationMs = Math.round(performance.now() - start)

        if (error) {
          setResults(prev => {
            const next = [...prev]
            next[idx] = { ...next[idx], status: 'error', error: error.message, durationMs }
            return next
          })
        } else {
          setResults(prev => {
            const next = [...prev]
            next[idx] = { ...next[idx], status: 'success', data: data ?? [], count: count ?? data?.length ?? 0, durationMs }
            return next
          })
        }
      } catch (e: unknown) {
        const durationMs = Math.round(performance.now() - start)
        setResults(prev => {
          const next = [...prev]
          next[idx] = { ...next[idx], status: 'error', error: String(e), durationMs }
          return next
        })
      }
    })

    await Promise.all(promises)
    setPingMs(Math.round(performance.now() - pingStart))
    setOverallStatus('done')
  }

  // Auto-run on mount
  useEffect(() => { runAll() }, [])

  const successCount = results.filter(r => r.status === 'success').length
  const errorCount   = results.filter(r => r.status === 'error').length
  const allDone      = overallStatus === 'done'

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #2D6A4F, #74C69D)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Database style={{ width: 18, height: 18, color: '#fff' }} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Supabase Connection Test</h1>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 520 }}>
            Runs live SELECT queries against your Supabase project to verify the connection,
            RLS policies, and TypeScript types are all wired up correctly.
          </p>
        </div>

        <button
          onClick={runAll}
          disabled={overallStatus === 'running'}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            backgroundColor: '#2D6A4F', color: '#fff', fontSize: 14, fontWeight: 700,
            opacity: overallStatus === 'running' ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          <RefreshCw style={{
            width: 15, height: 15,
            animation: overallStatus === 'running' ? 'spin 1s linear infinite' : 'none',
          }} />
          {overallStatus === 'running' ? 'Running…' : `Re-run${runCount > 1 ? ` (${runCount})` : ''}`}
        </button>
      </div>

      {/* ── Summary bar ── */}
      {allDone && (
        <div style={{
          marginBottom: 24, padding: '14px 20px', borderRadius: 12,
          backgroundColor: errorCount === 0 ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${errorCount === 0 ? '#86EFAC' : '#FCA5A5'}`,
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          {errorCount === 0 ? (
            <CheckCircle style={{ width: 20, height: 20, color: '#16A34A', flexShrink: 0 }} />
          ) : (
            <XCircle style={{ width: 20, height: 20, color: '#DC2626', flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 14, fontWeight: 700, color: errorCount === 0 ? '#15803D' : '#DC2626' }}>
            {errorCount === 0
              ? `All ${successCount} queries succeeded`
              : `${errorCount} error${errorCount > 1 ? 's' : ''} — ${successCount} succeeded`}
          </span>
          <div style={{ display: 'flex', gap: 16, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              <strong>Project:</strong>{' '}
              <code style={{ fontSize: 12 }}>gxrdzwgitbsbfxtakpbr</code>
            </span>
            {pingMs !== null && (
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong>Round-trip:</strong> {pingMs}ms
              </span>
            )}
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              <strong>Tables queried:</strong> {QUERIES.length}
            </span>
          </div>
        </div>
      )}

      {/* ── Query cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {results.map((result, i) => (
          <QueryCard key={i} result={result} />
        ))}
      </div>

      {/* ── Connection info ── */}
      <div style={{
        marginTop: 28, padding: '16px 20px', borderRadius: 12,
        border: '1px dashed var(--border-color)',
        backgroundColor: 'var(--surface-elevated)',
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Connection Details
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { label: 'Supabase URL',   value: import.meta.env.VITE_SUPABASE_URL },
            { label: 'Auth',           value: 'anon key (public)' },
            { label: 'Client',         value: '@supabase/supabase-js' },
            { label: 'Types',          value: 'Database (auto-generated)' },
          ].map(item => (
            <div key={item.label}>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {item.label}
              </p>
              <p style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* spin keyframes */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
