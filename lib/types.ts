export interface Tenant {
  id: string
  name: string
  email: string
  whatsapp?: string
  plan: string
  is_active: boolean
  created_at: string
}

export interface Apartment {
  id: string
  tenant_id: string
  name: string
  address?: string
  floor?: string
  access_code?: string
  access_instructions?: string
  drive_link_photos?: string
  expected_cleaning_min: number
  is_active: boolean
  created_at: string
  // joined
  platforms?: Platform[]
  status?: 'libre' | 'occupe' | 'arrivee' | 'depart'
  next_event?: string
  next_guest?: string
}

export interface Platform {
  id: string
  slug: 'airbnb' | 'booking' | 'vrbo' | 'leboncoin'
  name: string
  color: string
}

export interface ApartmentPlatform {
  id: string
  apartment_id: string
  platform_id: string
  ical_url?: string
  last_synced_at?: string
  platform?: Platform
}

export interface Reservation {
  id: string
  apartment_id: string
  platform_id?: string
  external_id?: string
  guest_name?: string
  guest_phone?: string
  guest_whatsapp?: string
  checkin: string
  checkout: string
  status: 'confirmed' | 'cancelled' | 'completed'
  early_checkin_requested: boolean
  early_checkin_approved?: boolean
  early_checkin_fee: number
  late_checkout_requested: boolean
  late_checkout_approved?: boolean
  late_checkout_fee: number
  welcome_sent: boolean
  created_at: string
  // joined
  apartment_name?: string
  platform_slug?: string
  platform_color?: string
}

export interface Cleaner {
  id: string
  tenant_id: string
  name: string
  whatsapp: string
  is_active: boolean
}

export interface CleaningSession {
  id: string
  apartment_id: string
  cleaner_id?: string
  reservation_id?: string
  planned_start: string
  planned_end: string
  planned_duration_min?: number
  actual_duration_min?: number
  status: 'planned' | 'in_progress' | 'completed' | 'alert' | 'cancelled'
  alert_sent: boolean
  notes?: string
  // joined
  apartment_name?: string
  cleaner_name?: string
}

export interface Pointage {
  id: string
  cleaning_session_id?: string
  apartment_id: string
  cleaner_id?: string
  type: 'arrivee' | 'depart'
  heure: string
}

export interface Consumable {
  id: string
  apartment_id: string
  name: string
  label: string
  emoji: string
  level: 'full' | 'medium' | 'low' | 'empty'
  updated_at: string
  updated_by?: string
}

export interface Message {
  id: string
  reservation_id: string
  direction: 'outbound' | 'inbound'
  channel: 'whatsapp' | 'email' | 'platform'
  content: string
  is_bot: boolean
  is_read: boolean
  sent_at: string
}

export interface Alert {
  id: string
  tenant_id: string
  apartment_id?: string
  reservation_id?: string
  cleaning_session_id?: string
  type: string
  message: string
  action_required: boolean
  status: 'pending' | 'resolved' | 'dismissed'
  created_at: string
  resolved_at?: string
  // joined
  apartment_name?: string
}

export interface TodayOverview {
  tenant_id: string
  apartment_id: string
  apartment_name: string
  reservation_id?: string
  guest_name?: string
  checkin?: string
  checkout?: string
  reservation_status?: string
  today_event?: 'arrivee' | 'depart' | 'occupe'
  cleaning_session_id?: string
  cleaning_start?: string
  cleaning_status?: string
  cleaner_name?: string
}

export interface Rules {
  id: string
  tenant_id: string
  early_checkin_from?: string
  early_checkin_fee: number
  late_checkout_until?: string
  late_checkout_fee: number
  pets_allowed: boolean
  parties_allowed: boolean
  cancellation_policy?: string
  extra_notes?: string
}

export interface QrCode {
  id: string
  apartment_id: string
  token: string
  apartment_name?: string
  expected_cleaning_min?: number
}
