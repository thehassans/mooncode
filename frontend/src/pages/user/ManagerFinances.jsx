import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/Modal.jsx'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, convert } from '../../util/currency'

export default function ManagerFinances() {
  const navigate = useNavigate()
  const toast = useToast()
  const [me, setMe] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('me') || '{}')
    } catch {
      return {}
    }
  })
  const [driverRemittances, setDriverRemittances] = useState([])
  const [managerRemittances, setManagerRemittances] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [country, setCountry] = useState('')
  const [countryOptions, setCountryOptions] = useState([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [acceptModal, setAcceptModal] = useState(null)
  const [curCfg, setCurCfg] = useState(null)
  const [managers, setManagers] = useState([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [userRes, curRes] = await Promise.all([apiGet('/api/users/me'), getCurrencyConfig()])
        if (alive) {
          setMe(userRes?.user || {})
          setCurCfg(curRes || null)
        }
      } catch {}
    })()
    return () => {
      alive = false
    }
  }, [])

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

  // Load remittances (both driver→manager and manager→company)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const [driverRemitsRes, managerRemitsRes, managersRes] = await Promise.all([
          apiGet('/api/finance/remittances?limit=500'),
          apiGet('/api/finance/manager-remittances'),
          apiGet('/api/users?role=manager'),
        ])
        if (alive) {
          setDriverRemittances(
            Array.isArray(driverRemitsRes?.remittances) ? driverRemitsRes.remittances : []
          )
          setManagerRemittances(
            Array.isArray(managerRemitsRes?.remittances) ? managerRemitsRes.remittances : []
          )
          setManagers(Array.isArray(managersRes?.users) ? managersRes.users : [])
        }
        setErr('')
      } catch (e) {
        if (alive) setErr(e?.message || 'Failed to load remittances')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // Live updates
  useEffect(() => {
    let socket
    try {
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, {
        path: '/socket.io',
        transports: ['polling'],
        upgrade: false,
        withCredentials: true,
        auth: { token },
      })
      const onRemit = async () => {
        try {
          await refreshRemittances()
        } catch {}
      }
      socket.on('remittance.created', onRemit)
      socket.on('remittance.accepted', onRemit)
      socket.on('manager-remittance.created', onRemit)
      socket.on('manager-remittance.accepted', onRemit)
      socket.on('manager-remittance.rejected', onRemit)
    } catch {}
    return () => {
      try {
        socket && socket.off('remittance.created')
      } catch {}
      try {
        socket && socket.off('remittance.accepted')
      } catch {}
      try {
        socket && socket.off('manager-remittance.created')
      } catch {}
      try {
        socket && socket.off('manager-remittance.accepted')
      } catch {}
      try {
        socket && socket.off('manager-remittance.rejected')
      } catch {}
      try {
        socket && socket.disconnect()
      } catch {}
    }
  }, [])

  async function refreshRemittances() {
    try {
      const [driverRemitsRes, managerRemitsRes] = await Promise.all([
        apiGet('/api/finance/remittances?limit=500'),
        apiGet('/api/finance/manager-remittances'),
      ])
      setDriverRemittances(
        Array.isArray(driverRemitsRes?.remittances) ? driverRemitsRes.remittances : []
      )
      setManagerRemittances(
        Array.isArray(managerRemitsRes?.remittances) ? managerRemitsRes.remittances : []
      )
    } catch {}
  }

  async function acceptRemit(id) {
    try {
      await apiPost(`/api/finance/manager-remittances/${id}/accept`, {})
      await refreshRemittances()
      toast.success('Manager remittance accepted')
    } catch (e) {
      toast.error(e?.message || 'Failed to accept')
    }
  }

  async function rejectRemit(id) {
    try {
      await apiPost(`/api/finance/manager-remittances/${id}/reject`, {})
      await refreshRemittances()
      toast.warn('Manager remittance rejected')
    } catch (e) {
      toast.error(e?.message || 'Failed to reject')
    }
  }

  function num(n) {
    return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  function userName(u) {
    if (!u) return '-'
    return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '-'
  }
  function dateInRange(d, from, to) {
    try {
      if (!d) return false
      const t = new Date(d).getTime()
      if (from) {
        const f = new Date(from).setHours(0, 0, 0, 0)
        if (t < f) return false
      }
      if (to) {
        const tt = new Date(to).setHours(23, 59, 59, 999)
        if (t > tt) return false
      }
      return true
    } catch {
      return true
    }
  }

  const filteredManagerRemittances = useMemo(() => {
    return managerRemittances.filter((r) => {
      if (
        country &&
        String(r?.country || '')
          .trim()
          .toLowerCase() !== String(country).trim().toLowerCase()
      )
        return false
      if (
        statusFilter &&
        String(r?.status || '').toLowerCase() !== String(statusFilter).toLowerCase()
      )
        return false
      if ((fromDate || toDate) && !dateInRange(r?.createdAt, fromDate, toDate)) return false
      return true
    })
  }, [managerRemittances, country, statusFilter, fromDate, toDate])

  const filteredDriverRemittances = useMemo(() => {
    return driverRemittances.filter((r) => {
      const rCountry = r?.country || r?.driver?.country || ''
      if (
        country &&
        String(rCountry || '')
          .trim()
          .toLowerCase() !== String(country).trim().toLowerCase()
      )
        return false
      if (
        statusFilter &&
        String(r?.status || '').toLowerCase() !== String(statusFilter).toLowerCase()
      )
        return false
      if ((fromDate || toDate) && !dateInRange(r?.createdAt, fromDate, toDate)) return false
      return true
    })
  }, [driverRemittances, country, statusFilter, fromDate, toDate])

  const summaryCurrency = useMemo(() => {
    if (!country) return 'AED'
    const map = {
      KSA: 'SAR',
      'Saudi Arabia': 'SAR',
      SA: 'SAR',
      UAE: 'AED',
      AE: 'AED',
      Oman: 'OMR',
      OM: 'OMR',
      Bahrain: 'BHD',
      BH: 'BHD',
      India: 'INR',
      IN: 'INR',
      Kuwait: 'KWD',
      KW: 'KWD',
      Qatar: 'QAR',
      QA: 'QAR',
    }
    const key = String(country || '').trim()
    return map[key] || 'AED'
  }, [country])

  // Manager→Company totals
  const managerTotals = useMemo(() => {
    let totalCollectedFromDrivers = 0 // What managers collected from drivers (accepted driver remittances)
    let sentToCompany = 0 // Manager remittances accepted by owner
    let pendingApproval = 0 // Manager remittances pending owner approval

    // Calculate total collected from drivers (accepted driver remittances)
    for (const r of filteredDriverRemittances) {
      if (r.status === 'accepted' || r.status === 'manager_accepted') {
        const amount = Number(r.amount || 0)
        const currency = r.currency || 'SAR'
        const converted = curCfg ? convert(amount, currency, summaryCurrency, curCfg) : amount
        totalCollectedFromDrivers += converted
      }
    }

    // Calculate sent to company and pending
    for (const r of filteredManagerRemittances) {
      const amount = Number(r.amount || 0)
      const currency = r.currency || 'SAR'
      const converted = curCfg ? convert(amount, currency, summaryCurrency, curCfg) : amount

      if (r.status === 'accepted') sentToCompany += converted
      else if (r.status === 'pending') pendingApproval += converted
    }

    const toPayCompany = totalCollectedFromDrivers - sentToCompany

    return {
      totalCollectedFromDrivers,
      sentToCompany,
      pendingApproval,
      toPayCompany,
    }
  }, [filteredDriverRemittances, filteredManagerRemittances, curCfg, summaryCurrency])

  function statusBadge(st) {
    const s = String(st || '').toLowerCase()
    const map = {
      pending: '#f59e0b',
      manager_accepted: '#0ea5e9',
      accepted: '#10b981',
      rejected: '#ef4444',
    }
    const color = map[s] || 'var(--muted)'
    const label = s === 'manager_accepted' ? 'MANAGER ACCEPTED' : s.toUpperCase()
    return (
      <span
        className="chip"
        style={{ border: `1px solid ${color}`, color, background: 'transparent', fontWeight: 700 }}
      >
        {label}
      </span>
    )
  }

  return (
    <div className="section" style={{ display: 'grid', gap: 12 }}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-purple">Manager Finances</div>
          <div className="page-subtitle">
            Monitor driver→manager and manager→company remittances
          </div>
        </div>
      </div>
      {err && <div className="error">{err}</div>}

      {/* Filters */}
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="card-header">
          <div className="card-title">Filters</div>
        </div>
        <div
          className="section"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 8,
          }}
        >
          <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">All Countries</option>
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="manager_accepted">Manager Accepted</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
          <input
            className="input"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <input
            className="input"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {/* Manager→Company Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))',
          gap: 12,
        }}
      >
        <div
          className="card"
          style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color: '#fff' }}
        >
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Total Collected from Drivers</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>
              {summaryCurrency} {num(managerTotals.totalCollectedFromDrivers)}
            </div>
          </div>
        </div>
        <div
          className="card"
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff' }}
        >
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Sent to Company</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>
              {summaryCurrency} {num(managerTotals.sentToCompany)}
            </div>
          </div>
        </div>
        <div
          className="card"
          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff' }}
        >
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Pending Approval</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>
              {summaryCurrency} {num(managerTotals.pendingApproval)}
            </div>
          </div>
        </div>
        <div
          className="card"
          style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#fff' }}
        >
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>To Pay Company</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>
              {summaryCurrency} {num(managerTotals.toPayCompany)}
            </div>
          </div>
        </div>
      </div>

      {/* Manager→Company Remittances Table */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 700 }}>🏢 Manager → Company Remittances</div>
          <div className="helper">Amounts managers sent to company</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
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
                  Manager
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
                    textAlign: 'right',
                    borderRight: '1px solid var(--border)',
                    color: '#22c55e',
                  }}
                >
                  Amount
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    borderRight: '1px solid var(--border)',
                    color: '#3b82f6',
                  }}
                >
                  Method
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    borderRight: '1px solid var(--border)',
                    color: '#f59e0b',
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    borderRight: '1px solid var(--border)',
                    color: '#6366f1',
                  }}
                >
                  Date
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={`mgsk${i}`}>
                    <td colSpan={7} style={{ padding: '10px 12px' }}>
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
              ) : filteredManagerRemittances.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ padding: '10px 12px', opacity: 0.7, textAlign: 'center' }}
                  >
                    No manager remittances found
                  </td>
                </tr>
              ) : (
                filteredManagerRemittances.map((r, idx) => (
                  <tr
                    key={String(r._id)}
                    style={{
                      borderTop: '1px solid var(--border)',
                      background: idx % 2 ? 'transparent' : 'var(--panel)',
                    }}
                  >
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, color: '#8b5cf6' }}>{userName(r.manager)}</div>
                      <div className="helper">{r.manager?.email || ''}</div>
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <span style={{ color: '#6366f1', fontWeight: 700 }}>
                        {r.country ||
                          r.manager?.country ||
                          r.manager?.assignedCountry ||
                          (Array.isArray(r.manager?.assignedCountries) &&
                          r.manager.assignedCountries.length > 0
                            ? r.manager.assignedCountries[0]
                            : null) ||
                          r.currency ||
                          'SAR'}
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
                        {r.currency} {num(r.amount)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <span style={{ color: '#3b82f6', fontWeight: 700 }}>
                        {String(r.method || 'hand').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      {statusBadge(r.status)}
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div style={{ color: '#6366f1', fontSize: 13 }}>
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {r.status === 'pending' ? (
                          <>
                            <button className="btn success small" onClick={() => setAcceptModal(r)}>
                              Accept
                            </button>
                            <button
                              className="btn danger small"
                              onClick={async () => {
                                if (
                                  window.confirm('Are you sure you want to reject this remittance?')
                                ) {
                                  await rejectRemit(String(r._id || ''))
                                }
                              }}
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <button className="btn secondary small" onClick={() => setAcceptModal(r)}>
                            Details
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Driver→Manager Remittances Table */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 700 }}>💵 Driver → Manager Remittances</div>
          <div className="helper">Amounts drivers sent to managers</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
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
                    color: '#3b82f6',
                  }}
                >
                  Driver
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    borderRight: '1px solid var(--border)',
                    color: '#8b5cf6',
                  }}
                >
                  Manager
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border)',
                    color: '#22c55e',
                  }}
                >
                  Amount
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    borderRight: '1px solid var(--border)',
                    color: '#f59e0b',
                  }}
                >
                  Status
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={`drsk${i}`}>
                    <td colSpan={5} style={{ padding: '10px 12px' }}>
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
              ) : filteredDriverRemittances.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{ padding: '10px 12px', opacity: 0.7, textAlign: 'center' }}
                  >
                    No driver remittances found
                  </td>
                </tr>
              ) : (
                filteredDriverRemittances.slice(0, 10).map((r, idx) => (
                  <tr
                    key={String(r._id)}
                    style={{
                      borderTop: '1px solid var(--border)',
                      background: idx % 2 ? 'transparent' : 'var(--panel)',
                    }}
                  >
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, color: '#3b82f6' }}>{userName(r.driver)}</div>
                      <div className="helper">{r.driver?.phone || ''}</div>
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, color: '#8b5cf6' }}>{userName(r.manager)}</div>
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        borderRight: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ color: '#22c55e', fontWeight: 800 }}>
                        {r.currency} {num(r.amount)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                      {r.status === 'manager_accepted' ? (
                        <span
                          className="chip"
                          style={{
                            border: '1px solid #10b981',
                            color: '#10b981',
                            background: 'transparent',
                            fontWeight: 700,
                          }}
                        >
                          ✓ MANAGER ACCEPTED
                        </span>
                      ) : (
                        statusBadge(r.status)
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ color: '#6366f1', fontSize: 13 }}>
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accept/Details Modal */}
      {acceptModal && (
        <Modal
          title={
            acceptModal.status === 'pending'
              ? 'Accept Manager Remittance'
              : 'Manager Remittance Details'
          }
          open={!!acceptModal}
          onClose={() => setAcceptModal(null)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setAcceptModal(null)}>
                Close
              </button>
              {acceptModal.status === 'pending' && (
                <>
                  <button
                    className="btn danger"
                    onClick={async () => {
                      const id = String(acceptModal?._id || '')
                      await rejectRemit(id)
                      setAcceptModal(null)
                    }}
                  >
                    Reject
                  </button>
                  <button
                    className="btn success"
                    onClick={async () => {
                      const id = String(acceptModal?._id || '')
                      await acceptRemit(id)
                      setAcceptModal(null)
                    }}
                  >
                    Accept
                  </button>
                </>
              )}
            </>
          }
        >
          <div style={{ display: 'grid', gap: 8 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))',
                gap: 8,
              }}
            >
              <Info label="Manager" value={userName(acceptModal?.manager)} />
              <Info
                label="Country"
                value={
                  acceptModal?.country ||
                  acceptModal?.manager?.country ||
                  acceptModal?.manager?.assignedCountry ||
                  (Array.isArray(acceptModal?.manager?.assignedCountries) &&
                  acceptModal?.manager?.assignedCountries.length > 0
                    ? acceptModal?.manager?.assignedCountries[0]
                    : null) ||
                  acceptModal?.currency ||
                  'SAR'
                }
              />
              <Info
                label="Amount"
                value={`${acceptModal?.currency || ''} ${Number(acceptModal?.amount || 0).toFixed(2)}`}
              />
              <Info label="Method" value={String(acceptModal?.method || 'hand').toUpperCase()} />
              <Info label="Status" value={String(acceptModal?.status || '').toUpperCase()} />
              {acceptModal?.note ? <Info label="Note" value={acceptModal?.note} /> : null}
              <Info
                label="Created"
                value={
                  acceptModal?.createdAt ? new Date(acceptModal.createdAt).toLocaleString() : '-'
                }
              />
              {acceptModal?.acceptedAt ? (
                <Info label="Processed" value={new Date(acceptModal.acceptedAt).toLocaleString()} />
              ) : null}
            </div>
            {acceptModal?.receiptPath ? (
              <div>
                <div className="helper">Proof</div>
                <img
                  src={`${API_BASE}${acceptModal.receiptPath}`}
                  alt="Proof"
                  style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </div>
            ) : null}
          </div>
        </Modal>
      )}
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="panel" style={{ padding: 10, borderRadius: 10 }}>
      <div className="helper" style={{ fontSize: 12 }}>
        {label}
      </div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  )
}
