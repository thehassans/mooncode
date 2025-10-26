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
    <div className="section" style={{display:'grid', gap:20, padding: isMobile ? '12px' : '20px'}}>
      <div className="page-header" style={{flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 0, alignItems: isMobile ? 'stretch' : 'center'}}>
        <div>
          <div className="page-title" style={{fontSize: isMobile ? 22 : 28}}>Investment Dashboard</div>
          <div className="page-subtitle" style={{fontSize: isMobile ? 13 : 14}}>Track your portfolio performance and earnings</div>
        </div>
        <button className="btn success" onClick={()=> navigate('/investor/me')} style={{width: isMobile ? '100%' : 'auto'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:6}}>
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          Request Payment
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px,1fr))', gap: isMobile ? 12 : 16}}>
        <div className="card" style={{border:'1px solid var(--border)', background:'var(--card-bg)', transition:'transform 0.2s, box-shadow 0.2s'}}>
          <div style={{padding:'20px', display:'flex', alignItems:'center', gap:16}}>
            <div style={{width:48, height:48, borderRadius:12, background:'rgba(102, 126, 234, 0.1)', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, opacity:0.7, marginBottom:4}}>Total Investment</div>
              <div style={{fontSize:24, fontWeight:800, color:'#667eea'}}>{data.currency} {num(data.totalInvestment)}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{border:'1px solid var(--border)', background:'var(--card-bg)', transition:'transform 0.2s, box-shadow 0.2s'}}>
          <div style={{padding:'20px', display:'flex', alignItems:'center', gap:16}}>
            <div style={{width:48, height:48, borderRadius:12, background:'rgba(245, 158, 11, 0.1)', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, opacity:0.7, marginBottom:4}}>Total Units</div>
              <div style={{fontSize:24, fontWeight:800, color:'#f59e0b'}}>{num(data.totalUnits)}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{border:'1px solid var(--border)', background:'var(--card-bg)', transition:'transform 0.2s, box-shadow 0.2s'}}>
          <div style={{padding:'20px', display:'flex', alignItems:'center', gap:16}}>
            <div style={{width:48, height:48, borderRadius:12, background:'rgba(59, 130, 246, 0.1)', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, opacity:0.7, marginBottom:4}}>Delivered Units</div>
              <div style={{fontSize:24, fontWeight:800, color:'#3b82f6'}}>{num(data.totalDeliveredUnits)}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{border:'1px solid var(--border)', background:'var(--card-bg)', transition:'transform 0.2s, box-shadow 0.2s'}}>
          <div style={{padding:'20px', display:'flex', alignItems:'center', gap:16}}>
            <div style={{width:48, height:48, borderRadius:12, background:'rgba(16, 185, 129, 0.1)', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, opacity:0.7, marginBottom:4}}>Total Profit</div>
              <div style={{fontSize:24, fontWeight:800, color:'#10b981'}}>{data.currency} {num(data.totalProfit)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Cards */}
      <div className="card" style={{border:'1px solid var(--border)'}}>  
        <div className="card-header" style={{padding: isMobile ? '16px' : '20px'}}>
          <div className="card-title" style={{display:'flex', alignItems:'center', gap:8, fontSize: isMobile ? 16 : 18}}>
            <svg width={isMobile ? 18 : 20} height={isMobile ? 18 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
