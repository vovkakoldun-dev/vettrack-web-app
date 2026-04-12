import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getOrgContext } from './useOrgContext'

export interface DashboardStats {
  totalClients: number
  appointmentsToday: number
  vaccinesDueThisWeek: number
  activePets: number
  appointmentsYesterday: number
  clientsLastMonth: number
  petsLastMonth: number
  vaccinesLastWeek: number
  loading: boolean
}

/**
 * Fetches all dashboard stats via a single Supabase RPC call
 * (`get_dashboard_stats`) instead of 8 separate count queries.
 */
export function useDashboardStats(): DashboardStats {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    appointmentsToday: 0,
    vaccinesDueThisWeek: 0,
    activePets: 0,
    appointmentsYesterday: 0,
    clientsLastMonth: 0,
    petsLastMonth: 0,
    vaccinesLastWeek: 0,
    loading: true,
  })

  const load = useCallback(async () => {
    try {
      const { organizationId } = await getOrgContext()

      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        p_org_id: organizationId,
      })

      if (error) {
        console.error('[useDashboardStats] RPC error:', error.message)
        setStats(prev => ({ ...prev, loading: false }))
        return
      }

      if (data) {
        setStats({
          totalClients: data.total_clients ?? 0,
          appointmentsToday: data.appointments_today ?? 0,
          vaccinesDueThisWeek: data.vaccines_due_this_week ?? 0,
          activePets: data.active_pets ?? 0,
          appointmentsYesterday: data.appointments_yesterday ?? 0,
          clientsLastMonth: data.clients_last_month ?? 0,
          petsLastMonth: data.pets_last_month ?? 0,
          vaccinesLastWeek: data.vaccines_last_week ?? 0,
          loading: false,
        })
      }
    } catch {
      setStats(prev => ({ ...prev, loading: false }))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Re-fetch when data changes anywhere in the app
  useEffect(() => {
    const handler = () => { load() }
    window.addEventListener('clientDataChanged', handler)
    window.addEventListener('petDataChanged', handler)
    window.addEventListener('appointmentDataChanged', handler)
    return () => {
      window.removeEventListener('clientDataChanged', handler)
      window.removeEventListener('petDataChanged', handler)
      window.removeEventListener('appointmentDataChanged', handler)
    }
  }, [load])

  return stats
}
