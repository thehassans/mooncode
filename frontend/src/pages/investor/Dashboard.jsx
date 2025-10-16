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
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-purple">Investment Dashboard</div>
          <div className="page-subtitle">Track your portfolio performance and earnings</div>
        </div>
        <button className="btn" onClick={()=> navigate('/investor/me')}>💰 Request Payment</button>
      </div>

      {/* Summary Cards */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:12}}>
        <div className="card" style={{background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>💼 Total Investment</div>
            <div style={{fontSize:28, fontWeight:800}}>{data.currency} {num(data.totalInvestment)}</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>📦 Total Units</div>
            <div style={{fontSize:28, fontWeight:800}}>{num(data.totalUnits)}</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>✅ Delivered Units</div>
            <div style={{fontSize:28, fontWeight:800}}>{num(data.totalDeliveredUnits)}</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>💰 Total Profit</div>
            <div style={{fontSize:28, fontWeight:800}}>{data.currency} {num(data.totalProfit)}</div>
          </div>
        </div>
      </div>

      {/* Product Cards */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📦 Your Investment Products</div>
        </div>
        {loading ? (
          <div style={{padding:20, textAlign:'center', opacity:0.7}}>Loading...</div>
        ) : data.products.length === 0 ? (
          <div style={{padding:20, textAlign:'center', opacity:0.7}}>No products assigned yet</div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:16}}>
            {data.products.map((p, idx) => (
              <div key={idx} className="card" style={{border:'1px solid var(--border)', padding:0, overflow:'hidden'}}>
                {/* Product Image */}
                {p.product?.image && (
                  <div style={{width:'100%', height:200, overflow:'hidden', background:'var(--panel)'}}>
                    <img 
                      src={`${API_BASE}${p.product.image}`} 
                      alt={p.product.name}
                      style={{width:'100%', height:'100%', objectFit:'cover'}}
                      onError={(e)=> e.target.style.display='none'}
                    />
                  </div>
                )}
                
                {/* Product Info */}
                <div style={{padding:16}}>
                  <div style={{fontSize:18, fontWeight:700, marginBottom:8, color:'#8b5cf6'}}>{p.product?.name || 'Product'}</div>
                  {p.product?.description && (
                    <div style={{fontSize:13, opacity:0.7, marginBottom:12, lineHeight:1.5}}>{p.product.description}</div>
                  )}
                  
                  {/* Stats Grid */}
                  <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10, marginBottom:12}}>
                    <div style={{background:'var(--panel)', padding:10, borderRadius:6}}>
                      <div className="helper" style={{fontSize:11}}>Country</div>
                      <div style={{fontWeight:700, color:'#3b82f6'}}>{p.country}</div>
                    </div>
                    <div style={{background:'var(--panel)', padding:10, borderRadius:6}}>
                      <div className="helper" style={{fontSize:11}}>Stock</div>
                      <div style={{fontWeight:700, color:'#f59e0b'}}>{num(p.stock)}</div>
                    </div>
                    <div style={{background:'var(--panel)', padding:10, borderRadius:6}}>
                      <div className="helper" style={{fontSize:11}}>Price</div>
                      <div style={{fontWeight:700, color:'#10b981'}}>{data.currency} {num(p.product?.price || 0)}</div>
                    </div>
                    <div style={{background:'var(--panel)', padding:10, borderRadius:6}}>
                      <div className="helper" style={{fontSize:11}}>Profit/Unit</div>
                      <div style={{fontWeight:700, color:'#10b981'}}>{data.currency} {num(p.profitPerUnit)}</div>
                    </div>
                  </div>

                  {/* Performance */}
                  <div style={{padding:12, background:'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)', borderRadius:8, marginBottom:10}}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                      <span style={{fontSize:12, opacity:0.8}}>Total Units</span>
                      <strong style={{color:'#8b5cf6'}}>{num(p.totalUnits)}</strong>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                      <span style={{fontSize:12, opacity:0.8}}>Delivered</span>
                      <strong style={{color:'#3b82f6'}}>{num(p.deliveredUnits)}</strong>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', paddingTop:8, borderTop:'1px solid var(--border)'}}>
                      <span style={{fontSize:12, opacity:0.8}}>Your Profit</span>
                      <strong style={{color:'#10b981', fontSize:16}}>{data.currency} {num(p.totalProfit)}</strong>
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
