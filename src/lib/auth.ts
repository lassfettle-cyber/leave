import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { Profile } from '@/types/database'

export interface AuthUser {
  id: string
  email: string
  profile?: Profile
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export const authService = {





  // Sign out (client-side - just remove token)
  signOut(): void {
    // In a real app, you might want to invalidate the token on the server
    // For now, we'll just rely on client-side token removal
  }
}
