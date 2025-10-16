'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import type { Profile, Invite } from '@/types/database'

export default function UserManagementPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [inviteData, setInviteData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'employee' as 'admin' | 'employee',
    position: 'captain' as 'captain' | 'first_officer',
    daysAllocated: 25
  })
  const [showEditForm, setShowEditForm] = useState(false)
  const [editUser, setEditUser] = useState<Profile | null>(null)
  const [editData, setEditData] = useState({
    first_name: '',
    other_names: '',
    last_name: '',
    phone: '',
    role: 'employee' as 'admin' | 'employee',
    leave_cycle_start: ''
  })
  const [showAllocationForm, setShowAllocationForm] = useState(false)
  const [allocationUser, setAllocationUser] = useState<Profile | null>(null)
  const [allocationDays, setAllocationDays] = useState<number>(25)



  useEffect(() => {
    if (user?.profile?.role === 'admin') {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const headers = {
        'Authorization': `Bearer ${token}`
      }

      // Load users and invites
      const [usersRes, invitesRes] = await Promise.all([
        fetch('/api/users', { headers }),
        fetch('/api/invites', { headers })
      ])

      if (usersRes.ok) {
        const result = await usersRes.json()
        if (result.success) setUsers(result.data)
      }

      if (invitesRes.ok) {
        const result = await invitesRes.json()
        if (result.success) setInvites(result.data)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Failed to load user data')
    } finally {
      setLoading(false)
    }
  }

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const response = await fetch('/api/invites/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(inviteData)
      })

      const result = await response.json()

      if (response.ok && result.success) {
        const emailStatus = result.emailSent
          ? 'Invite sent successfully! Email delivered to user.'
          : `Invite created successfully! ${result.emailError ? `Email delivery failed: ${result.emailError}` : 'Email service not configured.'}`

        setSuccess(emailStatus)
        setShowInviteForm(false)
        setInviteData({
          email: '',
          firstName: '',
          lastName: '',
          phone: '',
          role: 'employee',
          position: 'captain',
          daysAllocated: 25
        })
        loadData() // Refresh data
      } else {
        setError(result.error || 'Failed to send invite')
      }
    } catch (error) {
      console.error('Error sending invite:', error)
      setError('An error occurred while sending invite')
    }
  }

  const handleRevokeInvite = async (inviteId: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke the invite for ${email}?`)) {
      return
    }

    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const response = await fetch('/api/invites/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ inviteId })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setSuccess(`Invite for ${email} has been revoked successfully`)
        loadData() // Refresh data
      } else {
        setError(result.error || 'Failed to revoke invite')
      }
    } catch (error) {
      console.error('Error revoking invite:', error)
      setError('An error occurred while revoking invite')
    }
  }

  const handleResendInvite = async (inviteId: string, email: string) => {
    if (!confirm(`Are you sure you want to resend the invite to ${email}?`)) {
      return
    }

    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const response = await fetch('/api/invites/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ inviteId })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        const emailStatus = result.emailSent
          ? `Invite resent successfully to ${email}! Email delivered.`
          : `Invite updated successfully! ${result.emailError ? `Email delivery failed: ${result.emailError}` : 'Email service not configured.'}`


        setSuccess(emailStatus)
        loadData() // Refresh data
      } else {
        setError(result.error || 'Failed to resend invite')
      }
    } catch (error) {
      console.error('Error resending invite:', error)
      setError('An error occurred while resending invite')
    }
  }
  const openEdit = (u: Profile) => {
    setEditUser(u)
    setEditData({
      first_name: u.first_name,
      other_names: u.other_names || '',
      last_name: u.last_name,
      phone: u.phone,
      role: u.role,
      leave_cycle_start: u.leave_cycle_start
    })
    setShowEditForm(true)
  }

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setEditData(prev => ({ ...prev, [name]: value }))
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return
    setError('')
    setSuccess('')
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return
      const response = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editData)
      })
      const result = await response.json()
      if (response.ok && result.success) {
        setSuccess('User updated successfully')
        setShowEditForm(false)
        setEditUser(null)
        loadData()
      } else {
        setError(result.error || 'Failed to update user')
      }
    } catch (err) {

      console.error('Error updating user:', err)
      setError('An error occurred while updating user')
    }
  }


  const openAllocation = (u: Profile) => {
    setAllocationUser(u)
    setAllocationDays(25)
    setShowAllocationForm(true)
  }

  const handleAllocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!allocationUser) return
    setError('')
    setSuccess('')
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return
      const response = await fetch(`/api/users/${allocationUser.id}/leave-balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ daysAllocated: allocationDays })
      })
      const result = await response.json()
      if (response.ok && result.success) {
        setSuccess('Leave allocation added successfully')
        setShowAllocationForm(false)
        setAllocationUser(null)
        loadData()
      } else {
        setError(result.error || 'Failed to add leave allocation')
      }
    } catch (err) {
      console.error('Error adding leave allocation:', err)
      setError('An error occurred while adding leave allocation')
    }
  }

  const handleDeleteUser = async (u: Profile) => {
    const confirmMessage = `⚠️ WARNING: This action cannot be undone!\n\nYou are about to permanently delete:\n\nUser: ${u.first_name} ${u.last_name}\nEmail: ${u.email}\n\nThis will also delete:\n• All leave applications (pending, approved, denied)\n• Leave balance history\n• All user data\n\nType the user's email to confirm deletion:`

    const userInput = prompt(confirmMessage)

    if (userInput !== u.email) {
      if (userInput !== null) {
        alert('Email does not match. Deletion cancelled.')
      }
      return
    }

    setError('')
    setSuccess('')
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const response = await fetch(`/api/users/${u.id}/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const result = await response.json()
      if (response.ok && result.success) {
        setSuccess(result.message)
        loadData()
      } else {
        setError(result.error || 'Failed to delete user')
      }
    } catch (err) {
      console.error('Error deleting user:', err)
      setError('An error occurred while deleting user')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setInviteData(prev => ({
      ...prev,
      [name]: name === 'daysAllocated' ? parseInt(value) : value
    }))
  }

  if (user?.profile?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
        <p className="text-gray-600">You don't have permission to access this page.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600">Manage employees and send invitations</p>
        </div>
        <button

          onClick={() => setShowInviteForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Invite User
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}


      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="text-2xl mr-3">👥</div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="text-2xl mr-3">📧</div>
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Invites</p>
              <p className="text-2xl font-bold text-gray-900">{invites.filter(i => !i.used).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="text-2xl mr-3">✅</div>
            <div>
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.role === 'employee').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users and Invites Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Users</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-3">
                        <button onClick={() => openEdit(user)} className="text-blue-600 hover:text-blue-900">Edit</button>
                        <button onClick={() => openAllocation(user)} className="text-indigo-600 hover:text-indigo-900">Add Allocation</button>
                        <button onClick={() => handleDeleteUser(user)} className="text-red-600 hover:text-red-900 font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invites Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Pending Invites</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>

                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invites.filter(invite => !invite.used).map((invite) => (
                  <tr key={invite.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{invite.email}</div>
                      <div className="text-sm text-gray-500">
                        Expires: {new Date(invite.expires_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        new Date(invite.expires_at) > new Date()
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {new Date(invite.expires_at) > new Date() ? 'Pending' : 'Expired'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        {!invite.used && new Date(invite.expires_at) > new Date() && (
                          <button
                            onClick={() => handleResendInvite(invite.id, invite.email)}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Resend
                          </button>
                        )}
                        {!invite.used && (
                          <button
                            onClick={() => handleRevokeInvite(invite.id, invite.email)}
                            className="text-red-600 hover:text-red-900 font-medium"
                          >
                            Revoke
                          </button>
                        )}
                        {invite.used && (
                          <span className="text-gray-400">Used</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invite Form Modal */}
      {/* Edit User Modal */}
      {showEditForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit User</h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      name="first_name"
                      value={editData.first_name}
                      onChange={handleEditChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      name="last_name"
                      value={editData.last_name}
                      onChange={handleEditChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Other Names</label>
                  <input
                    type="text"
                    name="other_names"
                    value={editData.other_names}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={editData.phone}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      name="role"
                      value={editData.role}
                      onChange={handleEditChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Leave Cycle Start *</label>
                    <input
                      type="date"
                      name="leave_cycle_start"
                      value={editData.leave_cycle_start}
                      onChange={handleEditChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showInviteForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Invite New User</h3>
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={inviteData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={inviteData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={inviteData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={inviteData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select
                      name="role"
                      value={inviteData.role}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Position *
                    </label>
                    <select
                      name="position"
                      value={inviteData.position}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="captain">Captain</option>
                      <option value="first_officer">First Officer</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Leave Days
                  </label>
                  <input
                    type="number"
                    name="daysAllocated"
                    value={inviteData.daysAllocated}
                    onChange={handleInputChange}
                    min="0"
                    max="365"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowInviteForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"

                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Send Invite
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Allocation Modal */}
      {showAllocationForm && allocationUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Add Leave Allocation</h3>
              <p className="text-sm text-gray-600 mb-4">
                {allocationUser.first_name} {allocationUser.last_name} — {new Date().getFullYear()}
              </p>
              <form onSubmit={handleAllocationSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Leave Days *</label>
                  <input
                    type="number"
                    value={allocationDays}
                    onChange={(e) => setAllocationDays(parseInt(e.target.value || '0'))}
                    min={0}
                    max={365}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowAllocationForm(false); setAllocationUser(null) }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add Allocation
                  </button>
                </div>
              </form>
              <p className="mt-2 text-xs text-gray-500">Note: This only works if an allocation for the current year does not already exist.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
