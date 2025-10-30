import React, { useEffect, useState } from 'react'
import { apiGet, apiPatch } from '../../api.js'

export default function DriverProfile() {
  const [me, setMe] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('me') || '{}')
    } catch {
      return {}
    }
  })
  const [loading, setLoading] = useState(true)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPass, setChangingPass] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const r = await apiGet('/api/users/me')
        if (!alive) return
        if (r?.user) {
          setMe(r.user)
          try {
            localStorage.setItem('me', JSON.stringify(r.user))
          } catch {}
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  async function handlePasswordChange(e) {
    e?.preventDefault?.()
    if (!currentPassword || !newPassword) {
      alert('Please fill all fields')
      return
    }
    if (newPassword.length < 6) {
      alert('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      alert('New password and confirmation do not match')
      return
    }
    setChangingPass(true)
    try {
      await apiPatch('/api/users/me/password', {
        currentPassword,
        newPassword,
      })
      alert('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      alert(err?.message || 'Failed to change password')
    } finally {
      setChangingPass(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner" />
        <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>Loading profile...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '1.5rem' }}>Profile</h1>

      {/* Profile Information */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">Personal Information</div>
          <div className="card-subtitle">Your account details</div>
        </div>
        <div className="section" style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '12px', background: 'var(--panel-2)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>First Name</div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>{me.firstName || 'N/A'}</div>
            </div>
            <div style={{ padding: '12px', background: 'var(--panel-2)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Last Name</div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>{me.lastName || 'N/A'}</div>
            </div>
          </div>
          <div style={{ padding: '12px', background: 'var(--panel-2)', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Email</div>
            <div style={{ fontSize: '14px' }}>{me.email || 'N/A'}</div>
          </div>
          <div style={{ padding: '12px', background: 'var(--panel-2)', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Phone</div>
            <div style={{ fontSize: '14px' }}>{me.phone || 'N/A'}</div>
          </div>
          <div style={{ padding: '12px', background: 'var(--panel-2)', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Role</div>
            <div style={{ fontSize: '14px', textTransform: 'capitalize' }}>{me.role || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Change Password</div>
          <div className="card-subtitle">Update your account password</div>
        </div>
        <div className="section">
          <form onSubmit={handlePasswordChange} style={{ display: 'grid', gap: '1rem', maxWidth: '500px' }}>
            <label className="field">
              <div>Current Password</div>
              <input
                type="password"
                className="input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <div>New Password</div>
              <input
                type="password"
                className="input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>
            <label className="field">
              <div>Confirm New Password</div>
              <input
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                className="btn primary"
                disabled={changingPass}
              >
                {changingPass ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
