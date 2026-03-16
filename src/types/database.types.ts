export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          checkout_done_at: string | null
          client_id: string
          clinic_id: string
          created_at: string
          created_by: string | null
          duration_minutes: number
          id: string
          notes: string | null
          organization_id: string
          pet_id: string
          reason: string | null
          room: string | null
          scheduled_at: string
          service_id: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          type: Database["public"]["Enums"]["service_category"] | null
          updated_at: string
          vet_id: string | null
          visit_started_at: string | null
        }
        Insert: {
          checkout_done_at?: string | null
          client_id: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          organization_id: string
          pet_id: string
          reason?: string | null
          room?: string | null
          scheduled_at: string
          service_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: Database["public"]["Enums"]["service_category"] | null
          updated_at?: string
          vet_id?: string | null
          visit_started_at?: string | null
        }
        Update: {
          checkout_done_at?: string | null
          client_id?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          organization_id?: string
          pet_id?: string
          reason?: string | null
          room?: string | null
          scheduled_at?: string
          service_id?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: Database["public"]["Enums"]["service_category"] | null
          updated_at?: string
          vet_id?: string | null
          visit_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "appointments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "appointments_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          actor_name: string | null
          clinic_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
          resource_id: string | null
          resource_label: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_name?: string | null
          clinic_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          resource_id?: string | null
          resource_label?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_name?: string | null
          clinic_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          resource_id?: string | null
          resource_label?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          avatar_color: string | null
          city: string | null
          clinic_id: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          notes: string | null
          organization_id: string
          phone: string | null
          portal_last_login_at: string | null
          portal_reminder_sent_at: string | null
          portal_status: Database["public"]["Enums"]["portal_account_status"]
          profile_id: string | null
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          avatar_color?: string | null
          city?: string | null
          clinic_id?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          portal_last_login_at?: string | null
          portal_reminder_sent_at?: string | null
          portal_status?: Database["public"]["Enums"]["portal_account_status"]
          profile_id?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          avatar_color?: string | null
          city?: string | null
          clinic_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          portal_last_login_at?: string | null
          portal_reminder_sent_at?: string | null
          portal_status?: Database["public"]["Enums"]["portal_account_status"]
          profile_id?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "clients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "clients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          city: string | null
          country: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          phone: string | null
          state: string | null
          timezone: string
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          phone?: string | null
          state?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
          state?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_admin: boolean
          joined_at: string
          last_read_at: string | null
          profile_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          last_read_at?: string | null
          profile_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          last_read_at?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_color: string | null
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          title: string | null
          type: Database["public"]["Enums"]["conversation_type"]
          updated_at: string
        }
        Insert: {
          avatar_color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          title?: string | null
          type?: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string
        }
        Update: {
          avatar_color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          title?: string | null
          type?: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          service_id: string | null
          tax_rate: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          service_id?: string | null
          tax_rate?: number
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          service_id?: string | null
          tax_rate?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          appointment_id: string | null
          client_id: string
          clinic_id: string
          created_at: string
          created_by: string | null
          discount_amount: number
          due_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          organization_id: string
          paid_at: string | null
          record_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          appointment_id?: string | null
          client_id: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          due_date?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          record_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          appointment_id?: string | null
          client_id?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          record_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          clinic_id: string
          created_at: string
          flag: Database["public"]["Enums"]["lab_flag"]
          id: string
          notes: string | null
          ordered_by: string | null
          pet_id: string
          record_id: string | null
          reference_range: string | null
          reported_at: string | null
          result_value: string
          test_name: string
          test_panel: string | null
          tested_at: string
          unit: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          flag?: Database["public"]["Enums"]["lab_flag"]
          id?: string
          notes?: string | null
          ordered_by?: string | null
          pet_id: string
          record_id?: string | null
          reference_range?: string | null
          reported_at?: string | null
          result_value: string
          test_name: string
          test_panel?: string | null
          tested_at?: string
          unit?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          flag?: Database["public"]["Enums"]["lab_flag"]
          id?: string
          notes?: string | null
          ordered_by?: string | null
          pet_id?: string
          record_id?: string | null
          reference_range?: string | null
          reported_at?: string | null
          result_value?: string
          test_name?: string
          test_panel?: string | null
          tested_at?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "lab_results_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "lab_results_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "lab_results_ordered_by_fkey"
            columns: ["ordered_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_ordered_by_fkey"
            columns: ["ordered_by"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "lab_results_ordered_by_fkey"
            columns: ["ordered_by"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "lab_results_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "lab_results_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "lab_results_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_records: {
        Row: {
          amended_at: string | null
          amended_by: string | null
          appointment_id: string | null
          client_id: string
          clinic_id: string
          clinical_notes: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          follow_up_date: string | null
          follow_up_notes: string | null
          follow_up_reason: string | null
          id: string
          pet_id: string
          reason: string | null
          record_number: string
          record_type: Database["public"]["Enums"]["record_type"]
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
          vet_id: string | null
          visit_date: string
          visit_time: string | null
        }
        Insert: {
          amended_at?: string | null
          amended_by?: string | null
          appointment_id?: string | null
          client_id: string
          clinic_id: string
          clinical_notes?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          follow_up_date?: string | null
          follow_up_notes?: string | null
          follow_up_reason?: string | null
          id?: string
          pet_id: string
          reason?: string | null
          record_number: string
          record_type?: Database["public"]["Enums"]["record_type"]
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          vet_id?: string | null
          visit_date: string
          visit_time?: string | null
        }
        Update: {
          amended_at?: string | null
          amended_by?: string | null
          appointment_id?: string | null
          client_id?: string
          clinic_id?: string
          clinical_notes?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          follow_up_date?: string | null
          follow_up_notes?: string | null
          follow_up_reason?: string | null
          id?: string
          pet_id?: string
          reason?: string | null
          record_number?: string
          record_type?: Database["public"]["Enums"]["record_type"]
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          vet_id?: string | null
          visit_date?: string
          visit_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_amended_by_fkey"
            columns: ["amended_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_amended_by_fkey"
            columns: ["amended_by"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "medical_records_amended_by_fkey"
            columns: ["amended_by"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "medical_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "medical_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "medical_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "medical_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "medical_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "medical_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "medical_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "medical_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "medical_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "medical_records_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "medical_records_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          dosage: string
          duration_days: number | null
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          pet_id: string
          prescribed_by: string | null
          record_id: string | null
          refills_remaining: number
          route: Database["public"]["Enums"]["medication_route"]
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dosage: string
          duration_days?: number | null
          end_date?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          pet_id: string
          prescribed_by?: string | null
          record_id?: string | null
          refills_remaining?: number
          route?: Database["public"]["Enums"]["medication_route"]
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dosage?: string
          duration_days?: number | null
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          pet_id?: string
          prescribed_by?: string | null
          record_id?: string | null
          refills_remaining?: number
          route?: Database["public"]["Enums"]["medication_route"]
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "medications_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "medications_prescribed_by_fkey"
            columns: ["prescribed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_prescribed_by_fkey"
            columns: ["prescribed_by"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "medications_prescribed_by_fkey"
            columns: ["prescribed_by"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "medications_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          edited_at: string | null
          id: string
          is_edited: boolean
          reply_to_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          profile_id: string
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          profile_id: string
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          profile_id?: string
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_billing: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          client_count: number
          clients_per_block: number
          created_at: string
          free_client_tier: number
          id: string
          next_billing_date: string | null
          organization_id: string
          plan: Database["public"]["Enums"]["org_plan"]
          price_per_client_block: number
          price_per_seat: number
          seat_count: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          client_count?: number
          clients_per_block?: number
          created_at?: string
          free_client_tier?: number
          id?: string
          next_billing_date?: string | null
          organization_id: string
          plan?: Database["public"]["Enums"]["org_plan"]
          price_per_client_block?: number
          price_per_seat?: number
          seat_count?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          client_count?: number
          clients_per_block?: number
          created_at?: string
          free_client_tier?: number
          id?: string
          next_billing_date?: string | null
          organization_id?: string
          plan?: Database["public"]["Enums"]["org_plan"]
          price_per_client_block?: number
          price_per_seat?: number
          seat_count?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_billing_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_email: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          plan: Database["public"]["Enums"]["org_plan"]
          plan_expires_at: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          plan?: Database["public"]["Enums"]["org_plan"]
          plan_expires_at?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          plan?: Database["public"]["Enums"]["org_plan"]
          plan_expires_at?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string
          processed_by: string | null
          reference_no: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          processed_by?: string | null
          reference_no?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          processed_by?: string | null
          reference_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "payments_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
        ]
      }
      pet_weight_history: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          pet_id: string
          recorded_at: string
          recorded_by: string | null
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          pet_id: string
          recorded_at?: string
          recorded_by?: string | null
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          pet_id?: string
          recorded_at?: string
          recorded_by?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "pet_weight_history_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_weight_history_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "pet_weight_history_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "pet_weight_history_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_weight_history_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "pet_weight_history_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
        ]
      }
      pets: {
        Row: {
          breed: string | null
          client_id: string
          clinic_id: string | null
          color: string | null
          created_at: string
          date_of_birth: string | null
          id: string
          insurance_no: string | null
          is_active: boolean
          microchip_no: string | null
          name: string
          notes: string | null
          photo_url: string | null
          sex: Database["public"]["Enums"]["pet_sex"]
          species: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          breed?: string | null
          client_id: string
          clinic_id?: string | null
          color?: string | null
          created_at?: string
          date_of_birth?: string | null
          id?: string
          insurance_no?: string | null
          is_active?: boolean
          microchip_no?: string | null
          name: string
          notes?: string | null
          photo_url?: string | null
          sex?: Database["public"]["Enums"]["pet_sex"]
          species: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          breed?: string | null
          client_id?: string
          clinic_id?: string | null
          color?: string | null
          created_at?: string
          date_of_birth?: string | null
          id?: string
          insurance_no?: string | null
          is_active?: boolean
          microchip_no?: string | null
          name?: string
          notes?: string | null
          photo_url?: string | null
          sex?: Database["public"]["Enums"]["pet_sex"]
          species?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "pets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "pets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "pets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "pets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "pets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["clinic_id"]
          },
        ]
      }
      platform_invoices: {
        Row: {
          client_cost: number
          created_at: string
          id: string
          organization_id: string
          paid_at: string | null
          period_end: string
          period_start: string
          seat_cost: number
          status: Database["public"]["Enums"]["invoice_status"]
          total: number
        }
        Insert: {
          client_cost?: number
          created_at?: string
          id?: string
          organization_id: string
          paid_at?: string | null
          period_end: string
          period_start: string
          seat_cost?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          total?: number
        }
        Update: {
          client_cost?: number
          created_at?: string
          id?: string
          organization_id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          seat_cost?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          organization_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_color?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id: string
          is_active?: boolean
          last_name?: string
          organization_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_color?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          organization_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      record_diagnoses: {
        Row: {
          created_at: string
          description: string
          icd_code: string | null
          id: string
          notes: string | null
          record_id: string
          type: Database["public"]["Enums"]["diagnosis_type"]
        }
        Insert: {
          created_at?: string
          description: string
          icd_code?: string | null
          id?: string
          notes?: string | null
          record_id: string
          type?: Database["public"]["Enums"]["diagnosis_type"]
        }
        Update: {
          created_at?: string
          description?: string
          icd_code?: string | null
          id?: string
          notes?: string | null
          record_id?: string
          type?: Database["public"]["Enums"]["diagnosis_type"]
        }
        Relationships: [
          {
            foreignKeyName: "record_diagnoses_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_diagnoses_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      record_treatments: {
        Row: {
          activity_restrictions: string | null
          created_at: string
          description: string | null
          home_care_plan: string | null
          id: string
          performed_at: string | null
          performed_by: string | null
          post_visit_instructions: string | null
          procedure_name: string
          record_id: string
        }
        Insert: {
          activity_restrictions?: string | null
          created_at?: string
          description?: string | null
          home_care_plan?: string | null
          id?: string
          performed_at?: string | null
          performed_by?: string | null
          post_visit_instructions?: string | null
          procedure_name: string
          record_id: string
        }
        Update: {
          activity_restrictions?: string | null
          created_at?: string
          description?: string | null
          home_care_plan?: string | null
          id?: string
          performed_at?: string | null
          performed_by?: string | null
          post_visit_instructions?: string | null
          procedure_name?: string
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_treatments_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_treatments_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "record_treatments_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "record_treatments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_treatments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      record_vitals: {
        Row: {
          blood_pressure_diastolic: number | null
          blood_pressure_systolic: number | null
          body_condition_score: number | null
          capillary_refill_time_s: number | null
          created_at: string
          heart_rate_bpm: number | null
          hydration_status: string | null
          id: string
          mucous_membrane_color: string | null
          notes: string | null
          pain_score: number | null
          record_id: string
          respiratory_rate_bpm: number | null
          temperature_c: number | null
          weight_kg: number | null
        }
        Insert: {
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          body_condition_score?: number | null
          capillary_refill_time_s?: number | null
          created_at?: string
          heart_rate_bpm?: number | null
          hydration_status?: string | null
          id?: string
          mucous_membrane_color?: string | null
          notes?: string | null
          pain_score?: number | null
          record_id: string
          respiratory_rate_bpm?: number | null
          temperature_c?: number | null
          weight_kg?: number | null
        }
        Update: {
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          body_condition_score?: number | null
          capillary_refill_time_s?: number | null
          created_at?: string
          heart_rate_bpm?: number | null
          hydration_status?: string | null
          id?: string
          mucous_membrane_color?: string | null
          notes?: string | null
          pain_score?: number | null
          record_id?: string
          respiratory_rate_bpm?: number | null
          temperature_c?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "record_vitals_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: true
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_vitals_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: true
            referencedRelation: "v_record_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          is_popular: boolean
          is_taxable: boolean
          name: string
          organization_id: string
          price: number
          sku: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          is_popular?: boolean
          is_taxable?: boolean
          name: string
          organization_id: string
          price?: number
          sku?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          is_popular?: boolean
          is_taxable?: boolean
          name?: string
          organization_id?: string
          price?: number
          sku?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          avatar_color: string | null
          avg_rating: number | null
          bio: string | null
          clinic_id: string
          created_at: string
          department: Database["public"]["Enums"]["staff_department"]
          email: string | null
          emergency_contact: string | null
          first_name: string
          id: string
          last_name: string
          license_no: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          profile_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          schedule: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["staff_status"]
          total_appointments: number
          updated_at: string
        }
        Insert: {
          avatar_color?: string | null
          avg_rating?: number | null
          bio?: string | null
          clinic_id: string
          created_at?: string
          department?: Database["public"]["Enums"]["staff_department"]
          email?: string | null
          emergency_contact?: string | null
          first_name: string
          id?: string
          last_name: string
          license_no?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          profile_id?: string | null
          role: Database["public"]["Enums"]["user_role"]
          schedule?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["staff_status"]
          total_appointments?: number
          updated_at?: string
        }
        Update: {
          avatar_color?: string | null
          avg_rating?: number | null
          bio?: string | null
          clinic_id?: string
          created_at?: string
          department?: Database["public"]["Enums"]["staff_department"]
          email?: string | null
          emergency_contact?: string | null
          first_name?: string
          id?: string
          last_name?: string
          license_no?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          schedule?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["staff_status"]
          total_appointments?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "staff_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "staff_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "staff_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_ratings: {
        Row: {
          client_id: string | null
          comment: string | null
          created_at: string
          id: string
          rating: number
          staff_id: string
        }
        Insert: {
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          staff_id: string
        }
        Update: {
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_ratings_client_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_ratings_client_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "staff_ratings_client_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "staff_ratings_client_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_ratings_client_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "staff_ratings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_ratings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "staff_ratings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
        ]
      }
      staff_specializations: {
        Row: {
          created_at: string
          id: string
          specialization: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          specialization: string
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          specialization?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_specializations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_specializations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "staff_specializations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          clinic_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          priority: Database["public"]["Enums"]["task_priority"]
          related_id: string | null
          related_type: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          clinic_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          priority?: Database["public"]["Enums"]["task_priority"]
          related_id?: string | null
          related_type?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          clinic_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          related_id?: string | null
          related_type?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "tasks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "tasks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "tasks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccinations: {
        Row: {
          administered_by: string | null
          administered_date: string
          certificate_no: string | null
          clinic_id: string | null
          created_at: string
          expiry_date: string | null
          id: string
          injection_site: string | null
          lot_number: string | null
          manufacturer: string | null
          next_due_date: string | null
          notes: string | null
          pet_id: string
          record_id: string | null
          serial_number: string | null
          vaccine_name: string
        }
        Insert: {
          administered_by?: string | null
          administered_date: string
          certificate_no?: string | null
          clinic_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          injection_site?: string | null
          lot_number?: string | null
          manufacturer?: string | null
          next_due_date?: string | null
          notes?: string | null
          pet_id: string
          record_id?: string | null
          serial_number?: string | null
          vaccine_name: string
        }
        Update: {
          administered_by?: string | null
          administered_date?: string
          certificate_no?: string | null
          clinic_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          injection_site?: string | null
          lot_number?: string | null
          manufacturer?: string | null
          next_due_date?: string | null
          notes?: string | null
          pet_id?: string
          record_id?: string | null
          serial_number?: string | null
          vaccine_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccinations_administered_by_fkey"
            columns: ["administered_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_administered_by_fkey"
            columns: ["administered_by"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "vaccinations_administered_by_fkey"
            columns: ["administered_by"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["vet_id"]
          },
          {
            foreignKeyName: "vaccinations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "vaccinations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_summary"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "vaccinations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["clinic_id"]
          },
          {
            foreignKeyName: "vaccinations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "v_appointment_cards"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "vaccinations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "vaccinations_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "v_record_cards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_appointment_cards: {
        Row: {
          client_email: string | null
          client_first: string | null
          client_id: string | null
          client_last: string | null
          client_phone: string | null
          clinic_id: string | null
          clinic_name: string | null
          duration_minutes: number | null
          id: string | null
          notes: string | null
          pet_breed: string | null
          pet_id: string | null
          pet_name: string | null
          pet_photo: string | null
          pet_species: string | null
          reason: string | null
          room: string | null
          scheduled_at: string | null
          service_name: string | null
          service_price: number | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          type: Database["public"]["Enums"]["service_category"] | null
          vet_first: string | null
          vet_id: string | null
          vet_last: string | null
          vet_role: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: []
      }
      v_invoice_summary: {
        Row: {
          amount_paid: number | null
          balance_due: number | null
          client_email: string | null
          client_first: string | null
          client_id: string | null
          client_last: string | null
          clinic_id: string | null
          clinic_name: string | null
          created_at: string | null
          discount_amount: number | null
          due_date: string | null
          id: string | null
          invoice_number: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number | null
          tax_amount: number | null
          total: number | null
        }
        Relationships: []
      }
      v_portal_users: {
        Row: {
          account_created: string | null
          clinic_name: string | null
          email: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          pets: Json | null
          phone: string | null
          portal_last_login_at: string | null
          portal_reminder_sent_at: string | null
          portal_status:
            | Database["public"]["Enums"]["portal_account_status"]
            | null
        }
        Relationships: []
      }
      v_record_cards: {
        Row: {
          client_first: string | null
          client_id: string | null
          client_last: string | null
          clinic_id: string | null
          clinic_name: string | null
          clinical_notes: string | null
          id: string | null
          pet_breed: string | null
          pet_id: string | null
          pet_name: string | null
          pet_photo: string | null
          pet_species: string | null
          reason: string | null
          record_number: string | null
          record_type: Database["public"]["Enums"]["record_type"] | null
          status: Database["public"]["Enums"]["record_status"] | null
          vet_first: string | null
          vet_id: string | null
          vet_last: string | null
          visit_date: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_org_id: { Args: never; Returns: string }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_clinic_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      appointment_status:
        | "Scheduled"
        | "Confirmed"
        | "In Progress"
        | "Completed"
        | "Cancelled"
        | "No Show"
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "login"
        | "logout"
        | "export"
        | "reminder_sent"
        | "account_deactivated"
      billing_cycle: "monthly" | "annual"
      conversation_type: "direct" | "group"
      diagnosis_type: "primary" | "secondary" | "differential"
      invoice_status:
        | "Draft"
        | "Sent"
        | "Paid"
        | "Partial"
        | "Overdue"
        | "Cancelled"
      lab_flag: "normal" | "high" | "low" | "critical"
      medication_route:
        | "Oral"
        | "Topical"
        | "Injectable"
        | "Ophthalmic"
        | "Otic"
        | "Nasal"
        | "Transdermal"
        | "Inhaled"
      org_plan: "starter" | "growth" | "enterprise"
      payment_method:
        | "Credit Card"
        | "Debit Card"
        | "Cash"
        | "Check"
        | "Insurance"
        | "Financing"
        | "Other"
      pet_sex:
        | "Male"
        | "Female"
        | "Male (Neutered)"
        | "Female (Spayed)"
        | "Unknown"
      portal_account_status: "Active" | "Inactive" | "Warned" | "Suspended"
      record_status: "Draft" | "Pending Review" | "Amended" | "Final"
      record_type:
        | "Visit"
        | "Vaccination"
        | "Lab Result"
        | "Surgery"
        | "Prescription"
        | "Dental"
        | "Imaging"
      service_category:
        | "Wellness"
        | "Vaccinations"
        | "Surgery"
        | "Dental"
        | "Lab & Imaging"
        | "Emergency"
        | "Prescriptions"
        | "Specialist"
      staff_department:
        | "Clinical"
        | "Front Desk"
        | "Management"
        | "Support"
        | "Lab"
      staff_status: "Active" | "On Leave" | "Inactive" | "Probation"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "done" | "cancelled"
      user_role:
        | "superadmin"
        | "clinic_manager"
        | "veterinarian"
        | "senior_veterinarian"
        | "lead_vet_tech"
        | "vet_technician"
        | "front_desk_manager"
        | "receptionist"
        | "groomer"
        | "lab_technician"
        | "specialist"
        | "owner"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: [
        "Scheduled",
        "Confirmed",
        "In Progress",
        "Completed",
        "Cancelled",
        "No Show",
      ],
      audit_action: [
        "create",
        "update",
        "delete",
        "login",
        "logout",
        "export",
        "reminder_sent",
        "account_deactivated",
      ],
      billing_cycle: ["monthly", "annual"],
      conversation_type: ["direct", "group"],
      diagnosis_type: ["primary", "secondary", "differential"],
      invoice_status: [
        "Draft",
        "Sent",
        "Paid",
        "Partial",
        "Overdue",
        "Cancelled",
      ],
      lab_flag: ["normal", "high", "low", "critical"],
      medication_route: [
        "Oral",
        "Topical",
        "Injectable",
        "Ophthalmic",
        "Otic",
        "Nasal",
        "Transdermal",
        "Inhaled",
      ],
      org_plan: ["starter", "growth", "enterprise"],
      payment_method: [
        "Credit Card",
        "Debit Card",
        "Cash",
        "Check",
        "Insurance",
        "Financing",
        "Other",
      ],
      pet_sex: [
        "Male",
        "Female",
        "Male (Neutered)",
        "Female (Spayed)",
        "Unknown",
      ],
      portal_account_status: ["Active", "Inactive", "Warned", "Suspended"],
      record_status: ["Draft", "Pending Review", "Amended", "Final"],
      record_type: [
        "Visit",
        "Vaccination",
        "Lab Result",
        "Surgery",
        "Prescription",
        "Dental",
        "Imaging",
      ],
      service_category: [
        "Wellness",
        "Vaccinations",
        "Surgery",
        "Dental",
        "Lab & Imaging",
        "Emergency",
        "Prescriptions",
        "Specialist",
      ],
      staff_department: [
        "Clinical",
        "Front Desk",
        "Management",
        "Support",
        "Lab",
      ],
      staff_status: ["Active", "On Leave", "Inactive", "Probation"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "done", "cancelled"],
      user_role: [
        "superadmin",
        "clinic_manager",
        "veterinarian",
        "senior_veterinarian",
        "lead_vet_tech",
        "vet_technician",
        "front_desk_manager",
        "receptionist",
        "groomer",
        "lab_technician",
        "specialist",
        "owner",
      ],
    },
  },
} as const
