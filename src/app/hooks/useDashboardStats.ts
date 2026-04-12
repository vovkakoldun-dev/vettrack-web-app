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
      const n = new Date()
      const today = `${n.getFullYear()}-${(n.getMonth() + 1).toString().padStart(2, '0')}-${n.getDate().toString().padStart(2, '0')}`
      const w = new Date(Date.now() + 7 * 86400000)
      const weekEnd = `${w.getFullYear()}-${(w.getMonth() + 1).toString().padStart(2, '0')}-${w.getDate().toString().padStart(2, '0')}`

      const y = new Date(n)
      y.setDate(y.getDate() - 1)
      const yesterday = `${y.getFullYear()}-${(y.getMonth() + 1).toString().padStart(2, '0')}-${y.getDate().toString().padStart(2, '0')}`
      const lm = new Date(n)
      lm.setMonth(lm.getMonth() - 1)
      const lastMonth = `${lm.getFullYear()}-${(lm.getMonth() + 1).toString().padStart(2, '0')}-${lm.getDate().toString().padStart(2, '0')}`
      const lw = new Date(Date.now() - 7 * 86400000)
      const lastWeekStart = `${lw.getFullYear()}-${(lw.getMonth() + 1).toString().padStart(2, '0')}-${lw.getDate().toString().padStart(2, '0')}`

      const [clientsRes, apptRes, vacRes, petsRes, apptYestRes, clientsLmRes, petsLmRes, vacLwRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('scheduled_at', new Date(`${today}T00:00:00`).toISOString())
          .lte('scheduled_at', new Date(`${today}T23:59:59`).toISOString())
          .not('status', 'eq', 'Cancelled'),
        supabase
          .from('vaccinations')
          .select('id, pets!inner(organization_id)', { count: 'exact', head: true })
          .eq('pets.organization_id', organizationId)
          .lte('next_due_date', weekEnd),
        supabase
          .from('pets')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('is_active', true),
        // Comparison: yesterday's appointments
        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('scheduled_at', new Date(`${yesterday}T00:00:00`).toISOString())
          .lte('scheduled_at', new Date(`${yesterday}T23:59:59`).toISOString())
          .not('status', 'eq', 'Cancelled'),
        // Comparison: clients created before last month
        supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .lte('created_at', `${lastMonth}T23:59:59`),
        // Comparison: pets active last month
        supabase
          .from('pets')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .lte('created_at', `${lastMonth}T23:59:59`),
        // Comparison: vaccines due last week
        supabase
          .from('vaccinations')
          .select('id, pets!inner(organization_id)', { count: 'exact', head: true })
          .eq('pets.organization_id', organizationId)
          .lte('next_due_date', lastWeekStart),
      ])

      setStats({
        totalClients: clientsRes.count ?? 0,
        appointmentsToday: apptRes.count ?? 0,
        vaccinesDueThisWeek: vacRes.count ?? 0,
        activePets: petsRes.count ?? 0,
        appointmentsYesterday: apptYestRes.count ?? 0,
        clientsLastMonth: clientsLmRes.count ?? 0,
        petsLastMonth: petsLmRes.count ?? 0,
        vaccinesLastWeek: vacLwRes.count ?? 0,
        loading: false,
      })
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
