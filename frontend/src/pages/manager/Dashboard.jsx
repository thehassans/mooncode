import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { apiGet } from '../../api'

export default function ManagerDashboard(){
  const [isMobile, setIsMobile] = useState(()=> (typeof window!=='undefined' ? window.innerWidth <= 768 : false))
  const [me, setMe] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem('me')||'null') }catch{ return null }
  })
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="section">
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Manager</div>
          <div className="page-subtitle">Quick actions and shortcuts based on your permissions</div>
        </div>
      </div>

      <div className="card" style={{display:'grid', gap:12}}>
        {(loading && !canCreateAgents && !canManageProducts && !canCreateOrders && !canCreateDrivers) ? (
          <div className="empty-state" style={{padding:'16px 12px'}}>Loading permissions…</div>
        ) : (!canCreateAgents && !canManageProducts && !canCreateOrders && !canCreateDrivers) ? (
          <div className="empty-state" style={{padding:'16px 12px'}}>No features enabled for your role. Contact your administrator.</div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap:12}}>
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
            {/* Always-visible Finances quick tile for convenience */}
            <NavLink to="/manager/finances" className="btn secondary" style={{display:'grid', placeItems:'center', padding:'16px 12px'}}>
              <div style={{fontSize:28}}>💳</div>
              <div style={{fontWeight:800}}>Finances</div>
              <div className="helper">Payout proofs and history</div>
            </NavLink>
          </div>
        )}
      </div>
    </div>
  )
}
