import React, { useEffect, useState } from 'react'
import { API_BASE, apiGet } from '../../api'
import { io } from 'socket.io-client'

export default function MyInvestments() {
  const [investorData, setInvestorData] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()

    // Socket for real-time updates
    let socket
    try {
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, {
        path: '/socket.io',
        transports: ['polling'],
        upgrade: false,
        auth: { token },
        withCredentials: true,
      })
      socket.on('investor.updated', loadData)
      socket.on('orders.changed', loadData)
    } catch (e) {}

    return () => {
      try {
        if (socket) {
          socket.off('investor.updated')
          socket.off('orders.changed')
          socket.disconnect()
        }
      } catch (e) {}
    }
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [userData, ordersData] = await Promise.all([
        apiGet('/api/users/me'),
        apiGet('/api/investor/my-orders'),
      ])

      setInvestorData(userData.user)
      setOrders(ordersData.orders || [])
    } catch (e) {
      console.error('Failed to load data:', e)
    } finally {
      setLoading(false)
    }
  }

  function formatCurrency(val) {
    return Number(val || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  const profile = investorData?.investorProfile || {}
  const investmentAmount = profile.investmentAmount || 0
  const profitPercentage = profile.profitPercentage || 15
  const profitAmount = profile.profitAmount || 0
  const earnedProfit = profile.earnedProfit || 0
  const totalReturn = profile.totalReturn || investmentAmount
  const currency = profile.currency || 'SAR'
  const status = profile.status || 'active'
  const progressPercentage =
    profitAmount > 0 ? Math.min(100, (earnedProfit / profitAmount) * 100) : 0
  const dailyProfit =
    investmentAmount > 0 && profitPercentage > 0
      ? (investmentAmount * (profitPercentage / 100)) / 30
      : 0

  return (
    <div
      className="section"
      style={{ display: 'grid', gap: 24, maxWidth: 1400, margin: '0 auto', padding: '24px' }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 800,
              margin: 0,
              background: 'linear-gradient(135deg, #10b981 0%, #22c55e 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            My Daily Profit
          </h1>
          <p style={{ fontSize: 15, opacity: 0.7, margin: '8px 0 0 0' }}>
            See how much you earn every day from your invested amount based on your profit
            percentage target divided by 30 days.
          </p>
          <p style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 0 0' }}>
            Today's estimated earnings:{' '}
            <strong>
              {currency} {formatCurrency(dailyProfit)}
            </strong>
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div
            style={{
              display: 'inline-block',
              width: 50,
              height: 50,
              border: '5px solid var(--border)',
              borderTopColor: '#667eea',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          ></div>
          <div style={{ marginTop: 20, fontSize: 16, opacity: 0.7 }}>
            Loading investment data...
          </div>
        </div>
      ) : (
        <>
          {/* Daily & Investment Overview */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {/* Daily Profit (10% / 30) */}
            <div
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #22c55e 100%)',
                borderRadius: 16,
                padding: 24,
                color: '#fff',
                boxShadow: '0 10px 40px rgba(34, 197, 94, 0.35)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 120,
                  height: 120,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                }}
              ></div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.9,
                    marginBottom: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  Daily Profit
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}>
                  {currency} {formatCurrency(dailyProfit)}
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Based on {currency} {formatCurrency(investmentAmount)} × {profitPercentage}% ÷ 30
                </div>
              </div>
            </div>

            {/* Investment Amount */}
            <div
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 16,
                padding: 24,
                color: '#fff',
                boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 120,
                  height: 120,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                }}
              ></div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.9,
                    marginBottom: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  Investment Amount
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}>
                  {currency} {formatCurrency(investmentAmount)}
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>Initial capital invested</div>
              </div>
            </div>

            {/* Profit Amount */}
            <div
              style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                borderRadius: 16,
                padding: 24,
                color: '#fff',
                boxShadow: '0 10px 40px rgba(245, 87, 108, 0.3)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 120,
                  height: 120,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                }}
              ></div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.9,
                    marginBottom: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  Profit Amount Target
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}>
                  {currency} {formatCurrency(profitAmount)}
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>Goal to achieve from orders</div>
              </div>
            </div>

            {/* Earned Profit */}
            <div
              style={{
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                borderRadius: 16,
                padding: 24,
                color: '#fff',
                boxShadow: '0 10px 40px rgba(79, 172, 254, 0.3)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 120,
                  height: 120,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                }}
              ></div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.9,
                    marginBottom: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  Earned Profit
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}>
                  {currency} {formatCurrency(earnedProfit)}
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  From {orders.length} order{orders.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Total Return */}
            <div
              style={{
                background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                borderRadius: 16,
                padding: 24,
                color: '#fff',
                boxShadow: '0 10px 40px rgba(250, 112, 154, 0.3)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 120,
                  height: 120,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                }}
              ></div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.9,
                    marginBottom: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  Total Return
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}>
                  {currency} {formatCurrency(totalReturn)}
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>Investment + Profit</div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              background: 'var(--card-bg)',
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Investment Progress</h2>
              <span
                style={{
                  padding: '6px 16px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 700,
                  background:
                    status === 'completed'
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#fff',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {status}
              </span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  height: 32,
                  background: 'var(--panel)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progressPercentage}%`,
                    background:
                      status === 'completed'
                        ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: 16,
                    transition: 'width 0.5s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 16,
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {progressPercentage > 10 && `${progressPercentage.toFixed(1)}%`}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 14,
                opacity: 0.8,
              }}
            >
              <span>
                Earned: {currency} {formatCurrency(earnedProfit)}
              </span>
              <span>
                Target: {currency} {formatCurrency(profitAmount)}
              </span>
            </div>

            {status !== 'completed' && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: 'var(--panel)',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <strong>Remaining:</strong> {currency}{' '}
                {formatCurrency(Math.max(0, profitAmount - earnedProfit))}
                <span style={{ opacity: 0.7, marginLeft: 8 }}>
                  ({Math.max(0, 100 - progressPercentage).toFixed(1)}% to go)
                </span>
              </div>
            )}

            <div
              style={{
                marginTop: 12,
                padding: 12,
                background:
                  'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                borderRadius: 8,
                border: '1px solid rgba(102, 126, 234, 0.2)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                📊 Investment Details
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  opacity: 0.8,
                  marginBottom: 4,
                }}
              >
                <span>Profit per Order:</span>
                <strong>{profitPercentage}%</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  opacity: 0.8,
                }}
              >
                <span>Orders Contributing:</span>
                <strong>
                  {orders.length} order{orders.length !== 1 ? 's' : ''}
                </strong>
              </div>
            </div>
          </div>

          {/* Orders with Profit */}
          <div
            style={{
              background: 'var(--card-bg)',
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 20px 0' }}>
              Orders Contributing to Your Profit
            </h2>

            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, opacity: 0.7 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>No orders yet</div>
                <div style={{ fontSize: 14, marginTop: 4 }}>
                  Profits will be assigned from delivered orders sequentially
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr style={{ background: 'var(--panel)' }}>
                      <th
                        style={{
                          padding: 12,
                          textAlign: 'left',
                          borderBottom: '2px solid var(--border)',
                        }}
                      >
                        Order #
                      </th>
                      <th
                        style={{
                          padding: 12,
                          textAlign: 'left',
                          borderBottom: '2px solid var(--border)',
                        }}
                      >
                        Date
                      </th>
                      <th
                        style={{
                          padding: 12,
                          textAlign: 'left',
                          borderBottom: '2px solid var(--border)',
                        }}
                      >
                        Customer
                      </th>
                      <th
                        style={{
                          padding: 12,
                          textAlign: 'left',
                          borderBottom: '2px solid var(--border)',
                        }}
                      >
                        Order Total
                      </th>
                      <th
                        style={{
                          padding: 12,
                          textAlign: 'left',
                          borderBottom: '2px solid var(--border)',
                        }}
                      >
                        Your Profit
                      </th>
                      <th
                        style={{
                          padding: 12,
                          textAlign: 'left',
                          borderBottom: '2px solid var(--border)',
                        }}
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, idx) => (
                      <tr key={order._id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 12, fontWeight: 700 }}>
                          {order.invoiceNumber || `#${String(order._id).slice(-6)}`}
                        </td>
                        <td style={{ padding: 12 }}>
                          {new Date(order.deliveredAt || order.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: 12 }}>{order.customerName || 'N/A'}</td>
                        <td style={{ padding: 12, fontWeight: 600 }}>
                          {currency} {formatCurrency(order.total)}
                        </td>
                        <td style={{ padding: 12, color: '#10b981', fontWeight: 800 }}>
                          +{currency} {formatCurrency(order.investorProfit?.profitAmount || 0)}
                        </td>
                        <td style={{ padding: 12 }}>
                          <span
                            style={{
                              padding: '4px 12px',
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 600,
                              background: 'rgba(16, 185, 129, 0.1)',
                              color: '#10b981',
                            }}
                          >
                            Delivered
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Inline CSS */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
