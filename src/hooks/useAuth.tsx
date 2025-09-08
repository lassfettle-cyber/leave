'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { authService, AuthUser } from '@/lib/auth'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => void
  setUser: (user: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial user from stored token
    const getInitialUser = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        if (token) {
          // Verify token with API
          const response = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token })
          })

          if (response.ok) {
            const result = await response.json()
            if (result.success) {
              setUser(result.user)
            } else {
              localStorage.removeItem('auth_token')
            }
          } else {
            localStorage.removeItem('auth_token')
          }
        }
      } catch (error) {
        console.error('Error getting initial user:', error)
        localStorage.removeItem('auth_token')
      } finally {
        setLoading(false)
      }
    }

    getInitialUser()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        localStorage.setItem('auth_token', result.token)
        setUser(result.user)
        return { success: true }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' }
    }
  }

  const signOut = () => {
    localStorage.removeItem('auth_token')
    authService.signOut()
    setUser(null)
  }

  const value = {
    user,
    loading,
    signIn,
    signOut,
    setUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
