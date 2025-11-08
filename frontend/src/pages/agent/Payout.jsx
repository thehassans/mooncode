import React, { useEffect, useState } from 'react'
import { apiGet, apiPatch } from '../../api.js'

export default function AgentPayout() {
  const [me, setMe] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('me') || '{}')
    } catch {
      return {}
    }
  })
  const [loading, setLoading] = useState(true)
  const [payout, setPayout] = useState(() => ({
    method: (me?.payoutProfile?.method) || 'jazzcash',
    accountName: me?.payoutProfile?.accountName || '',
    bankName: me?.payoutProfile?.bankName || '',
    iban: me?.payoutProfile?.iban || '',
    accountNumber: me?.payoutProfile?.accountNumber || '',
    phoneNumber: me?.payoutProfile?.phoneNumber || '',
  }))
  const [savingPayout, setSavingPayout] = useState(false)

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

  useEffect(() => {
    try {
      setPayout({
        method: (me?.payoutProfile?.method) || 'jazzcash',
        accountName: me?.payoutProfile?.accountName || '',
        bankName: me?.payoutProfile?.bankName || '',
        iban: me?.payoutProfile?.iban || '',
        accountNumber: me?.payoutProfile?.accountNumber || '',
        phoneNumber: me?.payoutProfile?.phoneNumber || '',
      })
    } catch {}
  }, [me?.payoutProfile])

  async function savePayoutProfile() {
    try {
      setSavingPayout(true)
      const body = { ...payout }
      await apiPatch('/api/users/me/payout-profile', body)
      alert('Payout profile saved successfully!')
    } catch (e) {
      alert(e?.message || 'Failed to save payout profile')
    } finally {
      setSavingPayout(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner" />
        <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>Loading payout profile...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '1.5rem' }}>Payout Profile</h1>

      {/* Payout Profile */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Payment Information</div>
          <div className="card-subtitle">Set where you want to receive your payouts</div>
        </div>
        <div className="section" style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <label className="field">
              <div>Payment Method</div>
              <select
                className="input"
                value={payout.method}
                onChange={(e) => setPayout((p) => ({ ...p, method: e.target.value }))}
              >
                <option value="bank">Bank Transfer</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="field">
              <div>Name on Account</div>
              <input
                className="input"
                value={payout.accountName}
                onChange={(e) => setPayout((p) => ({ ...p, accountName: e.target.value }))}
                placeholder="e.g. Ahmed Ali"
              />
            </label>
          </div>

          {payout.method === 'bank' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <label className="field">
                <div>Bank Name</div>
                <input
                  className="input"
                  value={payout.bankName}
                  onChange={(e) => setPayout((p) => ({ ...p, bankName: e.target.value }))}
                  placeholder="e.g. HBL, Meezan Bank"
                />
              </label>
              <label className="field">
                <div>IBAN</div>
                <input
                  className="input"
                  value={payout.iban}
                  onChange={(e) => setPayout((p) => ({ ...p, iban: e.target.value }))}
                  placeholder="PK..."
                />
              </label>
              <label className="field">
                <div>Account Number</div>
                <input
                  className="input"
                  value={payout.accountNumber}
                  onChange={(e) => setPayout((p) => ({ ...p, accountNumber: e.target.value }))}
                  placeholder="e.g. 1234567890"
                />
              </label>
            </div>
          )}

          {payout.method !== 'bank' && (
            <label className="field">
              <div>Phone Number</div>
              <input
                className="input"
                value={payout.phoneNumber}
                onChange={(e) => setPayout((p) => ({ ...p, phoneNumber: e.target.value }))}
                placeholder="e.g. 03XXXXXXXXX"
              />
            </label>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button className="btn primary" disabled={savingPayout} onClick={savePayoutProfile}>
              {savingPayout ? 'Saving...' : 'Save Payout Profile'}
            </button>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="card" style={{ marginTop: '1.5rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
        <div className="section">
          <div style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px', color: '#3b82f6' }}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              <strong>Important:</strong> Make sure your payout information is accurate. Payouts will be processed to the account details provided here. Double-check all information before saving.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
