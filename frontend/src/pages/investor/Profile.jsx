import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../api';

export default function InvestorProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    phone: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      const data = await apiGet('/api/users/me');
      setUser(data.user);
      setProfileForm({
        firstName: data.user.firstName || '',
        lastName: data.user.lastName || '',
        phone: data.user.phone || ''
      });
    } catch (e) {
      console.error('Failed to load profile:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileUpdate(e) {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      await apiPost('/api/users/update-profile', profileForm);
      setProfileSuccess('Profile updated successfully!');
      setEditMode(false);
      await loadProfile();
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (e) {
      setProfileError(e?.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);

    try {
      await apiPost('/api/users/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordSuccess('Password changed successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (e) {
      setPasswordError(e?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: 50, height: 50, border: '5px solid var(--border)', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <div style={{ marginTop: 20, fontSize: 16, opacity: 0.7 }}>Loading profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="section" style={{ display: 'grid', gap: 24, maxWidth: 900, margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          My Profile
        </h1>
        <p style={{ fontSize: 15, opacity: 0.7, margin: '8px 0 0 0' }}>Manage your account settings and preferences</p>
      </div>

      {/* Profile Card */}
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Profile Information</h2>
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                border: '2px solid #667eea',
                background: 'transparent',
                color: '#667eea',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#667eea';
                e.target.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.color = '#667eea';
              }}
            >
              Edit Profile
            </button>
          )}
        </div>

        {profileSuccess && (
          <div style={{ marginBottom: 20, padding: 16, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 10, color: '#10b981', fontSize: 14, fontWeight: 600 }}>
            ✓ {profileSuccess}
          </div>
        )}

        {profileError && (
          <div style={{ marginBottom: 20, padding: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 10, color: '#ef4444', fontSize: 14, fontWeight: 600 }}>
            {profileError}
          </div>
        )}

        {editMode ? (
          <form onSubmit={handleProfileUpdate} style={{ display: 'grid', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, opacity: 0.9 }}>
                  First Name
                </label>
                <input
                  type="text"
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: '2px solid var(--border)',
                    fontSize: 15,
                    background: 'var(--panel)',
                    outline: 'none'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#667eea')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, opacity: 0.9 }}>
                  Last Name
                </label>
                <input
                  type="text"
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: '2px solid var(--border)',
                    fontSize: 15,
                    background: 'var(--panel)',
                    outline: 'none'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#667eea')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, opacity: 0.9 }}>
                Phone Number
              </label>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: '2px solid var(--border)',
                  fontSize: 15,
                  background: 'var(--panel)',
                  outline: 'none'
                }}
                onFocus={(e) => (e.target.style.borderColor = '#667eea')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setEditMode(false);
                  setProfileForm({
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    phone: user.phone || ''
                  });
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: 10,
                  border: '2px solid var(--border)',
                  background: 'transparent',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                disabled={profileLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={profileLoading}
                style={{
                  padding: '12px 32px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: profileLoading ? 'not-allowed' : 'pointer',
                  opacity: profileLoading ? 0.6 : 1
                }}
              >
                {profileLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'grid', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: 'var(--panel)', padding: 16, borderRadius: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>First Name</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{user?.firstName || '-'}</div>
              </div>
              <div style={{ background: 'var(--panel)', padding: 16, borderRadius: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>Last Name</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{user?.lastName || '-'}</div>
              </div>
            </div>

            <div style={{ background: 'var(--panel)', padding: 16, borderRadius: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>Email</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{user?.email || '-'}</div>
            </div>

            <div style={{ background: 'var(--panel)', padding: 16, borderRadius: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>Phone</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{user?.phone || '-'}</div>
            </div>

            <div style={{ background: 'var(--panel)', padding: 16, borderRadius: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>Role</div>
              <div style={{ fontSize: 16, fontWeight: 700, textTransform: 'capitalize' }}>{user?.role || '-'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Change Password Card */}
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 24px 0' }}>Change Password</h2>

        {passwordSuccess && (
          <div style={{ marginBottom: 20, padding: 16, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 10, color: '#10b981', fontSize: 14, fontWeight: 600 }}>
            ✓ {passwordSuccess}
          </div>
        )}

        {passwordError && (
          <div style={{ marginBottom: 20, padding: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 10, color: '#ef4444', fontSize: 14, fontWeight: 600 }}>
            {passwordError}
          </div>
        )}

        <form onSubmit={handlePasswordChange} style={{ display: 'grid', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, opacity: 0.9 }}>
              Current Password
            </label>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 10,
                border: '2px solid var(--border)',
                fontSize: 15,
                background: 'var(--panel)',
                outline: 'none'
              }}
              onFocus={(e) => (e.target.style.borderColor = '#667eea')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, opacity: 0.9 }}>
              New Password
            </label>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 10,
                border: '2px solid var(--border)',
                fontSize: 15,
                background: 'var(--panel)',
                outline: 'none'
              }}
              onFocus={(e) => (e.target.style.borderColor = '#667eea')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, opacity: 0.9 }}>
              Confirm New Password
            </label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 10,
                border: '2px solid var(--border)',
                fontSize: 15,
                background: 'var(--panel)',
                outline: 'none'
              }}
              onFocus={(e) => (e.target.style.borderColor = '#667eea')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={passwordLoading}
              style={{
                padding: '12px 32px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: passwordLoading ? 'not-allowed' : 'pointer',
                opacity: passwordLoading ? 0.6 : 1
              }}
            >
              {passwordLoading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Inline CSS */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
