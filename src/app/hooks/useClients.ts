import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { getOrgContext } from './useOrgContext'
import { useTenantDb } from '../context/TenantContext'

export interface ClientPet {
  id: string
  name: string
  species: string
  breed: string | null
  photo_url: string | null
  assigned_vet_id: string | null
  assigned_vet: { id: string; profiles: { first_name: string; last_name: string } | null } | null
}

export interface ClientRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string | null
  notes: string | null
  portal_status: string | null
  health_status: string | null
  created_at: string
  pets?: ClientPet[]
}

export interface AddClientValues {
  first_name: string
  last_name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  notes?: string
}

// ─── Standalone cascade-delete helpers (no hooks) ─────────────

/**
 * Delete all data for a single pet across every related table + storage.
 * Uses a server-side RPC (`delete_pet_cascade`) so all 18 dependent tables
 * are wiped in a SINGLE TRANSACTION — one network round trip instead of 20+.
 */
export async function deletePetCascade(petId: string) {
  // 1. Run the server-side cascade (single round trip, runs in a transaction)
  const { error } = await supabase.rpc('delete_pet_cascade', { p_pet_id: petId })
  if (error) {
    console.error('[deletePetCascade] RPC failed:', error.message)
    throw new Error(`Failed to delete pet: ${error.message}`)
  }

  // 2. Best-effort: clean up storage buckets (RPC can't touch storage)
  try {
    const [b1, b2] = await Promise.all([
      supabase.storage.from('pet-photos').list(petId),
      supabase.storage.from('pet-images').list(petId),
    ])
    const removals: Promise<any>[] = []
    if (b1.data && b1.data.length > 0) {
      removals.push(supabase.storage.from('pet-photos').remove(b1.data.map(f => `${petId}/${f.name}`)))
    }
    if (b2.data && b2.data.length > 0) {
      removals.push(supabase.storage.from('pet-images').remove(b2.data.map(f => `${petId}/${f.name}`)))
    }
    if (removals.length > 0) await Promise.all(removals)
  } catch {}
}

/**
 * Bulk-delete many pets in a single transaction (one network round trip).
 */
export async function deletePetsBulk(petIds: string[]) {
  if (petIds.length === 0) return
  const { error } = await supabase.rpc('delete_pets_bulk', { p_pet_ids: petIds })
  if (error) {
    console.error('[deletePetsBulk] RPC failed:', error.message)
    throw new Error(`Bulk pet delete failed: ${error.message}`)
  }
  // Best-effort storage cleanup, in parallel
  await Promise.all(
    petIds.map(async (id) => {
      try {
        const [b1, b2] = await Promise.all([
          supabase.storage.from('pet-photos').list(id),
          supabase.storage.from('pet-images').list(id),
        ])
        const removals: Promise<any>[] = []
        if (b1.data?.length) removals.push(supabase.storage.from('pet-photos').remove(b1.data.map(f => `${id}/${f.name}`)))
        if (b2.data?.length) removals.push(supabase.storage.from('pet-images').remove(b2.data.map(f => `${id}/${f.name}`)))
        if (removals.length > 0) await Promise.all(removals)
      } catch {}
    })
  )
}

/**
 * Bulk-delete many clients in a single transaction (one network round trip).
 * Returns the number of clients actually deleted.
 */
export async function deleteClientsBulk(clientIds: string[]): Promise<number> {
  if (clientIds.length === 0) return 0

  // Collect pet IDs FIRST so we can clean up storage after the RPC succeeds
  const { data: pets } = await supabase
    .from('pets')
    .select('id')
    .in('client_id', clientIds)

  // Run the cascade on the server in one transaction
  const { data, error } = await supabase.rpc('delete_clients_bulk', { p_client_ids: clientIds })
  if (error) {
    console.error('[deleteClientsBulk] RPC failed:', error.message)
    throw new Error(`Bulk client delete failed: ${error.message}`)
  }

  // Best-effort storage cleanup for every pet that belonged to those clients
  if (pets && pets.length > 0) {
    await Promise.all(
      pets.map(async (p: any) => {
        try {
          const [b1, b2] = await Promise.all([
            supabase.storage.from('pet-photos').list(p.id),
            supabase.storage.from('pet-images').list(p.id),
          ])
          const removals: Promise<any>[] = []
          if (b1.data?.length) removals.push(supabase.storage.from('pet-photos').remove(b1.data.map(f => `${p.id}/${f.name}`)))
          if (b2.data?.length) removals.push(supabase.storage.from('pet-images').remove(b2.data.map(f => `${p.id}/${f.name}`)))
          if (removals.length > 0) await Promise.all(removals)
        } catch {}
      })
    )
  }

  return (data as number) ?? clientIds.length
}

// ─── Hook ─────────────────────────────────────────────────────

export interface UseClientsOptions {
  /** When set, enables infinite-scroll pagination with this page size.
   *  When omitted (the default), the hook fetches ALL clients at once
   *  to preserve backwards compatibility with existing callers. */
  pageSize?: number
  /** Column to order by on the server. Defaults to 'created_at'. */
  orderColumn?: string
  /** Sort direction. Defaults to false (descending = newest first). */
  orderAscending?: boolean
}

const CLIENT_SELECT = 'id, first_name, last_name, email, phone, address, city, state, zip, country, notes, portal_status, health_status, created_at, pets(id, name, species, breed, photo_url, assigned_vet_id, assigned_vet:staff!pets_assigned_vet_id_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name)))';

export function useClients(options: UseClientsOptions = {}) {
  const { pageSize, orderColumn = 'created_at', orderAscending = false } = options
  const paginated = typeof pageSize === 'number' && pageSize > 0
  const db = useTenantDb()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const offsetRef = useRef(0)
  const inFlightRef = useRef(false)

  const fetchClients = useCallback(async (reset: boolean = true) => {
    if (inFlightRef.current) return
    inFlightRef.current = true

    if (reset) {
      setLoading(true)
      offsetRef.current = 0
    } else {
      setLoadingMore(true)
    }
    setError(null)

    try {
      const { organizationId } = await getOrgContext()
      let query = db
        .from('clients')
        .select(CLIENT_SELECT, { count: reset ? 'exact' : undefined })
        .eq('organization_id', organizationId)
        .order(orderColumn, { ascending: orderAscending })

      if (paginated) {
        const from = offsetRef.current
        const to = from + (pageSize as number) - 1
        query = query.range(from, to)
      }

      const { data, error: err, count } = await query

      if (err) {
        setError(err.message)
      } else {
        const rows = (data as ClientRow[]) ?? []
        if (reset) {
          setClients(rows)
          if (typeof count === 'number') setTotalCount(count)
        } else {
          setClients(prev => [...prev, ...rows])
        }

        if (paginated) {
          offsetRef.current = offsetRef.current + rows.length
          // hasMore = we received a full page (likely more behind it)
          setHasMore(rows.length === pageSize)
        } else {
          // Non-paginated: everything is loaded in one shot
          setHasMore(false)
          if (typeof count !== 'number') setTotalCount(rows.length)
        }
      }
    } catch (e: any) {
      setError(e.message)
    }

    if (reset) setLoading(false)
    else setLoadingMore(false)
    inFlightRef.current = false
  }, [paginated, pageSize, orderColumn, orderAscending])

  const loadMore = useCallback(() => {
    if (inFlightRef.current || loading || loadingMore || !hasMore) return
    fetchClients(false)
  }, [fetchClients, loading, loadingMore, hasMore])

  // Initial load + refetch whenever the sort order changes (pagination resets)
  useEffect(() => {
    fetchClients(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderColumn, orderAscending])

  // Listen for cross-page data changes — debounced to prevent cascade storms
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handler = () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => fetchClients(true), 300);
    }
    window.addEventListener('clientDataChanged', handler)
    window.addEventListener('petDataChanged', handler)
    return () => {
      window.removeEventListener('clientDataChanged', handler)
      window.removeEventListener('petDataChanged', handler)
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    }
  }, [fetchClients])

  const addClient = useCallback(async (values: AddClientValues) => {
    const { organizationId } = await getOrgContext();
    const { data, error: err } = await db
      .from('clients')
      .insert([{ organization_id: organizationId, ...values }])
      .select('id, first_name, last_name, email, phone, address, city, state, zip, country, notes, portal_status, health_status, created_at, pets(id, name, species, breed, photo_url, assigned_vet_id, assigned_vet:staff!pets_assigned_vet_id_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name)))')
      .single()
    if (!err && data) {
      setClients(prev => [data as ClientRow, ...prev])
      // Account for the new row in the pagination offset and total
      offsetRef.current += 1
      setTotalCount(prev => (prev == null ? prev : prev + 1))
      window.dispatchEvent(new CustomEvent('clientDataChanged'))
    }
    return { data, error: err }
  }, [])

  const updateClient = useCallback(async (id: string, values: Partial<AddClientValues>) => {
    const { organizationId } = await getOrgContext()
    const { data, error: err } = await db
      .from('clients')
      .update(values)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single()
    if (!err && data) {
      setClients(prev => prev.map(c => c.id === id ? { ...c, ...values } : c))
      window.dispatchEvent(new CustomEvent('clientDataChanged'))
    }
    return { data, error: err }
  }, [])

  const deleteClient = useCallback(async (id: string) => {
    // Collect pet IDs first for storage cleanup
    const { data: pets } = await db.from('pets').select('id').eq('client_id', id)

    // Run the full cascade in a single transaction on the server
    const { error } = await supabase.rpc('delete_client_cascade', { p_client_id: id })
    if (error) {
      console.error('[deleteClient] RPC failed:', error.message)
      return { error }
    }

    // Best-effort storage cleanup
    if (pets && pets.length > 0) {
      await Promise.all(
        pets.map(async (p: any) => {
          try {
            const [b1, b2] = await Promise.all([
              supabase.storage.from('pet-photos').list(p.id),
              supabase.storage.from('pet-images').list(p.id),
            ])
            const removals: Promise<any>[] = []
            if (b1.data?.length) removals.push(supabase.storage.from('pet-photos').remove(b1.data.map(f => `${p.id}/${f.name}`)))
            if (b2.data?.length) removals.push(supabase.storage.from('pet-images').remove(b2.data.map(f => `${p.id}/${f.name}`)))
            if (removals.length > 0) await Promise.all(removals)
          } catch {}
        })
      )
    }

    setClients(prev => prev.filter(c => c.id !== id))
    // Adjust pagination counters
    offsetRef.current = Math.max(0, offsetRef.current - 1)
    setTotalCount(prev => (prev == null ? prev : Math.max(0, prev - 1)))
    window.dispatchEvent(new CustomEvent('clientDataChanged'))
    return { error: null }
  }, [])

  return {
    clients,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    error,
    refetch: () => fetchClients(true),
    loadMore,
    addClient,
    updateClient,
    deleteClient,
  }
}
