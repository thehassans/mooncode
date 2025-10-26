import React, { useEffect, useState } from 'react'
import { Outlet, useLocation, NavLink, useNavigate } from 'react-router-dom'
import { API_BASE, apiGet } from '../api.js'
import Sidebar from '../components/Sidebar.jsx'

export default function ManagerLayout(){
  const [closed, setClosed] = useState(()=> (typeof window!=='undefined' ? window.innerWidth <= 768 : false))
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(()=> (typeof window!=='undefined' ? window.innerWidth <= 768 : false))
  const [theme, setTheme] = useState(()=>{
    try{ return localStorage.getItem('theme') || 'dark' }catch{ return 'dark' }
  })
  useEffect(()=>{
    try{ localStorage.setItem('theme', theme) }catch{}
    const root = document.documentElement
    if (theme === 'light') root.setAttribute('data-theme','light')
    else root.removeAttribute('data-theme')
  },[theme])
  useEffect(()=>{
    function onResize(){ setIsMobile(window.innerWidth <= 768) }
    window.addEventListener('resize', onResize)
    return ()=> window.removeEventListener('resize', onResize)
  },[])

  const [me, setMe] = useState(() => {
    try{ return JSON.parse(localStorage.getItem('me') || '{}') }catch{ return {} }
  })
  useEffect(()=>{ (async()=>{ try{ const { user } = await apiGet('/api/users/me'); setMe(user||{}) }catch{} })() },[])

  // Desktop sidebar links (full access; manager panel)
  const links = [
    { to: '/manager', label: 'Dashboard' },
    { to: '/manager/agents', label: 'Agents' },
    { to: '/manager/orders', label: 'Orders' },
    { to: '/manager/drivers/create', label: 'Create Driver' },
    { to: '/manager/transactions/drivers', label: 'Driver Finances' },
    { to: '/manager/warehouses', label: 'Warehouses' },
    { to: '/manager/inhouse-products', label: 'Products' },
    { to: '/manager/expenses', label: 'Expenses' },
  ]
  // Mobile tabs - ALL desktop sidebar links
  const mobileTabs = [
    { to: '/manager', label: 'Dashboard', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { to: '/manager/agents', label: 'Agents', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { to: '/manager/orders', label: 'Orders', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
    { to: '/manager/drivers/create', label: 'Create Driver', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
    { to: '/manager/transactions/drivers', label: 'Driver Fin.', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
    { to: '/manager/warehouses', label: 'Warehouse', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-5 9 5v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg> },
    { to: '/manager/inhouse-products', label: 'Products', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
    { to: '/manager/expenses', label: 'Expenses', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> },
  ]

  const tabsVisible = isMobile
  const hideSidebar = isMobile

  function doLogout(){
    try{
      localStorage.removeItem('token')
      localStorage.removeItem('me')
      localStorage.removeItem('navColors')
    }catch{}
    try{ navigate('/login', { replace: true }) }catch{}
    setTimeout(()=>{ try{ window.location.assign('/login') }catch{} }, 30)
  }

  return (
    <div>
      {/* Desktop: left sidebar like user layout */}
      {!isMobile && (
        <Sidebar closed={closed} links={links} onToggle={()=> setClosed(c=>!c)} />
      )}
      <div className={`main ${!isMobile && closed ? 'full' : ''} ${tabsVisible ? 'with-mobile-tabs' : ''}`}>
        {/* Mobile Header - Simple and Clean */}
        {isMobile && (
          <div className="mobile-header" style={{
            position:'sticky', 
            top:0, 
            zIndex:100, 
            background:'var(--sidebar-bg)', 
            borderBottom:'1px solid var(--sidebar-border)',
            padding:'12px 16px',
            display:'flex',
            alignItems:'center',
            justifyContent:'space-between'
          }}>
            <div style={{display:'flex', alignItems:'center', gap:12}}>
              {(()=>{
                const fallback = `${import.meta.env.BASE_URL}BuySial2.png`
                const src = me.headerLogo ? `${API_BASE}${me.headerLogo}` : fallback
                return <img src={src} alt="BuySial" style={{height:32, width:'auto', objectFit:'contain'}} />
              })()}
              <div style={{display:'flex', alignItems:'center', gap:6}}>
                <span style={{fontSize:20}}>🧑‍💼</span>
                <span style={{fontWeight:700, fontSize:14}}>Manager</span>
              </div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <button 
                className="btn secondary" 
                onClick={()=> setTheme(t=> t==='light' ? 'dark' : 'light')} 
                title="Toggle theme"
                style={{padding:'6px 10px', fontSize:12}}
              >
                {theme==='light' ? '🌙' : '🌞'}
              </button>
              <button 
                type="button" 
                className="btn danger" 
                onClick={doLogout}
                style={{padding:'6px 12px', fontSize:12, fontWeight:600}}
              >
                Logout
              </button>
            </div>
          </div>
        )}
        
        {/* Desktop Topbar */}
        {!isMobile && (
          <div className="topbar" style={{background:'var(--sidebar-bg)', borderBottom:'1px solid var(--sidebar-border)'}}>
            <div style={{display:'flex', alignItems:'center', gap:12, minHeight:48}}>
              <button
                className="btn secondary"
                onClick={()=> setClosed(c=>!c)}
                title={closed ? 'Open menu' : 'Close menu'}
                aria-label={closed ? 'Open menu' : 'Close menu'}
                style={{ width:36, height:36, padding:0, display:'grid', placeItems:'center' }}
              >
                ☰
              </button>
              {(()=>{
                const fallback = `${import.meta.env.BASE_URL}BuySial2.png`
                const src = me.headerLogo ? `${API_BASE}${me.headerLogo}` : fallback
                return <img src={src} alt="BuySial" style={{height:28, width:'auto', objectFit:'contain'}} />
              })()}
              <div
                style={{
                  display:'inline-flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:999,
                  background:'var(--panel)', border:'1px solid var(--border)', boxShadow:'0 1px 0 rgba(0,0,0,0.15) inset',
                }}
              >
                <span aria-hidden style={{display:'inline-flex', alignItems:'center', color:'var(--muted)'}}>🧑‍💼</span>
                <span style={{fontWeight:800, letterSpacing:0.3}}>
                  {`Manager ${me.firstName||''} ${me.lastName||''}`.trim()}
                </span>
              </div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <button className="btn secondary" onClick={()=> setTheme(t=> t==='light' ? 'dark' : 'light')} title="Toggle theme">
                {theme==='light' ? '🌙 Dark' : '🌞 Light'}
              </button>
              <button type="button" className="btn danger" onClick={doLogout}>Logout</button>
            </div>
          </div>
        )}
        <div className={`container ${isMobile ? '' : ''}`} style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: isMobile ? '90px' : '0', minHeight: isMobile ? 'calc(100vh - 146px)' : 'auto' }}>
          <Outlet />
        </div>
        {/* Mobile Bottom Navigation - Horizontally Scrollable */}
        {tabsVisible && (
          <nav 
            className="mobile-tabs" 
            role="navigation" 
            aria-label="Primary"
            style={{
              position:'fixed',
              bottom:0,
              left:0,
              right:0,
              background:'var(--sidebar-bg)',
              borderTop:'1px solid var(--sidebar-border)',
              display:'flex',
              overflowX:'auto',
              overflowY:'hidden',
              WebkitOverflowScrolling:'touch',
              scrollbarWidth:'none',
              msOverflowStyle:'none',
              zIndex:9999,
              boxShadow:'0 -2px 10px rgba(0,0,0,0.1)',
              pointerEvents:'auto',
              visibility:'visible',
              opacity:1
            }}
          >
            <style>{`
              .mobile-tabs {
                position: fixed !important;
                bottom: 0 !important;
                left: 0 !important;
                right: 0 !important;
                z-index: 9999 !important;
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
              }
              .mobile-tabs::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            {mobileTabs.map(tab => (
              <NavLink 
                key={tab.to} 
                to={tab.to} 
                end={tab.to === '/manager'} 
                className={({isActive})=>`tab ${isActive?'active':''}`}
                style={{
                  display:'flex',
                  flexDirection:'column',
                  alignItems:'center',
                  justifyContent:'center',
                  padding:'10px 12px',
                  gap:4,
                  textDecoration:'none',
                  transition:'all 0.2s ease',
                  minWidth:'80px',
                  flex:'0 0 auto',
                  whiteSpace:'nowrap'
                }}
              >
                <span className="icon" style={{display:'flex', alignItems:'center', justifyContent:'center'}}>{tab.icon}</span>
                <span style={{fontSize:10, fontWeight:600, textAlign:'center', lineHeight:1.2}}>{tab.label}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
