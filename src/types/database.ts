export interface Profile {
  id: string
  first_name: string
  other_names?: string
  last_name: string
  phone: string
  email: string
  password_hash?: string
  role: 'admin' | 'employee'
  position?: 'captain' | 'first_officer'
  leave_cycle_start: string
  created_at: string
  updated_at: string
}

export interface LeaveRequest {
  id: string
  user_id: string
  start_date: string
  end_date: string
  days: number
  status: 'pending' | 'approved' | 'denied' | 'cancelled'
  reason: string
  admin_notes?: string
  created_at: string
  approved_by?: string
  approved_at?: string
}

export interface LeaveBalance {
  id: string
  user_id: string
  year: number
  days_allocated: number
  days_used: number
  created_at: string
  updated_at: string
}

export interface SystemSettings {
  id: string
  default_leave_days: number
  leave_year_start_month: number
  max_carry_over_days: number
  email_notifications_enabled: boolean
  created_at: string
  updated_at: string
}

export interface Invite {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string
  role: 'admin' | 'employee'
  position?: 'captain' | 'first_officer'
  days_allocated: number
  otp_code: string
  expires_at: string
  used: boolean
  created_by: string
  created_at: string
  updated_at: string
}

// View types
export interface PendingRequest extends LeaveRequest {
  first_name: string
  last_name: string
  full_name: string
  role: string
  position?: 'captain' | 'first_officer'
}

export interface UserWithRemainingLeave {
  id: string
  first_name: string
  last_name: string
  full_name: string
  phone: string
  days_allocated: number
  days_used: number
  days_remaining: number
  year: number
}

export interface UpcomingLeave extends LeaveRequest {
  first_name: string
  last_name: string
  full_name: string
}
