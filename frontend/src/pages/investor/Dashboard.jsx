import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet } from '../../api'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'

export default function InvestorDashboard(){
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(()=> (typeof window!=='undefined' ? window.innerWidth <= 768 : false))
  const [data, setData] = useState({
    totalInvestment: 0,
    currency: 'SAR',
    totalProfit: 0,
    totalDeliveredUnits: 0,
    totalUnits: 0,
    products: []
  })
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    function onResize(){ setIsMobile(window.innerWidth <= 768) }
    window.addEventListener('resize', onResize)
    return ()=> window.removeEventListener('resize', onResize)
  },[])

  useEffect(()=>{
    async function load(){
      try{
        setLoading(true)
        const res = await apiGet('/api/finance/investor/dashboard')
        setData({
          totalInvestment: res.totalInvestment || 0,
          currency: res.currency || 'SAR',
          totalProfit: res.totalProfit || 0,
          totalDeliveredUnits: res.totalDeliveredUnits || 0,
          totalUnits: res.totalUnits || 0,
          products: Array.isArray(res.products) ? res.products : []
        })
      }catch(e){
        console.error('Failed to load dashboard:', e)
      }finally{
        setLoading(false)
      }
    }
    load()
    // Socket live updates
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path: '/socket.io', transports: ['polling'], upgrade:false, auth: { token }, withCredentials: true })
      const refresh = ()=>{ load() }
      socket.on('orders.changed', refresh)
      socket.on('investor-remittance.approved', refresh)
      socket.on('investor-remittance.sent', refresh)
    }catch{}
    return ()=>{
      try{ socket && socket.off('orders.changed') }catch{}
      try{ socket && socket.off('investor-remittance.approved') }catch{}
      try{ socket && socket.off('investor-remittance.sent') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  }, [])

  // Formatting helpers
  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }

  return (
    <div className="section" style={{display:'grid', gap:24, padding: isMobile ? '12px' : '24px', background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.02), rgba(118, 75, 162, 0.03))'}}>
      <div className="page-header" style={{
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 16 : 0,
        alignItems: isMobile ? 'stretch' : 'center',
        padding: isMobile ? '16px' : '24px',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.12))',
        borderRadius: '16px',
        border: '1px solid rgba(102, 126, 234, 0.2)',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.15)',
        backdropFilter: 'blur(10px)'
      }}>
        <div>
          <div className="page-title" style={{
            fontSize: isMobile ? 24 : 32,
            fontWeight: 900,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 6
          }}>💎 Investment Dashboard</div>
          <div className="page-subtitle" style={{
            fontSize: isMobile ? 14 : 16,
            opacity: 0.8,
            fontWeight: 500
          }}>Track your portfolio performance and earnings</div>
        </div>
        <button className="btn success" onClick={()=> navigate('/investor/me')} style={{
          width: isMobile ? '100%' : 'auto',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          border: 'none',
          padding: isMobile ? '12px 20px' : '12px 24px',
          fontWeight: 700,
          fontSize: isMobile ? 14 : 15,
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
          transition: 'all 0.3s ease'
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:8}}>
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          Request Payment
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px,1fr))', gap: isMobile ? 16 : 20}}>
        <div className="card" style={{
          border:'1px solid rgba(102, 126, 234, 0.25)',
          background:'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(102, 126, 234, 0.05))',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.15)',
          backdropFilter: 'blur(10px)',
          transition:'all 0.3s ease',
          cursor: 'default'
        }}>
          <div style={{padding:'24px', display:'flex', alignItems:'center', gap:20}}>
            <div style={{
              width:56,
              height:56,
              borderRadius:16,
              background:'linear-gradient(135deg, #667eea, #764ba2)',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, opacity:0.7, marginBottom:6, fontWeight:600, letterSpacing:0.3}}>Total Investment</div>
              <div style={{fontSize:26, fontWeight:900, color:'#667eea', letterSpacing:-0.5}}>{data.currency} {num(data.totalInvestment)}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{
          border:'1px solid rgba(245, 158, 11, 0.25)',
          background:'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.05))',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(245, 158, 11, 0.15)',
          backdropFilter: 'blur(10px)',
          transition:'all 0.3s ease',
          cursor: 'default'
        }}>
          <div style={{padding:'24px', display:'flex', alignItems:'center', gap:20}}>
            <div style={{
              width:56,
              height:56,
              borderRadius:16,
              background:'linear-gradient(135deg, #f59e0b, #d97706)',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, opacity:0.7, marginBottom:6, fontWeight:600, letterSpacing:0.3}}>Total Units</div>
              <div style={{fontSize:26, fontWeight:900, color:'#f59e0b', letterSpacing:-0.5}}>{num(data.totalUnits)}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{
          border:'1px solid rgba(59, 130, 246, 0.25)',
          background:'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.05))',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(59, 130, 246, 0.15)',
          backdropFilter: 'blur(10px)',
          transition:'all 0.3s ease',
          cursor: 'default'
        }}>
          <div style={{padding:'24px', display:'flex', alignItems:'center', gap:20}}>
            <div style={{
              width:56,
              height:56,
              borderRadius:16,
              background:'linear-gradient(135deg, #3b82f6, #2563eb)',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, opacity:0.7, marginBottom:6, fontWeight:600, letterSpacing:0.3}}>Delivered Units</div>
              <div style={{fontSize:26, fontWeight:900, color:'#3b82f6', letterSpacing:-0.5}}>{num(data.totalDeliveredUnits)}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{
          border:'1px solid rgba(16, 185, 129, 0.25)',
          background:'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.05))',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(16, 185, 129, 0.15)',
          backdropFilter: 'blur(10px)',
          transition:'all 0.3s ease',
          cursor: 'default'
        }}>
          <div style={{padding:'24px', display:'flex', alignItems:'center', gap:20}}>
            <div style={{
              width:56,
              height:56,
              borderRadius:16,
              background:'linear-gradient(135deg, #10b981, #059669)',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, opacity:0.7, marginBottom:6, fontWeight:600, letterSpacing:0.3}}>Total Profit</div>
              <div style={{fontSize:26, fontWeight:900, color:'#10b981', letterSpacing:-0.5}}>{data.currency} {num(data.totalProfit)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Cards */}
      <div className="card" style={{
        border:'1px solid rgba(102, 126, 234, 0.2)',
        background:'linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.08))',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.12)',
        backdropFilter: 'blur(10px)'
      }}>  
        <div className="card-header" style={{
          padding: isMobile ? '20px' : '24px',
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
          borderBottom: '1px solid rgba(102, 126, 234, 0.15)'
        }}>
          <div className="card-title" style={{
            display:'flex',
            alignItems:'center',
            gap:12,
            fontSize: isMobile ? 18 : 22,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            <svg width={isMobile ? 22 : 24} height={isMobile ? 22 : 24} viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            Your Investment Products
          </div>
        </div>
        {loading ? (
          <div style={{padding: isMobile ? 30 : 40, textAlign:'center', opacity:0.6}}>
            <div style={{width: isMobile ? 32 : 40, height: isMobile ? 32 : 40, border:'3px solid var(--border)', borderTopColor:'#8b5cf6', borderRadius:'50%', margin:'0 auto 16px', animation:'spin 0.8s linear infinite'}} />
            <div style={{fontSize: isMobile ? 13 : 14}}>Loading products...</div>
          </div>
        ) : data.products.length === 0 ? (
          <div style={{padding: isMobile ? 30 : 40, textAlign:'center', opacity:0.6}}>
            <svg width={isMobile ? 40 : 48} height={isMobile ? 40 : 48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{margin:'0 auto 16px', opacity:0.3}}>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            <div style={{fontSize: isMobile ? 13 : 14}}>No products assigned yet</div>
          </div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: isMobile ? 16 : 20, padding: isMobile ? 12 : 16}}>
            {data.products.map((p, idx) => (
              <div key={idx} className="card" style={{border:'1px solid var(--border)', padding:0, overflow:'hidden', background:'var(--card-bg)', transition:'transform 0.2s, box-shadow 0.2s', cursor:'default'}}>
                {/* Product Image */}
                <div style={{width:'100%', height: isMobile ? 180 : 220, overflow:'hidden', background:'var(--panel)', position:'relative'}}>
                  {p.product?.image ? (
                    <img 
                      src={`${API_BASE}${p.product.image}`} 
                      alt={p.product.name}
                      style={{width:'100%', height:'100%', objectFit:'cover'}}
                      onError={(e)=> {
                        e.target.style.display='none'
                        e.target.parentElement.style.background='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      }}
                    />
                  ) : (
                    <div style={{width:'100%', height:'100%', background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display:'flex', alignItems:'center', justifyContent:'center'}}>
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      </svg>
                    </div>
                  )}
                  <div style={{position:'absolute', top: isMobile ? 8 : 12, right: isMobile ? 8 : 12, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(10px)', padding: isMobile ? '4px 10px' : '6px 12px', borderRadius:20, color:'#fff', fontSize: isMobile ? 11 : 12, fontWeight:700, boxShadow:'0 2px 8px rgba(0,0,0,0.2)'}}>
                    {p.country}
                  </div>
                </div>
                
                {/* Product Info */}
                <div style={{padding: isMobile ? 16 : 20}}>
                  <div style={{fontSize: isMobile ? 16 : 18, fontWeight:700, marginBottom: isMobile ? 4 : 6, lineHeight:1.3}}>{p.product?.name || 'Product'}</div>
                  {p.product?.description && (
                    <div style={{fontSize: isMobile ? 12 : 13, opacity:0.6, marginBottom: isMobile ? 12 : 16, lineHeight:1.6, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{p.product.description}</div>
                  )}
                  
                  {/* Stats Grid */}
                  <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: isMobile ? 8 : 12, marginBottom: isMobile ? 12 : 16}}>
                    <div style={{background:'var(--panel)', padding: isMobile ? 10 : 12, borderRadius:8, border:'1px solid var(--border)'}}>
                      <div className="helper" style={{fontSize: isMobile ? 10 : 11, marginBottom:4}}>Stock Available</div>
                      <div style={{fontWeight:800, color:'#f59e0b', fontSize: isMobile ? 14 : 16}}>{num(p.stock)}</div>
                    </div>
                    <div style={{background:'var(--panel)', padding: isMobile ? 10 : 12, borderRadius:8, border:'1px solid var(--border)'}}>
                      <div className="helper" style={{fontSize: isMobile ? 10 : 11, marginBottom:4}}>Price/Unit</div>
                      <div style={{fontWeight:800, color:'#10b981', fontSize: isMobile ? 14 : 16}}>{data.currency} {num(p.product?.price || 0)}</div>
                    </div>
                    <div style={{background:'var(--panel)', padding: isMobile ? 10 : 12, borderRadius:8, border:'1px solid var(--border)'}}>
                      <div className="helper" style={{fontSize: isMobile ? 10 : 11, marginBottom:4}}>Your Commission</div>
                      <div style={{fontWeight:800, color:'#10b981', fontSize: isMobile ? 14 : 16}}>{data.currency} {num(p.profitPerUnit)}</div>
                    </div>
                    <div style={{background:'var(--panel)', padding: isMobile ? 10 : 12, borderRadius:8, border:'1px solid var(--border)'}}>
                      <div className="helper" style={{fontSize: isMobile ? 10 : 11, marginBottom:4}}>Total Orders</div>
                      <div style={{fontWeight:800, color:'#8b5cf6', fontSize: isMobile ? 14 : 16}}>{num(p.totalUnits)}</div>
                    </div>
                  </div>

                  {/* Performance */}
                  <div style={{padding: isMobile ? 12 : 16, background:'var(--panel)', borderRadius:10, border:'1px solid var(--border)'}}>
                    <div style={{fontSize: isMobile ? 11 : 12, fontWeight:600, opacity:0.7, marginBottom: isMobile ? 10 : 12}}>Performance Summary</div>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: isMobile ? 6 : 8}}>
                      <span style={{fontSize: isMobile ? 12 : 13, opacity:0.7}}>Delivered Orders</span>
                      <strong style={{color:'#3b82f6', fontSize: isMobile ? 14 : 15}}>{num(p.deliveredUnits)}</strong>
                    </div>
                    <div style={{height:1, background:'var(--border)', margin: isMobile ? '10px 0' : '12px 0'}} />
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span style={{fontSize: isMobile ? 12 : 13, fontWeight:600}}>Your Total Profit</span>
                      <strong style={{color:'#10b981', fontSize: isMobile ? 16 : 18, fontWeight:800}}>{data.currency} {num(p.totalProfit)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
