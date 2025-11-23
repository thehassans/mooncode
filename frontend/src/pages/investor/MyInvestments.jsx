import React, { useEffect, useState } from 'react'
import { API_BASE, apiGet } from '../../api'
import { io } from 'socket.io-client'

export default function MyInvestments() {
  const [investorData, setInvestorData] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [dailyProfits, setDailyProfits] = useState([])
  const [profitSummary, setProfitSummary] = useState(null)

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
      const [userData, ordersData, profitsData] = await Promise.all([
        apiGet('/api/users/me'),
        apiGet('/api/investor/my-orders'),
        apiGet('/api/investor/daily-profits'),
      ])

      setInvestorData(userData.user)
      setOrders(ordersData.orders || [])
      setDailyProfits(profitsData.dailyProfits || [])
      setProfitSummary(profitsData.summary || null)
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
      style={{
        display: 'grid',
        gap: 32,
        maxWidth: 1400,
        margin: '0 auto',
        padding: '32px 24px',
        background: 'linear-gradient(180deg, rgba(102, 126, 234, 0.03) 0%, transparent 100%)',
      }}
    >
      {/* Premium Header */}
      <div
        style={{
          position: 'relative',
          padding: '48px 40px',
          borderRadius: 28,
          background:
            'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          boxShadow:
            '0 8px 32px rgba(102, 126, 234, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Animated background orbs */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 300,
            height: 300,
            background: 'radial-gradient(circle, rgba(102, 126, 234, 0.15) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'float 6s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            left: -80,
            width: 250,
            height: 250,
            background: 'radial-gradient(circle, rgba(118, 75, 162, 0.12) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'float 8s ease-in-out infinite reverse',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <div
              style={{
                fontSize: 48,
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
                animation: 'pulse 3s ease-in-out infinite',
              }}
            >
              💎
            </div>
            <h1
              style={{
                fontSize: 42,
                fontWeight: 900,
                margin: 0,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}
            >
              My Investment Portfolio
            </h1>
          </div>
          <p style={{ fontSize: 16, opacity: 0.75, margin: '0 0 8px 0', fontWeight: 500 }}>
            Track your daily earnings and watch your wealth grow with variable profit distribution
          </p>
          {dailyProfit > 0 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 16,
                background:
                  'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <span style={{ fontSize: 20 }}>🎯</span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>
                Today's Earnings:{' '}
                <span style={{ color: '#10b981' }}>
                  {currency} {formatCurrency(dailyProfit)}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 120 }}>
          <div
            style={{
              display: 'inline-block',
              width: 60,
              height: 60,
              border: '6px solid rgba(102, 126, 234, 0.1)',
              borderTopColor: '#667eea',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          ></div>
          <div style={{ marginTop: 24, fontSize: 18, fontWeight: 600, opacity: 0.7 }}>
            Loading your portfolio...
          </div>
        </div>
      ) : (
        <>
          {/* Premium Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            {/* Daily Profit Card */}
            <div
              style={{
                position: 'relative',
                background:
                  'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)',
                backdropFilter: 'blur(20px)',
                borderRadius: 24,
                padding: 28,
                border: '1px solid rgba(16, 185, 129, 0.2)',
                boxShadow:
                  '0 8px 32px rgba(16, 185, 129, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
                e.currentTarget.style.boxShadow =
                  '0 20px 60px rgba(16, 185, 129, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow =
                  '0 8px 32px rgba(16, 185, 129, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -60,
                  right: -60,
                  width: 180,
                  height: 180,
                  background:
                    'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)',
                  borderRadius: '50%',
                }}
              />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      opacity: 0.85,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 1.5,
                      color: '#10b981',
                    }}
                  >
                    Daily Profit
                  </div>
                  <div style={{ fontSize: 28, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>
                    💰
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 900,
                    color: '#10b981',
                    marginBottom: 4,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {currency} {formatCurrency(dailyProfit)}
                </div>
              </div>
            </div>

            {/* Investment Amount Card */}
            <div
              style={{
                position: 'relative',
                background:
                  'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                backdropFilter: 'blur(20px)',
                borderRadius: 24,
                padding: 28,
                border: '1px solid rgba(102, 126, 234, 0.2)',
                boxShadow:
                  '0 8px 32px rgba(102, 126, 234, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
                e.currentTarget.style.boxShadow =
                  '0 20px 60px rgba(102, 126, 234, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow =
                  '0 8px 32px rgba(102, 126, 234, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -60,
                  right: -60,
                  width: 180,
                  height: 180,
                  background:
                    'radial-gradient(circle, rgba(102, 126, 234, 0.3) 0%, transparent 70%)',
                  borderRadius: '50%',
                }}
              />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      opacity: 0.85,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 1.5,
                      color: '#667eea',
                    }}
                  >
                    Investment
                  </div>
                  <div style={{ fontSize: 28, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>
                    🏦
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 900,
                    color: '#667eea',
                    marginBottom: 4,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {currency} {formatCurrency(investmentAmount)}
                </div>
              </div>
            </div>

            {/* Monthly Target Card */}
            <div
              style={{
                position: 'relative',
                background:
                  'linear-gradient(135deg, rgba(245, 87, 108, 0.1) 0%, rgba(240, 147, 251, 0.1) 100%)',
                backdropFilter: 'blur(20px)',
                borderRadius: 24,
                padding: 28,
                border: '1px solid rgba(245, 87, 108, 0.2)',
                boxShadow:
                  '0 8px 32px rgba(245, 87, 108, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
                e.currentTarget.style.boxShadow =
                  '0 20px 60px rgba(245, 87, 108, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow =
                  '0 8px 32px rgba(245, 87, 108, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -60,
                  right: -60,
                  width: 180,
                  height: 180,
                  background:
                    'radial-gradient(circle, rgba(245, 87, 108, 0.3) 0%, transparent 70%)',
                  borderRadius: '50%',
                }}
              />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      opacity: 0.85,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 1.5,
                      color: '#f5576c',
                    }}
                  >
                    Monthly Target
                  </div>
                  <div style={{ fontSize: 28, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>
                    🎯
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 900,
                    color: '#f5576c',
                    marginBottom: 4,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {currency} {formatCurrency(profitAmount)}
                </div>
              </div>
            </div>

            {/* Earned Profit Card */}
            <div
              style={{
                position: 'relative',
                background:
                  'linear-gradient(135deg, rgba(79, 172, 254, 0.1) 0%, rgba(0, 242, 254, 0.1) 100%)',
                backdropFilter: 'blur(20px)',
                borderRadius: 24,
                padding: 28,
                border: '1px solid rgba(79, 172, 254, 0.2)',
                boxShadow:
                  '0 8px 32px rgba(79, 172, 254, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
                e.currentTarget.style.boxShadow =
                  '0 20px 60px rgba(79, 172, 254, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow =
                  '0 8px 32px rgba(79, 172, 254, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -60,
                  right: -60,
                  width: 180,
                  height: 180,
                  background:
                    'radial-gradient(circle, rgba(79, 172, 254, 0.3) 0%, transparent 70%)',
                  borderRadius: '50%',
                }}
              />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      opacity: 0.85,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 1.5,
                      color: '#4facfe',
                    }}
                  >
                    Earned
                  </div>
                  <div style={{ fontSize: 28, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>
                    ✨
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 900,
                    color: '#4facfe',
                    marginBottom: 4,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {currency} {formatCurrency(earnedProfit)}
                </div>
                <div style={{ fontSize: 13, opacity: 0.75, fontWeight: 600 }}>
                  From {orders.length} order{orders.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Total Return Card */}
            <div
              style={{
                position: 'relative',
                background:
                  'linear-gradient(135deg, rgba(250, 112, 154, 0.1) 0%, rgba(254, 225, 64, 0.1) 100%)',
                backdropFilter: 'blur(20px)',
                borderRadius: 24,
                padding: 28,
                border: '1px solid rgba(250, 112, 154, 0.2)',
                boxShadow:
                  '0 8px 32px rgba(250, 112, 154, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
                e.currentTarget.style.boxShadow =
                  '0 20px 60px rgba(250, 112, 154, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow =
                  '0 8px 32px rgba(250, 112, 154, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -60,
                  right: -60,
                  width: 180,
                  height: 180,
                  background:
                    'radial-gradient(circle, rgba(250, 112, 154, 0.3) 0%, transparent 70%)',
                  borderRadius: '50%',
                }}
              />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      opacity: 0.85,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 1.5,
                      color: '#fa709a',
                    }}
                  >
                    Total Return
                  </div>
                  <div style={{ fontSize: 28, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>
                    🚀
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 900,
                    color: '#fa709a',
                    marginBottom: 4,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {currency} {formatCurrency(totalReturn)}
                </div>
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

          {/* Daily Profit History */}
          {dailyProfits.length > 0 && (
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
                  marginBottom: 20,
                }}
              >
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
                  Daily Profit Distribution
                </h2>
                {profitSummary && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>This Month's Progress</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981' }}>
                      {currency} {formatCurrency(profitSummary.totalEarned)} /{' '}
                      {formatCurrency(profitSummary.totalTarget)}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {profitSummary.percentComplete.toFixed(1)}% complete
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  fontSize: 13,
                  opacity: 0.8,
                  marginBottom: 16,
                  padding: 12,
                  background: 'var(--panel)',
                  borderRadius: 8,
                }}
              >
                💡 Your daily profit varies (±30%) but sums to your monthly target. This creates a
                realistic earnings experience!
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {dailyProfits
                  .slice()
                  .reverse()
                  .slice(0, 15)
                  .map((profit, idx) => {
                    const date = new Date(profit.date)
                    const amount = Number(profit.amount || 0)
                    const avgDaily = profitSummary ? profitSummary.totalTarget / 30 : 0
                    const variation = avgDaily > 0 ? ((amount - avgDaily) / avgDaily) * 100 : 0
                    const isAboveAvg = variation > 0

                    return (
                      <div
                        key={profit._id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          background:
                            idx === 0
                              ? 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.1))'
                              : 'var(--panel)',
                          borderRadius: 12,
                          border:
                            idx === 0
                              ? '1px solid rgba(16,185,129,0.3)'
                              : '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ fontSize: 24 }}>{idx === 0 ? '🎯' : '📅'}</div>
                          <div>
                            <div style={{ fontWeight: 700 }}>
                              {date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                              {idx === 0 ? 'Today' : `${idx + 1} day${idx > 0 ? 's' : ''} ago`}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981' }}>
                            +{currency} {formatCurrency(amount)}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: isAboveAvg ? '#10b981' : '#f59e0b',
                            }}
                          >
                            {isAboveAvg ? '↑' : '↓'} {Math.abs(variation).toFixed(1)}%{' '}
                            {isAboveAvg ? 'above' : 'below'} avg
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>

              {dailyProfits.length > 15 && (
                <div style={{ marginTop: 12, textAlign: 'center', fontSize: 13, opacity: 0.7 }}>
                  Showing last 15 days • {dailyProfits.length} total distributions
                </div>
              )}
            </div>
          )}

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

      {/* Premium CSS Animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
      `}</style>
    </div>
  )
}
