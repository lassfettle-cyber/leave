'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import PasswordInput from '@/components/PasswordInput'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<'otp' | 'profile'>('otp')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [otpData, setOtpData] = useState({
    email: '',
    otpCode: ''
  })

  const [profileData, setProfileData] = useState({
    password: '',
    confirmPassword: ''
  })

  const [inviteData, setInviteData] = useState<any>(null)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      const email = sp.get('email')
      if (email) {
        setOtpData(prev => ({ ...prev, email }))
      }
    }
  }, [])


  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/verify-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: otpData.email,
          otpCode: otpData.otpCode
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setInviteData(result.invite)
        setStep('profile')
        setSuccess('OTP verified successfully! Please set up your password.')
      } else {
        setError(result.error || 'Invalid OTP code')
      }
    } catch (error) {
      console.error('Error verifying OTP:', error)
      setError('An error occurred while verifying OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (profileData.password !== profileData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (profileData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: otpData.email,
          otpCode: otpData.otpCode,
          password: profileData.password
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setSuccess('Registration completed successfully! Redirecting to login...')
        setTimeout(() => {
          router.push('/login?message=Registration completed successfully')
        }, 2000)
      } else {
        setError(result.error || 'Failed to complete registration')
      }
    } catch (error) {
      console.error('Error completing registration:', error)
      setError('An error occurred while completing registration')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (step === 'otp') {
      setOtpData(prev => ({ ...prev, [name]: value }))
    } else {
      setProfileData(prev => ({ ...prev, [name]: value }))
    }
  }

  return (
    <Suspense fallback={null}>
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">🏢</h1>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Complete Your Registration
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {step === 'otp'
                ? 'Enter your email and the OTP code from your invitation email'
                : 'Set up your password to complete registration'
              }
            </p>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            {/* Messages */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}

            {step === 'otp' ? (
              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={otpData.email}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="otpCode" className="block text-sm font-medium text-gray-700">
                    OTP Code
                  </label>
                  <input
                    type="text"
                    id="otpCode"
                    name="otpCode"
                    value={otpData.otpCode}
                    onChange={handleInputChange}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                {inviteData && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <h3 className="text-sm font-medium text-blue-800">Welcome!</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Setting up account for <strong>{inviteData.first_name} {inviteData.last_name}</strong> as <strong>{inviteData.role}</strong>
                    </p>
                  </div>
                )}

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <PasswordInput
                    id="password"
                    name="password"
                    value={profileData.password}
                    onChange={handleInputChange}
                    required
                    minLength={6}
                  />
                  <p className="mt-1 text-xs text-gray-500">Password must be at least 6 characters long</p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirm Password
                  </label>
                  <PasswordInput
                    id="confirmPassword"
                    name="confirmPassword"
                    value={profileData.confirmPassword}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating Account...' : 'Complete Registration'}
                </button>
              </form>
            )}

            <div className="mt-6">
              <div className="text-center">
                <a
                  href="/login"
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Already have an account? Sign in
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Suspense>
  )
}
