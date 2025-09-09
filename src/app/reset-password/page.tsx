'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [validating, setValidating] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const t = params.get('token')
      setToken(t)
      if (t) {
        // Pre-validate token
        setValidating(true)
        fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(t)}`)
          .then(async (res) => res.json())
          .then((data) => {
            if (!data.valid) {
              const reason = data.reason as 'invalid' | 'expired' | 'used' | undefined
              const msg =
                reason === 'expired'
                  ? 'This reset link has expired. Please request a new one.'
                  : reason === 'used'
                  ? 'This reset link has already been used. Please request a new one.'
                  : 'Invalid reset link. Please request a new one.'
              setError(msg)
              setTokenValid(false)
            } else {
              setTokenValid(true)
            }
          })
          .catch(() => {
            setError('Unable to validate reset link. Please try again.')
            setTokenValid(false)
          })
          .finally(() => setValidating(false))
      }
    } catch (e) {
      console.error('Failed to parse URL params', e)
    }
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Missing or invalid reset token.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }
      setSuccess(true)
      setTimeout(() => router.push('/login?message=Password%20reset%20successful'), 1200)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Reset password</h1>
        <p className="text-sm text-gray-600 mb-6">Enter a new password for your account.</p>

        {!token && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm mb-4">Missing reset token. Please copy the full link from your email.</div>
        )}

        {validating && (
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-blue-700 text-sm mb-4">Validating reset link...</div>
        )}

        {success ? (
          <div className="rounded-md bg-green-50 border border-green-200 p-4 text-green-800">Password reset successful. Redirecting to login...</div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm">{error}</div>
            )}
            <button
              type="submit"
              disabled={submitting || !token || tokenValid === false || validating}
              className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Resetting...' : 'Reset password'}
            </button>
            <div className="text-center text-sm mt-2">
              <a href="/forgot-password" className="text-blue-600 hover:underline">Request a new link</a>
              <span className="mx-2 text-gray-300">|</span>
              <a href="/login" className="text-blue-600 hover:underline">Back to login</a>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

