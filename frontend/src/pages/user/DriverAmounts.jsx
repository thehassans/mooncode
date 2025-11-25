import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../../api'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../ui/Toast.jsx'
import Modal from '../../components/Modal.jsx'

export default function DriverAmounts() {
  const navigate = useNavigate()
  const toast = useToast()
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [countryOptions, setCountryOptions] = useState([])
  const [country, setCountry] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [payingDriver, setPayingDriver] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [customRate, setCustomRate] = useState(null)
  const [calculatedAmount, setCalculatedAmount] = useState(0)
  const [pendingCommissions, setPendingCommissions] = useState([])
  const [loadingPending, setLoadingPending] = useState(false)
  const [approvingCommission, setApprovingCommission] = useState(null)

  // Load country options
  useEffect(() => {
    ;(async () => {
      try {
        const r = await apiGet('/api/orders/options')
        const arr = Array.isArray(r?.countries) ? r.countries : []
        const map = new Map()
        for (const c of arr) {
          const raw = String(c || '').trim()
          const key = raw.toLowerCase()
          if (!map.has(key)) map.set(key, raw.toUpperCase() === 'UAE' ? 'UAE' : raw)
        }
        setCountryOptions(Array.from(map.values()))
      } catch {
        setCountryOptions([])
      }
    })()
  }, [])

  // Load drivers based on country filter
  const loadDrivers = async (selectedCountry) => {
    if (!selectedCountry) {
      setDrivers([])
      return
    }
    try {
      setLoading(true)
      const r = await apiGet(
        `/api/finance/drivers/summary?country=${encodeURIComponent(selectedCountry)}&limit=200`
      )
      setDrivers(Array.isArray(r?.drivers) ? r.drivers : [])
      setErr('')
    } catch (e) {
      setErr(e?.message || 'Failed to load driver amounts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDrivers(country)
  }, [country])

  // Load pending commission approvals only for selected country
  const loadPendingCommissions = async (selectedCountry) => {
    if (!selectedCountry) {
      setPendingCommissions([])
      return
    }
    try {
      setLoadingPending(true)
      // Load only pending remittances with commission in note
      const r = await apiGet(`/api/finance/remittances?status=pending&limit=100`)
      const remits = Array.isArray(r?.remittances) ? r.remittances : []
      // Filter for pending commission payments in selected country
      const pending = remits.filter(
        (rem) =>
          String(rem.note || '')
            .toLowerCase()
            .includes('commission') &&
          String(rem.country || '')
            .trim()
            .toLowerCase() === String(selectedCountry).trim().toLowerCase()
      )
      setPendingCommissions(pending)
    } catch (e) {
      console.error('Failed to load pending commissions:', e)
      setPendingCommissions([])
    } finally {
      setLoadingPending(false)
    }
  }

  useEffect(() => {
    loadPendingCommissions(country)
  }, [country])

  // Approve commission payment
  const approveCommission = async (remittanceId) => {
    try {
      setApprovingCommission(remittanceId)
      await apiPost(`/api/finance/remittances/${remittanceId}/accept`, {})
      toast.success('Commission approved successfully')
      // Refresh both lists
      await loadDrivers(country)
      await loadPendingCommissions(country)
    } catch (e) {
      toast.error(e?.message || 'Failed to approve commission')
    } finally {
      setApprovingCommission(null)
    }
  }

  // Reject commission payment
  const rejectCommission = async (remittanceId) => {
    try {
      setApprovingCommission(remittanceId)
      await apiPost(`/api/finance/remittances/${remittanceId}/reject`, {})
      toast.warn('Commission rejected')
      // Refresh pending list
      await loadPendingCommissions(country)
    } catch (e) {
      toast.error(e?.message || 'Failed to reject commission')
    } finally {
      setApprovingCommission(null)
    }
  }

  // Debounce search for better performance
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  function num(n) {
    return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  const filteredDrivers = useMemo(() => {
    let result = drivers
    if (country) {
      result = result.filter(
        (d) =>
          String(d?.country || '')
            .trim()
            .toLowerCase() === String(country).trim().toLowerCase()
      )
    }
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase()
      result = result.filter(
        (d) =>
          String(d?.name || '')
            .toLowerCase()
            .includes(term) ||
          String(d?.phone || '')
            .toLowerCase()
            .includes(term)
      )
    }
    return result
  }, [drivers, country, debouncedSearch])

  const totals = useMemo(() => {
    let totalDelivered = 0,
      totalCollected = 0,
      totalCommission = 0,
      totalSentComm = 0,
      totalPendingComm = 0
    for (const d of filteredDrivers) {
      totalDelivered += Number(d.deliveredCount || 0)
      totalCollected += Number(d.collected || 0)
      totalCommission += Number(d.driverCommission || 0)
      totalSentComm += Number(d.paidCommission || 0)
      totalPendingComm += Number(d.pendingCommission || 0)
    }
    return { totalDelivered, totalCollected, totalCommission, totalSentComm, totalPendingComm }
  }, [filteredDrivers])

  // Get currency for display
  const displayCurrency = useMemo(() => {
    if (!filteredDrivers.length) return ''
    return filteredDrivers[0]?.currency || 'SAR'
  }, [filteredDrivers])

  return (
    <div className="section" style={{ display: 'grid', gap: 12 }}>
      <div
        className="page-header"
        style={{ animation: 'fadeInUp 0.6s ease-out', marginBottom: '20px' }}
      >
        <div>
          <div
            style={{
              fontSize: '42px',
              fontWeight: 900,
              letterSpacing: '-1px',
              marginBottom: '12px',
              background:
                'linear-gradient(135deg, #3b82f6 0%, #6366f1 25%, #8b5cf6 50%, #a855f7 75%, #d946ef 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 2px 8px rgba(59, 130, 246, 0.3))',
              lineHeight: '1.2',
            }}
          >
            🚚 Driver Amounts
          </div>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 500,
              color: 'var(--text-muted)',
              letterSpacing: '0.3px',
              background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              opacity: 0.9,
            }}
          >
            Monitor driver deliveries and commission details
          </div>
        </div>
      </div>
      {err && <div className="error">{err}</div>}

      {/* Pending Commission Approvals */}
      {pendingCommissions.length > 0 && (
        <div
          className="card"
          style={{
            border: '2px solid #f59e0b',
            background:
              'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%)',
          }}
        >
          <div className="card-header" style={{ borderBottom: '1px solid #f59e0b' }}>
            <div>
              <div
                className="card-title"
                style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Pending Commission Approvals
              </div>
              <div className="card-subtitle">
                Manager-initiated commission payments awaiting your approval
              </div>
            </div>
          </div>
          <div className="section" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Driver
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Manager
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Amount
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Requested
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingCommissions.map((comm) => (
                  <tr key={comm._id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600 }}>
                        {comm.driver?.firstName || ''} {comm.driver?.lastName || ''}
                      </div>
                      <div className="helper" style={{ fontSize: 11 }}>
                        {comm.driver?.phone || comm.driver?.email || ''}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600 }}>
                        {comm.manager?.firstName || ''} {comm.manager?.lastName || ''}
                      </div>
                      <div className="helper" style={{ fontSize: 11 }}>
                        {comm.manager?.email || ''}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: '#10b981',
                        fontSize: 16,
                      }}
                    >
                      {comm.currency || 'SAR'} {num(comm.amount || comm.driverCommission || 0)}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13, color: 'var(--text-muted)' }}>
                      {comm.createdAt ? new Date(comm.createdAt).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button
                          className="btn success"
                          style={{ fontSize: 12, padding: '6px 12px' }}
                          disabled={approvingCommission === comm._id}
                          onClick={() => approveCommission(comm._id)}
                        >
                          {approvingCommission === comm._id ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          className="btn danger"
                          style={{ fontSize: 12, padding: '6px 12px' }}
                          disabled={approvingCommission === comm._id}
                          onClick={() => rejectCommission(comm._id)}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div
        className="card hover-lift"
        style={{ display: 'grid', gap: 10, animation: 'scaleIn 0.5s ease-out 0.1s backwards' }}
      >
        <div className="card-header">
          <div className="card-title" style={{ fontSize: '18px', fontWeight: 800 }}>
            Filters
          </div>
        </div>
        <div
          className="section"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 10,
          }}
        >
          <select
            className="input filter-select"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">-- Select Country to Load Drivers --</option>
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className="input filter-select"
            type="text"
            placeholder="🔍 Search by driver name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={!country || loading}
            autoComplete="off"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))',
          gap: 16,
        }}
      >
        <div className="stat-card stagger-item gradient-blue" style={{ animationDelay: '0.15s' }}>
          <div
            style={{
              fontSize: 13,
              opacity: 0.95,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}
          >
            Total Delivered Orders
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px' }}>
            {num(totals.totalDelivered)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6 }}>Successfully delivered</div>
        </div>
        <div className="stat-card stagger-item gradient-green" style={{ animationDelay: '0.2s' }}>
          <div
            style={{
              fontSize: 13,
              opacity: 0.95,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}
          >
            Total Collected
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px' }}>
            {displayCurrency} {num(totals.totalCollected)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6 }}>Cash on delivery</div>
        </div>
        <div className="stat-card stagger-item gradient-green" style={{ animationDelay: '0.25s' }}>
          <div
            style={{
              fontSize: 13,
              opacity: 0.95,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}
          >
            Total Commission
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px' }}>
            {displayCurrency} {num(totals.totalCommission)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6 }}>
            Earned from delivered orders
          </div>
        </div>
        <div
          className="stat-card stagger-item gradient-orange"
          style={{
            animationDelay: '0.3s',
            ...(totals.totalPendingComm > 0
              ? { animation: 'pulseGlow 2s ease-in-out infinite' }
              : {}),
          }}
        >
          <div
            style={{
              fontSize: 13,
              opacity: 0.95,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}
          >
            Commission Pending
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px' }}>
            {displayCurrency} {num(totals.totalPendingComm)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6 }}>Available to pay</div>
        </div>
        <div
          className="stat-card stagger-item"
          style={{
            animationDelay: '0.35s',
            background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
          }}
        >
          <div
            style={{
              fontSize: 13,
              opacity: 0.95,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}
          >
            Commission Sent
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px' }}>
            {displayCurrency} {num(totals.totalSentComm)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6 }}>Already paid to drivers</div>
        </div>
      </div>

      {/* Drivers Table */}
      <div className="card" style={{ animation: 'scaleIn 0.5s ease-out 0.4s backwards' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '20px' }}>
            Driver Delivery & Commission Summary
          </div>
          <div className="helper" style={{ fontSize: '14px' }}>
            {filteredDrivers.length} driver{filteredDrivers.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }} className="premium-scroll">
          <table
            style={{
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: 0,
              border: '1px solid var(--border)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    borderRight: '1px solid var(--border)',
                    color: '#8b5cf6',
                  }}
                >
                  Driver
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    borderRight: '1px solid var(--border)',
                    color: '#6366f1',
                  }}
                >
                  Country
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'center',
                    borderRight: '1px solid var(--border)',
                    color: '#3b82f6',
                  }}
                >
                  Assigned
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'center',
                    borderRight: '1px solid var(--border)',
                    color: '#10b981',
                  }}
                >
                  Delivered
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border)',
                    color: '#22c55e',
                  }}
                >
                  Collected
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'center',
                    borderRight: '1px solid var(--border)',
                    color: '#a855f7',
                  }}
                >
                  Commission/Order
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border)',
                    color: '#ec4899',
                  }}
                >
                  Extra
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border)',
                    color: '#06b6d4',
                  }}
                >
                  Total Commission
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border)',
                    color: '#f59e0b',
                  }}
                >
                  Pending
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border)',
                    color: '#14b8a6',
                  }}
                >
                  Sent
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: '#8b5cf6' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={`sk${i}`}>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div
                        style={{
                          height: 14,
                          background: 'var(--panel-2)',
                          borderRadius: 6,
                          animation: 'pulse 1.2s ease-in-out infinite',
                          marginBottom: 4,
                        }}
                      />
                      <div
                        style={{
                          height: 10,
                          width: '60%',
                          background: 'var(--panel-2)',
                          borderRadius: 4,
                          animation: 'pulse 1.2s ease-in-out infinite',
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div
                        style={{
                          height: 14,
                          background: 'var(--panel-2)',
                          borderRadius: 6,
                          animation: 'pulse 1.2s ease-in-out infinite',
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div
                        style={{
                          height: 14,
                          background: 'var(--panel-2)',
                          borderRadius: 6,
                          animation: 'pulse 1.2s ease-in-out infinite',
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div
                        style={{
                          height: 14,
                          background: 'var(--panel-2)',
                          borderRadius: 6,
                          animation: 'pulse 1.2s ease-in-out infinite',
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div
                        style={{
                          height: 14,
                          background: 'var(--panel-2)',
                          borderRadius: 6,
                          animation: 'pulse 1.2s ease-in-out infinite',
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div
                        style={{
                          height: 14,
                          background: 'var(--panel-2)',
                          borderRadius: 6,
                          animation: 'pulse 1.2s ease-in-out infinite',
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div
                        style={{
                          height: 14,
                          background: 'var(--panel-2)',
                          borderRadius: 6,
                          animation: 'pulse 1.2s ease-in-out infinite',
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div
                        style={{
                          height: 14,
                          background: 'var(--panel-2)',
                          borderRadius: 6,
                          animation: 'pulse 1.2s ease-in-out infinite',
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div
                        style={{
                          height: 14,
                          background: 'var(--panel-2)',
                          borderRadius: 6,
                          animation: 'pulse 1.2s ease-in-out infinite',
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div
                        style={{
                          height: 14,
                          background: 'var(--panel-2)',
                          borderRadius: 6,
                          animation: 'pulse 1.2s ease-in-out infinite',
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div
                        style={{
                          height: 14,
                          background: 'var(--panel-2)',
                          borderRadius: 6,
                          animation: 'pulse 1.2s ease-in-out infinite',
                        }}
                      />
                    </td>
                  </tr>
                ))
              ) : filteredDrivers.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    style={{ padding: '20px 12px', opacity: 0.7, textAlign: 'center' }}
                  >
                    {country
                      ? 'No drivers found for this country'
                      : 'Please select a country from the filter above to load drivers'}
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((d, idx) => (
                  <tr
                    key={String(d.id)}
                    className="premium-table-row"
                    style={{
                      borderTop: '1px solid var(--border)',
                      background: idx % 2 ? 'transparent' : 'var(--panel)',
                    }}
                  >
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, color: '#8b5cf6' }}>{d.name || 'Unnamed'}</div>
                      <div className="helper">{d.phone || ''}</div>
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <span style={{ color: '#6366f1', fontWeight: 700 }}>{d.country || '-'}</span>
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'center',
                        borderRight: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ color: '#3b82f6', fontWeight: 700 }}>{num(d.assigned)}</span>
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'center',
                        borderRight: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ color: '#10b981', fontWeight: 800 }}>
                        {num(d.deliveredCount)}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        borderRight: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ color: '#22c55e', fontWeight: 800 }}>
                        {d.currency} {num(d.collected)}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'center',
                        borderRight: '1px solid var(--border)',
                      }}
                    >
                      {d.commissionPerOrder && d.commissionPerOrder > 0 ? (
                        <span style={{ color: '#a855f7', fontWeight: 700 }}>
                          {d.commissionCurrency || d.currency} {num(d.commissionPerOrder)}
                        </span>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 12 }}>
                          Not Set
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        borderRight: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ color: '#ec4899', fontWeight: 800 }}>
                        {d.currency} {num(d.extraCommission || 0)}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        borderRight: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ color: '#06b6d4', fontWeight: 800 }}>
                        {d.currency} {num(d.driverCommission || 0)}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        borderRight: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ color: '#f59e0b', fontWeight: 800 }}>
                        {d.currency} {num(d.pendingCommission || 0)}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        borderRight: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ color: '#14b8a6', fontWeight: 800 }}>
                        {d.currency} {num(d.paidCommission || 0)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {d.pendingCommission && d.pendingCommission > 0 ? (
                        <button
                          className="btn success"
                          style={{ fontSize: 12, padding: '6px 12px' }}
                          disabled={payingDriver === d.id}
                          onClick={() => {
                            setPayModal({
                              driver: d,
                              amount: d.pendingCommission,
                              deliveredCount: d.deliveredCount,
                              defaultRate: d.commissionPerOrder || 0,
                            })
                            setCustomRate(null)
                            setCalculatedAmount(d.pendingCommission)
                          }}
                        >
                          Pay Commission
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No pending</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Commission Modal */}
      <Modal
        title="Pay Driver Commission"
        open={!!payModal}
        onClose={() => {
          setPayModal(null)
          setCustomRate(null)
          setCalculatedAmount(0)
        }}
        footer={
          <>
            <button
              className="btn secondary"
              onClick={() => setPayModal(null)}
              disabled={!!payingDriver}
            >
              Cancel
            </button>
            <button
              className="btn success"
              disabled={!!payingDriver}
              onClick={async () => {
                const finalAmount = customRate ? calculatedAmount : payModal.amount
                const finalRate = customRate || payModal.defaultRate
                if (finalAmount <= 0) {
                  toast.error('Commission amount must be greater than 0')
                  return
                }
                setPayingDriver(payModal.driver.id)
                try {
                  await apiPost(`/api/finance/drivers/${payModal.driver.id}/pay-commission`, {
                    amount: finalAmount,
                    commissionRate: finalRate,
                    deliveredCount: payModal.deliveredCount,
                  })
                  toast.success(`Commission payment sent successfully (${num(finalRate)}/order)`)
                  setPayModal(null)
                  setCustomRate(null)
                  setCalculatedAmount(0)
                  // Refresh data
                  await loadDrivers()
                } catch (e) {
                  toast.error(e?.message || 'Failed to send payment')
                } finally {
                  setPayingDriver(null)
                }
              }}
            >
              {payingDriver ? 'Sending...' : 'Confirm Payment'}
            </button>
          </>
        }
      >
        {payModal && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ fontSize: 16, marginBottom: 24, textAlign: 'center' }}>
              Send{' '}
              <strong style={{ color: '#10b981', fontSize: 20 }}>
                {payModal.driver.currency} {num(customRate ? calculatedAmount : payModal.amount)}
              </strong>{' '}
              commission to <strong style={{ color: '#8b5cf6' }}>{payModal.driver.name}</strong>?
            </div>

            {/* Custom Commission Rate Selector */}
            <div
              style={{ marginBottom: 20, padding: 16, background: 'var(--panel)', borderRadius: 8 }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <label style={{ fontWeight: 600, fontSize: 14 }}>Commission Rate per Order:</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={customRate !== null ? customRate : payModal.defaultRate}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0
                      setCustomRate(val)
                      setCalculatedAmount(val * payModal.deliveredCount)
                    }}
                    style={{
                      width: 90,
                      padding: '8px',
                      textAlign: 'right',
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                    className="input"
                  />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
                    {payModal.driver.currency}/order
                  </span>
                </div>
              </div>

              {/* Quick Rate Buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {[8, 10, 12, 15, 20, 25].map((rate) => (
                  <button
                    key={rate}
                    className="btn"
                    style={{
                      fontSize: 12,
                      padding: '6px 12px',
                      background:
                        (customRate || payModal.defaultRate) === rate
                          ? '#8b5cf6'
                          : 'var(--panel-2)',
                      color: (customRate || payModal.defaultRate) === rate ? '#fff' : 'inherit',
                    }}
                    onClick={() => {
                      setCustomRate(rate)
                      setCalculatedAmount(rate * payModal.deliveredCount)
                    }}
                  >
                    {rate} {payModal.driver.currency}
                  </button>
                ))}
                <button
                  className="btn secondary"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                  onClick={() => {
                    setCustomRate(null)
                    setCalculatedAmount(payModal.amount)
                  }}
                >
                  Reset
                </button>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                {payModal.deliveredCount} delivered orders × {payModal.driver.currency}{' '}
                {num(customRate !== null ? customRate : payModal.defaultRate)} ={' '}
                {payModal.driver.currency} {num(customRate ? calculatedAmount : payModal.amount)}
              </div>
            </div>

            <div style={{ background: 'var(--panel)', padding: 12, borderRadius: 8, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>Driver:</span>
                <strong>{payModal.driver.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>Phone:</span>
                <strong>{payModal.driver.phone}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>Country:</span>
                <strong>{payModal.driver.country}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>Delivered Orders:</span>
                <strong>{payModal.deliveredCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>Rate per Order:</span>
                <strong style={{ color: '#8b5cf6' }}>
                  {payModal.driver.currency}{' '}
                  {num(customRate !== null ? customRate : payModal.defaultRate)}
                </strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: 8,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <span style={{ opacity: 0.7, fontWeight: 600 }}>Total Amount:</span>
                <strong style={{ color: '#10b981', fontSize: 18 }}>
                  {payModal.driver.currency} {num(customRate ? calculatedAmount : payModal.amount)}
                </strong>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
