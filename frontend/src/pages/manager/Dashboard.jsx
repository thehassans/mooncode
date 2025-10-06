import React, { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { apiGet } from '../../api'

export default function ManagerDashboard(){
  const [isMobile, setIsMobile] = useState(()=> (typeof window!=='undefined' ? window.innerWidth <= 768 : false))
  const [me, setMe] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem('me')||'null') }catch{ return null }
  })
  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState([])
  const [summary, setSummary] = useState({}) // { KSA:{orders,delivered,cancelled}, ... }

  useEffect(()=>{
    function onResize(){ setIsMobile(window.innerWidth <= 768) }
    window.addEventListener('resize', onResize)
    return ()=> window.removeEventListener('resize', onResize)
  },[])

  useEffect(()=>{
    let alive = true
    ;(async ()=>{ 
      try{ 
        const { user } = await apiGet('/api/users/me'); 
        if (!alive) return
        setMe(user||null)
        try{ localStorage.setItem('me', JSON.stringify(user||{})) }catch{}
      }catch{ 
        // keep local me fallback
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return ()=>{ alive = false }
  },[])

  const canCreateAgents = !!(me && me.managerPermissions && me.managerPermissions.canCreateAgents)
  const canManageProducts = !!(me && me.managerPermissions && me.managerPermissions.canManageProducts)
  const canCreateOrders = !!(me && me.managerPermissions && me.managerPermissions.canCreateOrders)
  const canCreateDrivers = !!(me && me.managerPermissions && me.managerPermissions.canCreateDrivers)

  const assignedList = useMemo(()=>{
    const arr = Array.isArray(me?.assignedCountries) && me.assignedCountries.length ? me.assignedCountries : (me?.assignedCountry ? [me.assignedCountry] : [])
    // Default to all if none assigned
    return arr.length ? arr : ['KSA','UAE','Oman','Bahrain','India','Kuwait','Qatar']
  }, [me])

  // Load drivers finance summary and compute amounts per country
  const moneyByCountry = useMemo(()=>{
    const map = {}
    for (const d of (Array.isArray(drivers)? drivers: [])){
      const c = String(d?.country||'')
      if (!c) continue
      if (!map[c]) map[c] = { collected:0, deliveredToCompany:0, pendingToCompany:0 }
      map[c].collected += Number(d?.collected||0)
      map[c].deliveredToCompany += Number(d?.deliveredToCompany||0)
      map[c].pendingToCompany += Number(d?.pendingToCompany||0)
    }
    return map
  }, [drivers])

  useEffect(()=>{
    // Load drivers summary once (manager-scoped backend)
    (async()=>{
      try{ const ds = await apiGet('/api/finance/drivers/summary?page=1&limit=200'); setDrivers(Array.isArray(ds?.drivers)? ds.drivers: []) }catch{ setDrivers([]) }
    })()
  },[])

  useEffect(()=>{
    // Compute per-country counts via lightweight total queries
    (async()=>{
      try{
        const rows = {}
        await Promise.all(assignedList.map(async (ctry)=>{
          const qs = encodeURIComponent(ctry)
          const all = await apiGet(`/api/orders?country=${qs}&limit=1`)
          const del = await apiGet(`/api/orders?country=${qs}&ship=delivered&limit=1`)
          const can = await apiGet(`/api/orders?country=${qs}&ship=cancelled&limit=1`)
          rows[ctry] = {
            orders: Number(all?.total||0),
            delivered: Number(del?.total||0),
            cancelled: Number(can?.total||0),
          }
        }))
        setSummary(rows)
      }catch{ setSummary({}) }
    })()
  }, [assignedList.join('|')])

  return (
    <div className="section">
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Manager</div>
          <div className="page-subtitle">Quick actions and shortcuts based on your permissions</div>
        </div>

      {/* Quick Links by Country (assigned only) */}
      <div className="card" style={{marginTop:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#16a34a,#065f46)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🔗</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Quick Links by Country</div>
            <div className="helper">Actions limited to countries you can access</div>
          </div>
        </div>
        <div className="section" style={{overflowX:'auto'}}>
          <div style={{display:'flex', gap:12, minWidth:700}}>
            {assignedList.map(ctry => {
              const label = ctry==='KSA' ? 'Saudi Arabia' : ctry
              const qs = encodeURIComponent(ctry)
              return (
                <div key={ctry} className="mini-card" style={{border:'1px solid var(--border)', borderRadius:12, padding:'10px 12px', background:'var(--panel)', minWidth:280}}>
                  <div style={{fontWeight:800, marginBottom:6}}>{label}</div>
                  <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                    <a className="chip" href={`/manager/orders?country=${qs}`}>Orders</a>
                    <a className="chip" href={`/manager/orders?country=${qs}&onlyUnassigned=true`}>Unassigned</a>
                    <a className="chip" href={`/manager/finances`}>Finances</a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Quick actions (mobile only, bottom) */}
      {isMobile && (
        <div className="card" style={{display:'grid', gap:12, marginTop:12}}>
          {(loading && !canCreateAgents && !canManageProducts && !canCreateOrders && !canCreateDrivers) ? (
            <div className="empty-state" style={{padding:'16px 12px'}}>Loading permissions…</div>
          ) : (!canCreateAgents && !canManageProducts && !canCreateOrders && !canCreateDrivers) ? (
            <div className="empty-state" style={{padding:'16px 12px'}}>No features enabled for your role. Contact your administrator.</div>
          ) : (
            <div style={{display:'grid', gridTemplateColumns: '1fr', gap:12}}>
              {canCreateAgents && (
                <NavLink to="/manager/agents" className="btn" style={{display:'grid', placeItems:'center', padding:'16px 12px'}}>
                  <div style={{fontSize:28}}>👥</div>
                  <div style={{fontWeight:800}}>Agents</div>
                  <div className="helper">Create and manage agents</div>
                </NavLink>
              )}
              {canManageProducts && (
                <NavLink to="/manager/inhouse-products" className="btn" style={{display:'grid', placeItems:'center', padding:'16px 12px'}}>
                  <div style={{fontSize:28}}>🏷️</div>
                  <div style={{fontWeight:800}}>Inhouse Products</div>
                  <div className="helper">Create or edit products</div>
                </NavLink>
              )}
              {canCreateOrders && (
                <NavLink to="/manager/orders" className="btn" style={{display:'grid', placeItems:'center', padding:'16px 12px'}}>
                  <div style={{fontSize:28}}>🧾</div>
                  <div style={{fontWeight:800}}>Orders</div>
                  <div className="helper">Create orders</div>
                </NavLink>
              )}
              {canCreateDrivers && (
                <NavLink to="/manager/drivers/create" className="btn" style={{display:'grid', placeItems:'center', padding:'16px 12px'}}>
                  <div style={{fontSize:28}}>🚚</div>
                  <div style={{fontWeight:800}}>Create Driver</div>
                  <div className="helper">Add drivers to your workspace</div>
                </NavLink>
              )}
              <NavLink to="/manager/finances" className="btn secondary" style={{display:'grid', placeItems:'center', padding:'16px 12px'}}>
                <div style={{fontSize:28}}>💳</div>
                <div style={{fontWeight:800}}>Finances</div>
                <div className="helper">Payout proofs and history</div>
              </NavLink>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Quick actions moved to bottom on mobile */}

      {/* Country Summary (assigned only) */}
      <div className="card" style={{marginTop:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#0ea5e9,#0369a1)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🌍</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Country Summary</div>
            <div className="helper">Orders, Delivered, Cancelled, and Collections for your assigned countries</div>
          </div>
        </div>
        <div className="section" style={{overflowX:'auto'}}>
          <div style={{display:'flex', gap:12, minWidth:700}}>
            {assignedList.map(ctry=>{
              const label = ctry==='KSA' ? 'Saudi Arabia' : ctry
              const qs = encodeURIComponent(ctry)
              const sums = summary?.[ctry] || { orders:0, delivered:0, cancelled:0 }
              const m = moneyByCountry[ctry] || { collected:0, deliveredToCompany:0, pendingToCompany:0 }
              const currency = ctry==='KSA' ? 'SAR' : ctry==='UAE' ? 'AED' : ctry==='Oman' ? 'OMR' : ctry==='Bahrain' ? 'BHD' : ctry==='India' ? 'INR' : ctry==='Kuwait' ? 'KWD' : 'QAR'
              return (
                <div key={ctry} className="mini-card" style={{border:'1px solid var(--border)', borderRadius:12, padding:'10px 12px', background:'var(--panel)', minWidth:280}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
                    <div style={{fontWeight:800}}>{label}</div>
                    <a className="chip" style={{background:'transparent'}} href={`/manager/orders?country=${qs}`}>View</a>
                  </div>
                  <div style={{display:'grid', gap:6}}>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Orders</div>
                      <a className="link" href={`/manager/orders?country=${qs}`}>{sums.orders.toLocaleString()}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Delivered</div>
                      <a className="link" href={`/manager/orders?country=${qs}&ship=delivered`}>{sums.delivered.toLocaleString()}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Cancelled</div>
                      <a className="link" href={`/manager/orders?country=${qs}&ship=cancelled`}>{sums.cancelled.toLocaleString()}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Collected</div>
                      <a className="link" href={`/manager/orders?country=${qs}&ship=delivered&collected=true`}>{currency} {Math.round(m.collected||0).toLocaleString()}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Delivered to Company</div>
                      <a className="link" href={`/manager/finances`}>{currency} {Math.round(m.deliveredToCompany||0).toLocaleString()}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Pending to Company</div>
                      <a className="link" href={`/manager/finances`}>{currency} {Math.round(m.pendingToCompany||0).toLocaleString()}</a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
