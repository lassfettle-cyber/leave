import { db } from './db'
import type { Profile, LeaveRequest, LeaveBalance, SystemSettings } from '@/types/database'

// Profile operations
export const profileService = {
  async getProfile(userId: string): Promise<Profile | null> {
    try {
      const result = await db.query(
        'SELECT * FROM profiles WHERE id = $1',
        [userId]
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0] as Profile
    } catch (error) {
      console.error('Error in getProfile:', error)
      return null
    }
  },

  async createProfile(userId: string, profile: Omit<Profile, 'id' | 'created_at' | 'updated_at'>): Promise<Profile | null> {
    try {
      const result = await db.query(
        `INSERT INTO profiles (id, first_name, other_names, last_name, phone, email, password_hash, role, leave_cycle_start)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          userId,
          profile.first_name,
          profile.other_names,
          profile.last_name,
          profile.phone,
          profile.email,
          profile.password_hash,
          profile.role,
          profile.leave_cycle_start
        ]
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0] as Profile
    } catch (error) {
      console.error('Error in createProfile:', error)
      return null
    }
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile | null> {
    try {
      const setClause = []
      const values = []
      let paramIndex = 1

      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'created_at') {
          setClause.push(`${key} = $${paramIndex}`)
          values.push(value)
          paramIndex++
        }
      }

      if (setClause.length === 0) {
        return await this.getProfile(userId)
      }

      setClause.push(`updated_at = NOW()`)
      values.push(userId)

      const result = await db.query(
        `UPDATE profiles SET ${setClause.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0] as Profile
    } catch (error) {
      console.error('Error updating profile:', error)
      return null
    }
  },

  async getAllProfiles(): Promise<Profile[]> {
    try {
      const result = await db.query(
        'SELECT * FROM profiles ORDER BY created_at DESC'
      )

      return result.rows as Profile[]
    } catch (error) {
      console.error('Error fetching profiles:', error)
      return []
    }
  },

  async checkAdminExists(): Promise<boolean> {
    try {
      const result = await db.query(
        'SELECT id FROM profiles WHERE role = $1 LIMIT 1',
        ['admin']
      )

      return result.rows.length > 0
    } catch (error) {
      console.error('Error in checkAdminExists:', error)
      return false
    }
  }
}

// Leave request operations
export const leaveRequestService = {
  async createLeaveRequest(request: Omit<LeaveRequest, 'id' | 'created_at'>): Promise<LeaveRequest | null> {
    try {
      const result = await db.query(
        `INSERT INTO leave_requests (user_id, start_date, end_date, days, status, reason, admin_notes, approved_by, approved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          request.user_id,
          request.start_date,
          request.end_date,
          request.days,
          request.status,
          request.reason,
          request.admin_notes,
          request.approved_by,
          request.approved_at
        ]
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0] as LeaveRequest
    } catch (error) {
      console.error('Error creating leave request:', error)
      return null
    }
  },

  async getPendingRequests() {
    try {
      const result = await db.query('SELECT * FROM v_pending_requests')
      return result.rows
    } catch (error) {
      console.error('Error fetching pending requests:', error)
      return []
    }
  },

  async approveLeaveRequest(requestId: string, adminId: string, adminNotes?: string): Promise<boolean> {
    try {
      const result = await db.query(
        'SELECT fn_approve_leave($1, $2, $3) as success',
        [requestId, adminId, adminNotes]
      )

      return result.rows[0]?.success || false
    } catch (error) {
      console.error('Error approving leave request:', error)
      return false
    }
  },

  async denyLeaveRequest(requestId: string, adminId: string, adminNotes?: string): Promise<boolean> {
    try {
      const result = await db.query(
        'SELECT fn_deny_leave($1, $2, $3) as success',
        [requestId, adminId, adminNotes]
      )

      return result.rows[0]?.success || false
    } catch (error) {
      console.error('Error denying leave request:', error)
      return false
    }
  }
}

// Leave balance operations
export const leaveBalanceService = {
  async getUserBalance(userId: string, year?: number): Promise<LeaveBalance | null> {
    try {
      const currentYear = year || new Date().getFullYear()

      const result = await db.query(
        'SELECT * FROM leave_balances WHERE user_id = $1 AND year = $2',
        [userId, currentYear]
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0] as LeaveBalance
    } catch (error) {
      console.error('Error fetching leave balance:', error)
      return null
    }
  },

  async createLeaveBalance(balance: Omit<LeaveBalance, 'id' | 'created_at' | 'updated_at'>): Promise<LeaveBalance | null> {
    try {
      const result = await db.query(
        `INSERT INTO leave_balances (user_id, year, days_allocated, days_used)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [balance.user_id, balance.year, balance.days_allocated, balance.days_used]
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0] as LeaveBalance
    } catch (error) {
      console.error('Error creating leave balance:', error)
      return null
    }
  },

  async updateLeaveBalance(balanceId: string, updates: Partial<LeaveBalance>): Promise<LeaveBalance | null> {
    try {
      const setClause = []
      const values = []
      let paramIndex = 1

      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'created_at') {
          setClause.push(`${key} = $${paramIndex}`)
          values.push(value)
          paramIndex++
        }
      }

      if (setClause.length === 0) {
        return null
      }

      setClause.push(`updated_at = NOW()`)
      values.push(balanceId)

      const result = await db.query(
        `UPDATE leave_balances SET ${setClause.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0] as LeaveBalance
    } catch (error) {
      console.error('Error updating leave balance:', error)
      return null
    }
  }
}

// System settings operations
export const systemSettingsService = {
  async getSettings(): Promise<SystemSettings | null> {
    try {
      const result = await db.query('SELECT * FROM system_settings LIMIT 1')

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0] as SystemSettings
    } catch (error) {
      console.error('Error fetching system settings:', error)
      return null
    }
  },

  async updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings | null> {
    try {
      const currentSettings = await this.getSettings()
      if (!currentSettings) {
        return null
      }

      const setClause = []
      const values = []
      let paramIndex = 1

      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'created_at') {
          setClause.push(`${key} = $${paramIndex}`)
          values.push(value)
          paramIndex++
        }
      }

      if (setClause.length === 0) {
        return currentSettings
      }

      setClause.push(`updated_at = NOW()`)
      values.push(currentSettings.id)

      const result = await db.query(
        `UPDATE system_settings SET ${setClause.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0] as SystemSettings
    } catch (error) {
      console.error('Error updating system settings:', error)
      return null
    }
  }
}
