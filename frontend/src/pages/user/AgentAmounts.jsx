import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../../api'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../ui/Toast.jsx'
import Modal from '../../components/Modal.jsx'

export default function AgentAmounts() {
  const navigate = useNavigate()
  const toast = useToast()
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [payingAgent, setPayingAgent] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [commissionRate, setCommissionRate] = useState(null)
  const [calculatedAmount, setCalculatedAmount] = useState(0)
  const [historyModal, setHistoryModal] = useState(null)
  const [historyData, setHistoryData] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Load agents asynchronously to prevent blocking page render
  useEffect(() => {
    let alive = true
    // Small delay to allow page to render first
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true)
        const r = await apiGet('/api/finance/agents/commission?limit=100')
        if (alive) {
          setAgents(Array.isArray(r?.agents) ? r.agents : [])
          setErr('')
        }
      } catch (e) {
        if (alive) setErr(e?.message || 'Failed to load agent amounts')
      } finally {
        if (alive) setLoading(false)
      }
    }, 10)

    return () => {
      alive = false
      clearTimeout(timeoutId)
    }
  }, [])

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

  async function fetchHistory(agent) {
    setHistoryModal(agent)
    setLoadingHistory(true)
    try {
      const r = await apiGet(`/api/finance/agents/${agent.id}/commission-history`)
      setHistoryData(Array.isArray(r?.history) ? r.history : [])
    } catch (e) {
      toast.error('Failed to load history')
      setHistoryData([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const filteredAgents = useMemo(() => {
    if (!debouncedSearch) return agents
    const term = debouncedSearch.toLowerCase()
    return agents.filter(
      (a) =>
        String(a.name || '')
          .toLowerCase()
          .includes(term) ||
        String(a.phone || '')
          .toLowerCase()
          .includes(term)
    )
  }, [agents, debouncedSearch])

  const totals = useMemo(() => {
    let deliveredCommission = 0,
      upcomingCommission = 0,
      withdrawn = 0,
      pending = 0,
      ordersSubmitted = 0,
      ordersDelivered = 0,
      totalOrderValueAED = 0
    for (const a of filteredAgents) {
      deliveredCommission += Number(a.deliveredCommissionPKR || 0)
      upcomingCommission += Number(a.upcomingCommissionPKR || 0)
      withdrawn += Number(a.withdrawnPKR || 0)
      pending += Number(a.pendingPKR || 0)
      ordersSubmitted += Number(a.ordersSubmitted || 0)
      ordersDelivered += Number(a.ordersDelivered || 0)
      totalOrderValueAED += Number(a.totalOrderValueAED || 0)
    }
    return {
      deliveredCommission,
      upcomingCommission,
      withdrawn,
      pending,
      ordersSubmitted,
      ordersDelivered,
      totalOrderValueAED,
    }
  }, [filteredAgents])

  return (
    <div className="section" style={{ display: 'grid', gap: 12 }}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-green">Agent Amounts</div>
          <div className="page-subtitle">Monitor agent earnings from submitted orders</div>
        </div>
      </div>
      {err && <div className="error">{err}</div>}

      {/* Search Filter */}
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="card-header">
          <div className="card-title">Search & Filter</div>
          {loading && (
            <div className="helper" style={{ fontSize: 12 }}>
              Loading agents...
            </div>
          )}
        </div>
        <input
          className="input"
          type="text"
          placeholder="Search by agent name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={loading}
          autoComplete="off"
        />
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))',
          gap: 12,
        }}
      >
        <div
          className="card"
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff' }}
        >
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Delivered Commission</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>
              PKR {num(totals.deliveredCommission)}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>From delivered orders</div>
          </div>
        </div>
        <div
          className="card"
          style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff' }}
        >
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Upcoming Commission</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>
              PKR {num(totals.upcomingCommission)}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>From pending orders</div>
          </div>
        </div>
        <div
          className="card"
          style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color: '#fff' }}
        >
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Total Withdrawn</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>PKR {num(totals.withdrawn)}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Already paid out</div>
          </div>
        </div>
        <div
          className="card"
          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff' }}
        >
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Pending Requests</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>PKR {num(totals.pending)}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Awaiting approval</div>
          </div>
        </div>
        <div
          className="card"
          style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: '#fff' }}
        >
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Orders Delivered</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{num(totals.ordersDelivered)}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              Out of {num(totals.ordersSubmitted)} submitted orders
            </div>
          </div>
        </div>
      </div>

      {/* Agents Table */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 700 }}>Agent Commission Summary</div>
          <div className="helper">
            {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''}
          </div>
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
                  Agent
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'center',
                    borderRight: '1px solid var(--border)',
                    color: '#6366f1',
                  }}
                >
                  Orders Submitted
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'center',
                    borderRight: '1px solid var(--border)',
                    color: '#22c55e',
                  }}
                >
                  Orders Delivered
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border)',
                    color: '#06b6d4',
                  }}
                >
                  Delivered Value (AED)
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border)',
                    color: '#10b981',
                  }}
                >
                  Delivered Comm.
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border)',
                    color: '#3b82f6',
                  }}
                >
                  Upcoming Comm.
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border)',
                    color: '#8b5cf6',
                  }}
                >
                  Withdrawn
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
                    color: '#ef4444',
                  }}
                >
                  Balance
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
              ) : filteredAgents.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{ padding: '20px 12px', opacity: 0.7, textAlign: 'center' }}
                  >
                    {searchTerm
                      ? 'No agents match your search'
                      : 'No agents found. Agents will appear here once they submit orders.'}
                  </td>
                </tr>
              ) : (
                filteredAgents.map((a, idx) => {
                  const rawBalance =
                    Number(a.deliveredCommissionPKR || 0) -
                    Number(a.withdrawnPKR || 0) -
                    Number(a.pendingPKR || 0)
                  const balance = Math.max(0, rawBalance)
                  return (
                    <tr
                      key={String(a.id)}
                      style={{
                        borderTop: '1px solid var(--border)',
                        background: idx % 2 ? 'transparent' : 'var(--panel)',
                      }}
                    >
                      <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 700, color: '#8b5cf6' }}>
                          {a.name || 'Unnamed'}
                        </div>
                        <div className="helper">{a.phone || ''}</div>
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'center',
                          borderRight: '1px solid var(--border)',
                        }}
                      >
                        <span style={{ color: '#6366f1', fontWeight: 700 }}>
                          {num(a.ordersSubmitted || 0)}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'center',
                          borderRight: '1px solid var(--border)',
                        }}
                      >
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>
                          {num(a.ordersDelivered || 0)}
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
                          AED {num(a.deliveredOrderValueAED || a.totalOrderValueAED || 0)}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          borderRight: '1px solid var(--border)',
                        }}
                      >
                        <span style={{ color: '#10b981', fontWeight: 800 }}>
                          PKR {num(a.deliveredCommissionPKR)}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          borderRight: '1px solid var(--border)',
                        }}
                      >
                        <span style={{ color: '#3b82f6', fontWeight: 800 }}>
                          PKR {num(a.upcomingCommissionPKR)}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          borderRight: '1px solid var(--border)',
                        }}
                      >
                        <span style={{ color: '#8b5cf6', fontWeight: 800 }}>
                          PKR {num(a.withdrawnPKR)}
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
                          PKR {num(a.pendingPKR)}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          borderRight: '1px solid var(--border)',
                        }}
                      >
                        <span
                          style={{
                            color: balance > 0 ? '#10b981' : 'var(--text-muted)',
                            fontWeight: 800,
                          }}
                        >
                          PKR {num(balance)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {balance > 0 ? (
                          <button
                            className="btn success"
                            style={{ fontSize: 12, padding: '6px 12px' }}
                            disabled={payingAgent === a.id}
                            onClick={() => {
                              const totalOrderValueAED =
                                a.deliveredOrderValueAED || a.totalOrderValueAED || 0
                              const pkrRate = 76
                              const totalInPKR = totalOrderValueAED * pkrRate
                              const defaultCommission = (totalInPKR * 12) / 100

                              setPayModal({
                                agent: a,
                                balance,
                                totalOrderValueAED,
                                deliveredCommission: a.deliveredCommissionPKR || 0,
                              })
                              setCommissionRate(null)
                              setCalculatedAmount(defaultCommission)
                            }}
                          >
                            Pay Commission
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            No balance
                          </span>
                        )}
                        <button
                          className="btn secondary"
                          style={{ fontSize: 12, padding: '6px 12px', marginLeft: 8 }}
                          onClick={() => fetchHistory(a)}
                        >
                          History
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Commission Modal */}
      <Modal
        title="Pay Agent Commission"
        open={!!payModal}
        onClose={() => {
          setPayModal(null)
          setCommissionRate(null)
          setCalculatedAmount(0)
        }}
        footer={
          <>
            <button
              className="btn secondary"
              onClick={() => setPayModal(null)}
              disabled={!!payingAgent}
            >
              Cancel
            </button>
            <button
              className="btn success"
              disabled={!!payingAgent}
              onClick={async () => {
                const finalRate = commissionRate || 12
                if (calculatedAmount <= 0) {
                  toast.error('Payment amount must be greater than 0')
                  return
                }
                setPayingAgent(payModal.agent.id)
                try {
                  await apiPost(`/api/finance/agents/${payModal.agent.id}/pay-commission`, {
                    amount: calculatedAmount,
                    commissionRate: finalRate,
                    totalOrderValueAED: payModal.totalOrderValueAED,
                  })
                  toast.success(`Commission payment sent successfully (${finalRate}% rate)`)
                  setPayModal(null)
                  setCommissionRate(null)
                  setCalculatedAmount(0)
                  // Refresh data
                  const r = await apiGet('/api/finance/agents/commission?limit=100')
                  setAgents(Array.isArray(r?.agents) ? r.agents : [])
                } catch (e) {
                  toast.error(e?.message || 'Failed to send payment')
                } finally {
                  setPayingAgent(null)
                }
              }}
            >
              {payingAgent ? 'Sending...' : 'Confirm Payment'}
            </button>
          </>
        }
      >
        {payModal && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ fontSize: 16, marginBottom: 24, textAlign: 'center' }}>
              Send{' '}
              <strong style={{ color: '#10b981', fontSize: 20 }}>
                PKR {num(calculatedAmount)}
              </strong>{' '}
              commission to <strong style={{ color: '#8b5cf6' }}>{payModal.agent.name}</strong>?
            </div>

            {/* Commission Rate Selector */}
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
                <label style={{ fontWeight: 600, fontSize: 14 }}>Commission Rate:</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={commissionRate !== null ? commissionRate : 12}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0
                      setCommissionRate(val)
                      // Calculate: AED to PKR, then apply commission rate
                      const pkrRate = 76
                      const totalInPKR = payModal.totalOrderValueAED * pkrRate
                      setCalculatedAmount((totalInPKR * val) / 100)
                    }}
                    style={{
                      width: 70,
                      padding: '8px',
                      textAlign: 'right',
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                    className="input"
                  />
                  <span style={{ fontSize: 18, fontWeight: 700 }}>%</span>
                </div>
              </div>

              {/* Quick Rate Buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {[8, 10, 12, 15, 18, 20, 25].map((rate) => (
                  <button
                    key={rate}
                    className="btn"
                    style={{
                      fontSize: 12,
                      padding: '6px 12px',
                      background: (commissionRate || 12) === rate ? '#8b5cf6' : 'var(--panel-2)',
                      color: (commissionRate || 12) === rate ? '#fff' : 'inherit',
                    }}
                    onClick={() => {
                      setCommissionRate(rate)
                      const pkrRate = 76
                      const totalInPKR = payModal.totalOrderValueAED * pkrRate
                      setCalculatedAmount((totalInPKR * rate) / 100)
                    }}
                  >
                    {rate}%
                  </button>
                ))}
                <button
                  className="btn secondary"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                  onClick={() => {
                    setCommissionRate(null)
                    const pkrRate = 76
                    const totalInPKR = payModal.totalOrderValueAED * pkrRate
                    setCalculatedAmount((totalInPKR * 12) / 100)
                  }}
                >
                  Reset
                </button>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Total Orders: AED {num(payModal.totalOrderValueAED)} → PKR{' '}
                {num(payModal.totalOrderValueAED * 76)} | Commission:{' '}
                {commissionRate !== null ? commissionRate : 12}% of PKR{' '}
                {num(payModal.totalOrderValueAED * 76)} = PKR {num(calculatedAmount)}
              </div>
            </div>

            <div style={{ background: 'var(--panel)', padding: 12, borderRadius: 8, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>Agent:</span>
                <strong>{payModal.agent.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>Phone:</span>
                <strong>{payModal.agent.phone}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>Total Order Value:</span>
                <strong>AED {num(payModal.totalOrderValueAED)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>Commission Rate:</span>
                <strong style={{ color: '#8b5cf6', fontSize: 16 }}>
                  {commissionRate !== null ? commissionRate : 12}%
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
                  PKR {num(calculatedAmount)}
                </strong>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* History Modal */}
      <Modal
        title={`Commission History: ${historyModal?.name || ''}`}
        open={!!historyModal}
        onClose={() => {
          setHistoryModal(null)
          setHistoryData([])
        }}
        footer={
          <button className="btn secondary" onClick={() => setHistoryModal(null)}>
            Close
          </button>
        }
      >
        <div style={{ minHeight: 200 }}>
          {loadingHistory ? (
            <div className="helper" style={{ textAlign: 'center', padding: 20 }}>
              Loading history...
            </div>
          ) : historyData.length === 0 ? (
            <div className="helper" style={{ textAlign: 'center', padding: 20 }}>
              No payment history found.
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 14,
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: 8, color: 'var(--text-muted)' }}>
                    Date
                  </th>
                  <th style={{ textAlign: 'right', padding: 8, color: 'var(--text-muted)' }}>
                    Amount
                  </th>
                  <th style={{ textAlign: 'center', padding: 8, color: 'var(--text-muted)' }}>
                    Rate
                  </th>
                  <th style={{ textAlign: 'left', padding: 8, color: 'var(--text-muted)' }}>
                    Paid By
                  </th>
                </tr>
              </thead>
              <tbody>
                {historyData.map((h) => (
                  <tr key={h._id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 8 }}>
                      {new Date(h.createdAt).toLocaleDateString()}{' '}
                      <span className="helper" style={{ fontSize: 11 }}>
                        {new Date(h.createdAt).toLocaleTimeString()}
                      </span>
                    </td>
                    <td
                      style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: '#10b981' }}
                    >
                      {h.currency} {num(h.amount)}
                    </td>
                    <td style={{ padding: 8, textAlign: 'center' }}>
                      {/* Try to infer rate if not stored directly, or just show - */}-
                    </td>
                    <td style={{ padding: 8 }}>
                      {h.approver
                        ? `${h.approver.firstName || ''} ${h.approver.lastName || ''}`
                        : 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    </div>
  )
}
