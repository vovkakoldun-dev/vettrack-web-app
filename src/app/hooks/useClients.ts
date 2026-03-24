import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export interface ClientPet {
  id: string
  name: string
  species: string
  breed: string | null
  photo_url: string | null
  assigned_vet_id: string | null
  assigned_vet: { id: string; first_name: string; last_name: string } | null
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
  notes?: string
}

export function useClients() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('clients')
      .select('id, first_name, last_name, email, phone, address, city, state, zip, notes, portal_status, health_status, created_at, pets(id, name, species, breed, photo_url, assigned_vet_id, assigned_vet:staff!pets_assigned_vet_id_fkey(id, first_name, last_name))')
      .order('created_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setClients((data as ClientRow[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  // Listen for cross-page data changes
  useEffect(() => {
    const handler = () => { fetchClients() }
    window.addEventListener('clientDataChanged', handler)
    window.addEventListener('petDataChanged', handler)
    return () => {
      window.removeEventListener('clientDataChanged', handler)
      window.removeEventListener('petDataChanged', handler)
    }
  }, [fetchClients])

  const addClient = useCallback(async (values: AddClientValues) => {
    const { data, error: err } = await supabase
      .from('clients')
      .insert([{ organization_id: '00000000-0000-0000-0000-000000000001', ...values }])
      .select('id, first_name, last_name, email, phone, address, city, state, zip, notes, portal_status, health_status, created_at, pets(id, name, species, breed, photo_url, assigned_vet_id, assigned_vet:staff!pets_assigned_vet_id_fkey(id, first_name, last_name))')
      .single()
    if (!err && data) {
      setClients(prev => [data as ClientRow, ...prev])
      window.dispatchEvent(new CustomEvent('clientDataChanged'))
    }
    return { data, error: err }
  }, [])

  const updateClient = useCallback(async (id: string, values: Partial<AddClientValues>) => {
    const { data, error: err } = await supabase
      .from('clients')
      .update(values)
      .eq('id', id)
      .select()
      .single()
    if (!err && data) {
      setClients(prev => prev.map(c => c.id === id ? { ...c, ...values } : c))
      window.dispatchEvent(new CustomEvent('clientDataChanged'))
    }
    return { data, error: err }
  }, [])

  const deleteClient = useCallback(async (id: string) => {
    // Delete associated pets first (cascade)
    await supabase.from('pets').delete().eq('client_id', id)
    // Then delete the client
    const { error: err } = await supabase.from('clients').delete().eq('id', id)
    if (!err) {
      setClients(prev => prev.filter(c => c.id !== id))
      window.dispatchEvent(new CustomEvent('clientDataChanged'))
    }
    return { error: err }
  }, [])

  return { clients, loading, error, refetch: fetchClients, addClient, updateClient, deleteClient }
}
