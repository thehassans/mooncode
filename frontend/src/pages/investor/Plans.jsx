import React, { useEffect, useState } from 'react'
import { apiGet } from '../../api'
import { io } from 'socket.io-client'

export default function InvestorPlans(){
  const [loading, setLoading] = useState(true)
  const [packages_, setPackages] = useState([
    { index: 1, name: 'Products Package 1', price: 0, profitPercentage: 0 },
    { index: 2, name: 'Products Package 2', price: 0, profitPercentage: 0 },
    { index: 3, name: 'Products Package 3', price: 0, profitPercentage: 0 },
  ])

  async function load(){
    try{
      setLoading(true)
      const { packages } = await apiGet('/api/investors/plans')
      setPackages(packages || [])
    }catch(err){
      console.error('Failed to load plans', err)
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{
    load()
    const token = localStorage.getItem('token') || ''
    const socket = io(undefined, { path: '/socket.io', transports: ['polling'], upgrade: false, auth: { token }, withCredentials: true })
    socket.on('investor-plans.updated', load)
    return ()=>{ try{ socket.off('investor-plans.updated', load); socket.disconnect() }catch{} }
  },[])

  const fmt = (n)=> Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 })

  return (
    <div className="section" style={{ display: 'grid', gap: 24 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Investment Plans</div>
          <div className="page-subtitle">Choose a products package set by the workspace owner</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div className="spinner" />
          <div style={{ marginTop: 10, opacity: 0.7 }}>Loading plans…</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {packages_.map((p) => (
            <div key={p.index} style={{
              borderRadius: 16,
              padding: 24,
              color: '#fff',
              boxShadow: '0 10px 34px rgba(0,0,0,0.1)',
              background: p.index===1 ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : p.index===2 ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
            }}>
              <div style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.9, marginBottom: 8 }}>Products Package {p.index}</div>
              <div style={{ fontWeight: 900, fontSize: 24, marginBottom: 6 }}>{p.name || `Products Package ${p.index}`}</div>
              <div style={{ display: 'grid', gap: 8, fontWeight: 600 }}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span>Price</span>
                  <span>SAR {fmt(p.price)}</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span>Profit %</span>
                  <span>{fmt(p.profitPercentage)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: 12, background: 'var(--panel)', borderRadius: 8, fontSize: 13 }}>
        Plans are configured by the store owner in the User panel under "Investor Products". Updates appear here automatically.
      </div>
    </div>
  )
}
