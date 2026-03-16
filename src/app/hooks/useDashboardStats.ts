import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export interface DashboardStats {
  totalClients: number
  appointmentsToday: number
  vaccinesDueThisWeek: number
  activePets: number
  loading: boolean
}

export function useDashboardStats(): DashboardStats {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    appointmentsToday: 0,
    vaccinesDueThisWeek: 0,
    activePets: 0,
    loading: true,
  })

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

      const [clientsRes, apptRes, vacRes, petsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .gte('scheduled_at', `${today}T00:00:00`)
          .lte('scheduled_at', `${today}T23:59:59`),
        supabase
          .from('vaccinations')
          .select('id', { count: 'exact', head: true })
          .lte('next_due_date', weekEnd)
          .gte('next_due_date', today),
        supabase
          .from('pets')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
      ])

      setStats({
        totalClients: clientsRes.count ?? 0,
        appointmentsToday: apptRes.count ?? 0,
        vaccinesDueThisWeek: vacRes.count ?? 0,
        activePets: petsRes.count ?? 0,
        loading: false,
      })
    }
    load()
  }, [])

  return stats
}
