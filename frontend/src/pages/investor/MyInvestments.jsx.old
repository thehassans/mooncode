import React, { useEffect, useState } from 'react';
import { API_BASE, apiGet } from '../../api';
import { io } from 'socket.io-client';

export default function MyInvestments() {
  const [investments, setInvestments] = useState([]);
  const [stats, setStats] = useState({
    totalInvested: 0,
    totalProfit: 0,
    totalRevenue: 0,
    roi: 0,
    activeInvestments: 0,
    currency: 'SAR'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvestments();
    loadStats();

    // Socket for real-time updates
    let socket;
    try {
      const token = localStorage.getItem('token') || '';
      socket = io(API_BASE || undefined, {
        path: '/socket.io',
        transports: ['polling'],
        upgrade: false,
        auth: { token },
        withCredentials: true
      });
      socket.on('investment.created', loadInvestments);
      socket.on('investment.withdrawn', loadInvestments);
    } catch (e) {}

    return () => {
      try {
        if (socket) {
          socket.off('investment.created');
          socket.off('investment.withdrawn');
          socket.disconnect();
        }
      } catch (e) {}
    };
  }, []);

  async function loadInvestments() {
    try {
      const data = await apiGet('/api/investor/my-investments');
      setInvestments(data.investments || []);
    } catch (e) {
      console.error('Failed to load investments:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const data = await apiGet('/api/investor/dashboard');
      setStats(data);
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  }

  function formatCurrency(val) {
    return Number(val || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  return (
    <div className="section" style={{ display: 'grid', gap: 24, maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            My Investments
          </h1>
          <p style={{ fontSize: 15, opacity: 0.7, margin: '8px 0 0 0' }}>Track your portfolio and performance</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {/* Total Invested */}
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 16, padding: 24, color: '#fff', boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Total Invested</div>
            <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}>{stats.currency} {formatCurrency(stats.totalInvested)}</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{stats.activeInvestments} active investment{stats.activeInvestments !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Total Profit */}
        <div style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', borderRadius: 16, padding: 24, color: '#fff', boxShadow: '0 10px 40px rgba(245, 87, 108, 0.3)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Total Profit</div>
            <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}>{stats.currency} {formatCurrency(stats.totalProfit)}</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>From all investments</div>
          </div>
        </div>

        {/* Total Revenue */}
        <div style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', borderRadius: 16, padding: 24, color: '#fff', boxShadow: '0 10px 40px rgba(79, 172, 254, 0.3)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Total Revenue</div>
            <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}>{stats.currency} {formatCurrency(stats.totalRevenue)}</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Generated revenue</div>
          </div>
        </div>

        {/* ROI */}
        <div style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', borderRadius: 16, padding: 24, color: '#fff', boxShadow: '0 10px 40px rgba(250, 112, 154, 0.3)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>ROI</div>
            <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}>{stats.roi}%</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Return on Investment</div>
          </div>
        </div>
      </div>

      {/* Investments List */}
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Investment Portfolio</h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ display: 'inline-block', width: 40, height: 40, border: '4px solid var(--border)', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <div style={{ marginTop: 16, opacity: 0.7 }}>Loading investments...</div>
          </div>
        ) : investments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, opacity: 0.7 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No investments yet</div>
            <div style={{ fontSize: 14 }}>Start investing in products to build your portfolio</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {investments.map((inv) => (
              <div
                key={inv._id}
                style={{
                  background: 'var(--panel)',
                  borderRadius: 16,
                  padding: 20,
                  border: '1px solid var(--border)',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 20,
                  alignItems: 'center',
                  transition: 'all 0.3s ease',
                  cursor: 'default'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Product Image */}
                <div style={{ width: 80, height: 80, borderRadius: 12, overflow: 'hidden', background: 'var(--panel-2)' }}>
                  {inv.product?.image ? (
                    <img
                      src={`${API_BASE}${inv.product.image}`}
                      alt={inv.product?.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📦</div>
                  )}
                </div>

                {/* Investment Details */}
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{inv.product?.name || 'Product'}</div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>Invested on {new Date(inv.createdAt).toLocaleDateString()}</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Investment</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#667eea' }}>{inv.currency} {formatCurrency(inv.amount)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Quantity</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#4facfe' }}>{inv.quantity} units</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Sold</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#f5576c' }}>{inv.unitsSold} units</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Revenue</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#00f2fe' }}>{inv.currency} {formatCurrency(inv.totalRevenue)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Profit</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>{inv.currency} {formatCurrency(inv.totalProfit)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>ROI</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: inv.roi > 0 ? '#10b981' : '#ef4444' }}>{inv.roi}%</div>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <span
                    style={{
                      padding: '6px 16px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5
                    }}
                  >
                    Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inline CSS for animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: 'auto 1fr auto'"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
