import { useState, useEffect, useCallback, useRef } from 'react'
import { useTenantDb } from '../context/TenantContext';
import { getOrgContext } from './useOrgContext'

export interface PetRow {
  id: string
  name: string
  species: string
  breed: string | null
  date_of_birth: string | null
  sex: string | null
  weight_kg: number | null
  photo_url: string | null
  microchip_no: string | null
  is_active: boolean
  created_at: string
  client_id: string | null
  assigned_vet_id: string | null
  clients: { id: string; first_name: string; last_name: string; phone: string | null } | null
  assigned_vet: { id: string; first_name: string; last_name: string } | null
}

export interface AddPetValues {
  client_id: string
  name: string
  species: string
  breed?: string
  date_of_birth?: string
  sex?: string
  weight_kg?: number
  microchip_no?: string
  photo_url?: string
}

export function usePets() {
  const db = useTenantDb();
  const [pets, setPets] = useState<PetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { organizationId } = await getOrgContext()
      const { data, error: err } = await db
        .from('pets')
        .select('id, name, species, breed, date_of_birth, sex, weight_kg, photo_url, microchip_no, is_active, created_at, client_id, assigned_vet_id, clients(id, first_name, last_name, phone), assigned_vet:staff!pets_assigned_vet_id_fkey(id, first_name, last_name)')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (err) {
        setError(err.message)
      } else {
        setPets((data as PetRow[]) ?? [])
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPets()
  }, [fetchPets])

  // Listen for cross-page data changes — debounced to prevent cascade storms
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handler = () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => fetchPets(), 300);
    }
    window.addEventListener('petDataChanged', handler)
    window.addEventListener('clientDataChanged', handler)
    return () => {
      window.removeEventListener('petDataChanged', handler)
      window.removeEventListener('clientDataChanged', handler)
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    }
  }, [fetchPets])

  const addPet = useCallback(async (values: AddPetValues) => {
    const { organizationId } = await getOrgContext()
    const { data, error: err } = await db
      .from('pets')
      .insert([{ organization_id: organizationId, is_active: true, ...values }])
      .select('id, name, species, breed, date_of_birth, sex, weight_kg, photo_url, microchip_no, is_active, created_at, client_id, assigned_vet_id, clients(id, first_name, last_name, phone), assigned_vet:staff!pets_assigned_vet_id_fkey(id, first_name, last_name)')
      .single()
    if (!err) {
      await fetchPets()
      window.dispatchEvent(new CustomEvent('petDataChanged'))
    }
    return { data, error: err }
  }, [fetchPets])

  const updatePet = useCallback(async (id: string, values: Partial<AddPetValues>) => {
    const { organizationId } = await getOrgContext()
    const { error: err } = await db.from('pets').update(values).eq('id', id).eq('organization_id', organizationId)
    if (!err) {
      await fetchPets()
      window.dispatchEvent(new CustomEvent('petDataChanged'))
    }
    return { error: err }
  }, [fetchPets])

  const deactivatePet = useCallback(async (id: string) => {
    const { organizationId } = await getOrgContext()
    const { error: err } = await db.from('pets').update({ is_active: false }).eq('id', id).eq('organization_id', organizationId)
    if (!err) {
      setPets(prev => prev.filter(p => p.id !== id))
      window.dispatchEvent(new CustomEvent('petDataChanged'))
    }
    return { error: err }
  }, [])

  return { pets, loading, error, refetch: fetchPets, addPet, updatePet, deactivatePet }
}
