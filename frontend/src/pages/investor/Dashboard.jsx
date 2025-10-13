import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet } from '../../api'
import { io } from 'socket.io-client'

export default function InvestorDashboard(){
  const [isMobile, setIsMobile] = useState(()=> (typeof window!=='undefined' ? window.innerWidth <= 768 : false))
  const [me, setMe] = useState(null)
  const [metrics, setMetrics] = useState({ currency:'SAR', investmentAmount:0, unitsSold:0, totalProfit:0, totalSaleValue:0, breakdown:[] })
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    function onResize(){ setIsMobile(window.innerWidth <= 768) }
    window.addEventListener('resize', onResize)
    return ()=> window.removeEventListener('resize', onResize)
  },[])

  useEffect(()=>{
    async function load(){
      try{ const { user } = await apiGet('/api/users/me'); setMe(user||null) }catch{ setMe(null) }
      try{
        setLoading(true)
        const m = await apiGet('/api/users/investors/me/metrics')
        setMetrics({
          currency: m.currency || 'SAR',
          investmentAmount: Number(m.investmentAmount||0),
          unitsSold: Number(m.unitsSold||0),
          totalProfit: Number(m.totalProfit||0),
          totalSaleValue: Number(m.totalSaleValue||0),
          breakdown: Array.isArray(m.breakdown) ? m.breakdown : []
        })
      }catch{ setMetrics({ currency:'SAR', investmentAmount:0, unitsSold:0, totalProfit:0, totalSaleValue:0, breakdown:[] }) }
      finally{ setLoading(false) }
    }
    load()
    // Socket live updates
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path: '/socket.io', transports: ['polling'], upgrade:false, auth: { token }, withCredentials: true })
      const refresh = ()=>{ load() }
      // Orders in the workspace changed (ship/deliver/return/settle/created)
      socket.on('orders.changed', refresh)
      // Direct investor updates (profile/assignment changed)
      socket.on('investor.updated', refresh)
    }catch{}
    return ()=>{
      try{ socket && socket.off('orders.changed') }catch{}
      try{ socket && socket.off('investor.updated') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  }, [])

  // Formatting helpers
  function fmtNum(n){ try{ return Number(n||0).toLocaleString() }catch{ return String(n||0) } }
  function fmtAmt(n){ try{ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }catch{ return String(n||0) } }
  const currencyLabel = useMemo(()=> String(metrics?.currency||'SAR'), [metrics?.currency])

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      {/* KPI Tiles */}
      {(function(){
        const items = [
          { title: 'Total Investment', color: '#0ea5e9', value: `${currencyLabel} ${fmtAmt(metrics.investmentAmount)}` },
          { title: 'Units Sold', color: '#10b981', value: fmtNum(metrics.unitsSold) },
          { title: 'Total Sale Value', color: '#0ea5e9', value: `${currencyLabel} ${fmtAmt(metrics.totalSaleValue)}` },
          { title: 'Total Profit', color: '#f59e0b', value: `${currencyLabel} ${fmtAmt(metrics.totalProfit)}` },
        ]
        const Tile = ({ title, value, color }) => (
          <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:12, padding:'12px', background:'var(--panel)'}}>
            <div className="helper">{title}</div>
            <div style={{fontSize:24, fontWeight:900, color:color||'inherit'}}>{value}</div>
          </div>
        )
        return (
          <div className="card">
            <div className="section" style={{display:'grid', gap:12}}>
              <div>
                <div style={{fontWeight:800, fontSize:16}}>Overview</div>
                <div className="helper">Live metrics for your assigned products</div>
              </div>
              <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12}}>
                {items.map((it, i)=> (<Tile key={i} title={it.title} value={it.value} color={it.color} />))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Breakdown */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Per-Product Breakdown</div>
          <div className="helper">Only shipped or delivered orders are counted</div>
        </div>
        <div style={{overflow:'auto'}}>
          <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
            <thead>
              <tr>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Product</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Units Sold</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Sale Value</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{padding:'10px 12px', opacity:0.7}}>Loading…</td></tr>
              ) : metrics.breakdown.length === 0 ? (
                <tr><td colSpan={4} style={{padding:'10px 12px', opacity:0.7}}>No data</td></tr>
              ) : metrics.breakdown.map((row, idx) => (
                <tr key={idx} style={{borderTop:'1px solid var(--border)'}}>
                  <td style={{padding:'10px 12px'}}>{row.productName || '-'}</td>
                  <td style={{padding:'10px 12px'}}>{fmtNum(row.unitsSold || 0)}</td>
                  <td style={{padding:'10px 12px'}}>{currencyLabel} {fmtAmt(row.saleValue||0)}</td>
                  <td style={{padding:'10px 12px'}}>{currencyLabel} {fmtAmt(row.profit||0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
