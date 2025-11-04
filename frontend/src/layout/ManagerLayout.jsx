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
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false)
  
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
  
  // Close dropdown when clicking outside
  useEffect(()=>{
    function handleClickOutside(e){
      if (showSettingsDropdown){
        const dropdown = document.getElementById('settings-dropdown')
        const button = document.getElementById('settings-button')
        if (dropdown && !dropdown.contains(e.target) && button && !button.contains(e.target)){
          setShowSettingsDropdown(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return ()=> document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettingsDropdown])

  // Desktop sidebar links (full access; manager panel)
  const links = [
    { to: '/manager', label: 'Dashboard' },
    { to: '/manager/agents', label: 'Agents' },
    { to: '/manager/orders', label: 'Orders' },
    { to: '/manager/drivers/create', label: 'Create Driver' },
    { to: '/manager/transactions/drivers', label: 'Driver Finances' },
    { to: '/manager/driver-amounts', label: 'Driver Commission' },
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
    { to: '/manager/driver-amounts', label: 'Commission', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="12" y1="2" x2="12" y2="6"/></svg> },
    { to: '/manager/warehouses', label: 'Warehouse', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-5 9 5v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg> },
    { to: '/manager/inhouse-products', label: 'Products', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
    { to: '/manager/expenses', label: 'Expenses', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> },
  ]

  const tabsVisible = isMobile
  const hideSidebar = isMobile

  function toggleTheme(){
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next === 'light' ? 'light' : 'dark')
  }
  
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
          <div className="topbar" style={{background:'var(--sidebar-bg)', borderBottom:'1px solid var(--sidebar-border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'nowrap', minHeight:'60px', padding:'0 1rem'}}>
            <div className="flex items-center gap-3" style={{flexShrink:0}}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                <span aria-hidden style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                  flexShrink: 0,
                  fontSize: '18px'
                }}>🧑‍💼</span>
                <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>Manager</span>
                  <span style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>{`${me.firstName||''} ${me.lastName||''}`.trim() || 'Manager'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2" style={{flexShrink:0}}>
              {/* Premium Theme Toggle Switch */}
              <button
                onClick={toggleTheme}
                title={theme==='light' ? 'Switch to dark mode' : 'Switch to light mode'}
                aria-label={theme==='light' ? 'Dark mode' : 'Light mode'}
                style={{
                  position: 'relative',
                  width: '70px',
                  height: '34px',
                  background: theme === 'dark' ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                  borderRadius: '17px',
                  border: theme === 'dark' ? '2px solid #334155' : '2px solid #cbd5e1',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: theme === 'dark' 
                    ? 'inset 0 2px 4px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)' 
                    : 'inset 0 2px 4px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.1)',
                  padding: 0,
                  overflow: 'hidden',
                  flexShrink: 0
                }}
              >
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 8px'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme === 'light' ? '#0f172a' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{transition: 'all 0.3s ease', opacity: theme === 'light' ? 0.3 : 0.5}}>
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme === 'dark' ? '#f1f5f9' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{transition: 'all 0.3s ease', opacity: theme === 'dark' ? 0.3 : 0.5}}>
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                </div>
                <div style={{
                  position: 'absolute',
                  top: '3px',
                  left: theme === 'dark' ? '37px' : '3px',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: theme === 'dark' ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  boxShadow: theme === 'dark' ? '0 2px 8px rgba(99, 102, 241, 0.4)' : '0 2px 8px rgba(251, 191, 36, 0.4)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {theme === 'dark' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5"/>
                      <line x1="12" y1="1" x2="12" y2="3"/>
                      <line x1="12" y1="21" x2="12" y2="23"/>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                      <line x1="1" y1="12" x2="3" y2="12"/>
                      <line x1="21" y1="12" x2="23" y2="12"/>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                  )}
                </div>
              </button>
              {/* Settings dropdown */}
              <div style={{ position: 'relative' }}>
                <button 
                  id="settings-button"
                  className="btn w-9 h-9 p-0 grid place-items-center" 
                  title="Settings" 
                  aria-label="Settings" 
                  onClick={()=> setShowSettingsDropdown(prev => !prev)}
                  style={{width:'36px', height:'36px', padding:0, display:'grid', placeItems:'center'}}
                >
                  ⚙️
                </button>
                {showSettingsDropdown && (
                  <div 
                    id="settings-dropdown"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: '280px',
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                      borderRadius: '16px',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
                      zIndex: 1000,
                      overflow: 'hidden',
                      backdropFilter: 'blur(20px)'
                    }}
                  >
                    {/* User info header */}
                    <div style={{
                      padding: '20px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))'
                    }}>
                      <div style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        fontWeight: 600,
                        color: '#fff',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                      }}>
                        {((me.firstName||'')[0]||(me.lastName||'')[0]||'M').toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '2px' }}>
                          {`${me.firstName||''} ${me.lastName||''}`.trim() || 'Manager'}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                          {me.email || ''}
                        </div>
                      </div>
                    </div>
                    
                    {/* Menu items */}
                    <div style={{ padding: '8px' }}>
                      <button
                        onClick={()=> {
                          setShowSettingsDropdown(false)
                          doLogout()
                        }}
                        style={{
                          width: '100%',
                          padding: '14px 16px',
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          fontSize: '14px',
                          fontWeight: 500,
                          borderRadius: '10px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e)=> {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                          e.currentTarget.style.transform = 'translateX(4px)'
                        }}
                        onMouseLeave={(e)=> {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.transform = 'translateX(0)'
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                          <polyline points="16 17 21 12 16 7"/>
                          <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
