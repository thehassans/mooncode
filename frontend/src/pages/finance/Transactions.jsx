import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPost, apiUpload } from '../../api'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/Modal.jsx'
import { useToast } from '../../ui/Toast.jsx'

export default function Transactions(){
  const navigate = useNavigate()
  const toast = useToast()
  const [me, setMe] = useState(()=>{ try{ return JSON.parse(localStorage.getItem('me')||'{}') }catch{ return {} } })
  const role = String(me?.role||'')
  const [driverRemits, setDriverRemits] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [country, setCountry] = useState('')
  const [countryOptions, setCountryOptions] = useState([])
  const [drivers, setDrivers] = useState([])
  const [deliveredOrders, setDeliveredOrders] = useState([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sortBy, setSortBy] = useState('variance')
  const [sortDir, setSortDir] = useState('desc')
  const [remitModalFor, setRemitModalFor] = useState('')
  const [countryOrders, setCountryOrders] = useState([])
  const [detailModalFor, setDetailModalFor] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [acceptModal, setAcceptModal] = useState(null)
  const [managerSummary, setManagerSummary] = useState({ totalSent:0, totalAccepted:0, totalPending:0, currency:'' })
  const [payModal, setPayModal] = useState(false)
  const [payForm, setPayForm] = useState({ amount:'', method:'hand', note:'', file:null })
  const [submitting, setSubmitting] = useState(false)
  const [remitPage, setRemitPage] = useState(1)
  const remitPerPage = 10

  // Reset remit page when modal opens
  useEffect(()=>{ if(remitModalFor) setRemitPage(1) },[remitModalFor])

  useEffect(()=>{ /* initial no-op */ },[])
  
  // Load manager remittance summary if manager
  useEffect(()=>{
    if (role !== 'manager') return
    let alive = true
    ;(async()=>{
      try{ 
        const url = country ? `/api/finance/manager-remittances/summary?country=${encodeURIComponent(country)}` : '/api/finance/manager-remittances/summary'
        const r = await apiGet(url)
        if (alive) setManagerSummary({ totalSent: Number(r?.totalSent||0), totalAccepted: Number(r?.totalAccepted||0), totalPending: Number(r?.totalPending||0), currency: r?.currency||'' }) 
      }catch(err){ console.error('Failed to load manager summary:', err) }
    })()
    return ()=>{ alive=false }
  },[role, country])
  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{ const r = await apiGet('/api/users/me'); if (alive){ setMe(r?.user||{}) } }
      catch{}
    })()
    return ()=>{ alive=false }
  },[])
  useEffect(()=>{
    try{
      const onResize = ()=> setIsMobile(typeof window !== 'undefined' && window.innerWidth < 720)
      onResize()
      window.addEventListener('resize', onResize)
      return ()=> window.removeEventListener('resize', onResize)
    }catch{}
  },[])

  // Load country options for filter (top selector)
  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet('/api/orders/options')
        const arr = Array.isArray(r?.countries) ? r.countries : []
        // Normalize and dedupe (avoid both 'UAE' and 'Uae')
        const map = new Map()
        for (const c of arr){
          const raw = String(c||'').trim()
          const key = raw.toLowerCase()
          if (!map.has(key)) map.set(key, raw.toUpperCase() === 'UAE' ? 'UAE' : raw)
        }
        setCountryOptions(Array.from(map.values()))
      } catch {
        setCountryOptions([])
      }
    })()
  }, [])

  // When country changes, load drivers, remittances, and orders in parallel for responsiveness
  useEffect(() => {
    if (!country) { setDrivers([]); setDeliveredOrders([]); setDriverRemits([]); setCountryOrders([]); return }
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const lim = 200

        const loadDrivers = apiGet(`/api/users/drivers?country=${encodeURIComponent(country)}`)
          .then(d => { if (alive) setDrivers(Array.isArray(d?.users) ? d.users : []) })
          .catch(()=> { if (alive) setDrivers([]) })

        const remitsUrl = (role==='manager') ? '/api/finance/remittances?workspace=1' : '/api/finance/remittances'
        const loadRemits = apiGet(remitsUrl)
          .then(remitResp => {
            const allRemits = Array.isArray(remitResp?.remittances) ? remitResp.remittances : []
            const filteredRemits = allRemits.filter(r => String(r?.country||'').trim().toLowerCase() === String(country).trim().toLowerCase())
            if (alive) setDriverRemits(filteredRemits)
          }).catch(()=> { if (alive) setDriverRemits([]) })

        const loadDelivered = (async ()=>{
          let page = 1, hasMore = true, acc = []
          while (hasMore && page <= 10) {
            const q = new URLSearchParams()
            q.set('country', country)
            q.set('ship', 'delivered')
            q.set('page', String(page))
            q.set('limit', String(lim))
            const r = await apiGet(`/api/orders?${q.toString()}`)
            const arr = Array.isArray(r?.orders) ? r.orders : []
            acc = acc.concat(arr)
            hasMore = !!r?.hasMore
            page += 1
          }
          if (alive) setDeliveredOrders(acc)
        })()

        const loadAllOrders = (async ()=>{
          let p2 = 1, more2 = true, all = []
          while (more2 && p2 <= 10){
            const q2 = new URLSearchParams()
            q2.set('country', country)
            q2.set('page', String(p2))
            q2.set('limit', String(lim))
            const r2 = await apiGet(`/api/orders?${q2.toString()}`)
            const arr2 = Array.isArray(r2?.orders) ? r2.orders : []
            all = all.concat(arr2)
            more2 = !!r2?.hasMore
            p2 += 1
          }
          if (alive) setCountryOrders(all)
        })()

        await Promise.all([loadDrivers, loadRemits, loadDelivered, loadAllOrders])
      } catch (e) {
        if (alive) setErr(e?.message || 'Failed to load driver settlement')
      } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [country, role])

  // Live updates: refresh remittances on create/accept/reject/manager_accepted
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token')||''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const onRemit = async ()=>{ try{ await refreshRemittances() }catch{} }
      socket.on('remittance.created', onRemit)
      socket.on('remittance.accepted', onRemit)
      socket.on('remittance.rejected', onRemit)
      socket.on('remittance.manager_accepted', onRemit)
    }catch{}
    return ()=>{
      try{ socket && socket.off('remittance.created') }catch{}
      try{ socket && socket.off('remittance.accepted') }catch{}
      try{ socket && socket.off('remittance.rejected') }catch{}
      try{ socket && socket.off('remittance.manager_accepted') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  }, [])
  
  // Live manager remittance updates
  useEffect(()=>{
    if (role !== 'manager') return
    let socket
    try{
      const token = localStorage.getItem('token')||''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const onMgrRemit = async ()=>{ try{ const url = country ? `/api/finance/manager-remittances/summary?country=${encodeURIComponent(country)}` : '/api/finance/manager-remittances/summary'; const r = await apiGet(url); setManagerSummary({ totalSent: Number(r?.totalSent||0), totalAccepted: Number(r?.totalAccepted||0), totalPending: Number(r?.totalPending||0), currency: r?.currency||'' }) }catch{} }
      socket.on('manager-remittance.accepted', onMgrRemit)
      socket.on('manager-remittance.rejected', onMgrRemit)
    }catch{}
    return ()=>{
      try{ socket && socket.off('manager-remittance.accepted') }catch{}
      try{ socket && socket.off('manager-remittance.rejected') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  }, [role, country])

  async function refreshRemittances(){
    try{
      const remitsUrl = (role==='manager') ? '/api/finance/remittances?workspace=1' : '/api/finance/remittances'
      const remitResp = await apiGet(remitsUrl)
      const allRemits = Array.isArray(remitResp?.remittances) ? remitResp.remittances : []
      const filteredRemits = allRemits.filter(r => String(r?.country||'').trim().toLowerCase() === String(country).trim().toLowerCase())
      setDriverRemits(filteredRemits)
    }catch{}
  }
  async function acceptRemit(id){ try{ await apiPost(`/api/finance/remittances/${id}/accept`,{}); await refreshRemittances(); toast.success('Remittance accepted') }catch(e){ toast.error(e?.message||'Failed to accept') } }
  async function rejectRemit(id){ try{ await apiPost(`/api/finance/remittances/${id}/reject`,{}); await refreshRemittances(); toast.warn('Remittance rejected') }catch(e){ toast.error(e?.message||'Failed to reject') } }
  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }
  function userName(u){ if (!u) return '-'; return `${u.firstName||''} ${u.lastName||''}`.trim() || (u.email||'-') }
  function dateInRange(d, from, to){ try{ if (!d) return false; const t = new Date(d).getTime(); if (from){ const f = new Date(from).setHours(0,0,0,0); if (t < f) return false } if (to){ const tt = new Date(to).setHours(23,59,59,999); if (t > tt) return false } return true }catch{ return true } }

  function latestPendingRemitForDriver(driverId){
    try{
      // For managers: show only 'pending' status
      // For owners: show both 'pending' and 'manager_accepted' status
      const statusFilter = role === 'manager' 
        ? (r) => String(r?.status||'').toLowerCase() === 'pending'
        : (r) => ['pending', 'manager_accepted'].includes(String(r?.status||'').toLowerCase())
      
      const list = driverRemits
        .filter(r => String(r?.driver?._id || r?.driver || '') === String(driverId))
        .filter(r => String(r?.country||'').trim().toLowerCase() === String(country||'').trim().toLowerCase())
        .filter(statusFilter)
        .filter(r => role==='manager' ? (String(r?.manager?._id || r?.manager || '') === String(me?._id||me?.id||'')) : true)
        .filter(r => (fromDate || toDate) ? dateInRange(r?.createdAt || r?.acceptedAt, fromDate, toDate) : true)
        .sort((a,b)=> new Date(b.createdAt||b.acceptedAt||0) - new Date(a.createdAt||a.acceptedAt||0))
      return list[0] || null
    }catch{ return null }
  }
  async function quickAcceptForDriver(driverId){
    const r = latestPendingRemitForDriver(driverId)
    if (!r){ alert('No pending remittance for this driver in the current filters'); return }
    const amt = `${r.currency||''} ${Number(r.amount||0).toFixed(2)}`
    const ok = window.confirm(`Accept pending remittance of ${amt}?`)
    if (!ok) return
    await acceptRemit(String(r._id||''))
  }

  // Build per-driver metrics from deliveredOrders for selected country
  function orderNumericTotal(o){
    try{
      if (o && o.total != null && !Number.isNaN(Number(o.total))) return Number(o.total)
      if (Array.isArray(o?.items) && o.items.length){
        let sum = 0; for (const it of o.items){ const price = Number(it?.productId?.price||0); const qty = Math.max(1, Number(it?.quantity||1)); sum += price * qty }
        return sum
      }
      const price = Number(o?.productId?.price||0); const qty = Math.max(1, Number(o?.quantity||1)); return price * qty
    }catch{ return 0 }
  }
  function collectedOf(o){ const c = Number(o?.collectedAmount); if (!Number.isNaN(c) && c>0) return c; const cod = Number(o?.codAmount); if (!Number.isNaN(cod) && cod>0) return cod; return orderNumericTotal(o) }
  const driverStats = useMemo(()=>{
    const map = new Map()
    for (const o of deliveredOrders){
      const dAt = o?.deliveredAt || o?.updatedAt || o?.createdAt
      if ((fromDate || toDate) && !dateInRange(dAt, fromDate, toDate)) continue
      const did = String(o?.deliveryBoy?._id || o?.deliveryBoy || '')
      if (!did) continue
      if (!map.has(did)) map.set(did, { deliveredCount:0, collectedSum:0 })
      const s = map.get(did)
      s.deliveredCount += 1
      s.collectedSum += collectedOf(o)
    }
    return map
  }, [deliveredOrders, fromDate, toDate])
  // Sum accepted/received remittances per driver (delivered to company)
  const driverAcceptedSum = useMemo(()=>{
    const by = new Map()
    for (const r of driverRemits){
      if (String(r?.country||'').trim().toLowerCase() !== String(country||'').trim().toLowerCase()) continue
      const st = String(r?.status||'')
      if (st==='accepted' || st==='received'){
        const id = String(r?.driver?._id || r?.driver || '')
        if (!id) continue
        const when = r?.acceptedAt || r?.createdAt
        if ((fromDate || toDate) && !dateInRange(when, fromDate, toDate)) continue
        if (!by.has(id)) by.set(id, 0)
        by.set(id, by.get(id) + Number(r?.amount||0))
      }
    }
    return by
  }, [driverRemits, country, fromDate, toDate])

  function normalizeShip(s){
    const n = String(s||'').toLowerCase().trim().replace(/\s+/g,'_').replace(/-/g,'_')
    if (n==='picked' || n==='pickedup' || n==='pick_up' || n==='pick-up' || n==='pickup') return 'picked_up'
    if (n==='shipped' || n==='contacted' || n==='attempted') return 'in_transit'
    if (n==='open') return 'open'
    return n
  }
  const openAssignedByDriver = useMemo(()=>{
    const map = new Map()
    for (const o of countryOrders){
      const did = String(o?.deliveryBoy?._id || o?.deliveryBoy || '')
      if (!did) continue
      const ship = normalizeShip(o?.shipmentStatus || o?.status)
      const isOpen = ['pending','assigned','picked_up','in_transit','out_for_delivery','no_response'].includes(ship)
      if (!isOpen) continue
      if ((fromDate || toDate) && !dateInRange(o?.updatedAt || o?.createdAt, fromDate, toDate)) continue
      if (!map.has(did)) map.set(did, 0)
      map.set(did, map.get(did) + 1)
    }
    return map
  }, [countryOrders, fromDate, toDate])
  const totalAssignedByDriver = useMemo(()=>{
    const map = new Map()
    for (const o of countryOrders){
      const did = String(o?.deliveryBoy?._id || o?.deliveryBoy || '')
      if (!did) continue
      if ((fromDate || toDate) && !dateInRange(o?.updatedAt || o?.createdAt, fromDate, toDate)) continue
      if (!map.has(did)) map.set(did, 0)
      map.set(did, map.get(did) + 1)
    }
    return map
  }, [countryOrders, fromDate, toDate])

  const returnedByDriver = useMemo(()=>{
    const map = new Map()
    for (const o of countryOrders){
      const did = String(o?.deliveryBoy?._id || o?.deliveryBoy || '')
      if (!did) continue
      const ship = normalizeShip(o?.shipmentStatus || o?.status)
      if (ship !== 'returned') continue
      if ((fromDate || toDate) && !dateInRange(o?.updatedAt || o?.createdAt, fromDate, toDate)) continue
      if (!map.has(did)) map.set(did, 0)
      map.set(did, map.get(did) + 1)
    }
    return map
  }, [countryOrders, fromDate, toDate])

  const cancelledByDriver = useMemo(()=>{
    const map = new Map()
    for (const o of countryOrders){
      const did = String(o?.deliveryBoy?._id || o?.deliveryBoy || '')
      if (!did) continue
      const ship = normalizeShip(o?.shipmentStatus || o?.status)
      if (ship !== 'cancelled') continue
      if ((fromDate || toDate) && !dateInRange(o?.updatedAt || o?.createdAt, fromDate, toDate)) continue
      if (!map.has(did)) map.set(did, 0)
      map.set(did, map.get(did) + 1)
    }
    return map
  }, [countryOrders, fromDate, toDate])

  function countryCurrency(c){
    const raw = String(c||'').trim().toLowerCase()
    if (!raw) return 'SAR'
    if (raw.includes('saudi') || raw==='ksa') return 'SAR'
    if (raw.includes('united arab emirates') || raw==='uae' || raw==='ae') return 'AED'
    if (raw==='oman' || raw==='om') return 'OMR'
    if (raw==='bahrain' || raw==='bh') return 'BHD'
    if (raw==='india' || raw==='in') return 'INR'
    if (raw==='kuwait' || raw==='kw' || raw==='kwt') return 'KWD'
    if (raw==='qatar' || raw==='qa') return 'QAR'
    return 'SAR'
  }
  const ccy = countryCurrency(country)
  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }
  function goAllOrders(driverId){ const p = new URLSearchParams(); if (country) p.set('country', country); p.set('driver', String(driverId)); navigate(`/user/orders?${p.toString()}`) }
  function goDelivered(driverId){ const p = new URLSearchParams(); if (country) p.set('country', country); p.set('driver', String(driverId)); p.set('ship','delivered'); navigate(`/user/orders?${p.toString()}`) }
  function goDeliveredCollected(driverId){ const p = new URLSearchParams(); if (country) p.set('country', country); p.set('driver', String(driverId)); p.set('ship','delivered'); p.set('collected','true'); navigate(`/user/orders?${p.toString()}`) }

  const rows = useMemo(()=>{
    const arr = drivers.map(d => {
      const id = String(d?._id)
      const s = driverStats.get(id) || { deliveredCount:0, collectedSum:0 }
      const rem = driverAcceptedSum.get(id) || 0
      const variance = (s.collectedSum || 0) - (rem || 0)
      const openAssigned = openAssignedByDriver.get(id) || 0
      const totalAssigned = totalAssignedByDriver.get(id) || 0
      const returned = returnedByDriver.get(id) || 0
      const cancelled = cancelledByDriver.get(id) || 0
      return { id, driver: d, openAssigned, totalAssigned, deliveredCount: s.deliveredCount||0, collectedSum: s.collectedSum||0, remittedSum: rem||0, variance, returned, cancelled }
    })
    const dir = sortDir === 'asc' ? 1 : -1
    const key = sortBy
    arr.sort((a,b)=>{
      const av = a[key] ?? 0
      const bv = b[key] ?? 0
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return arr
  }, [drivers, driverStats, driverAcceptedSum, openAssignedByDriver, totalAssignedByDriver, returnedByDriver, cancelledByDriver, sortBy, sortDir])

  const totals = useMemo(()=>{
    let delivered=0, collected=0, remitted=0, pending=0, openA=0, totalA=0
    for (const r of rows){
      delivered += Number(r.deliveredCount||0)
      collected += Number(r.collectedSum||0)
      remitted += Number(r.remittedSum||0)
      pending += Number(r.variance||0)
      openA += Number(r.openAssigned||0)
      totalA += Number(r.totalAssigned||0)
    }
    return { delivered, collected, remitted, pending, openA, totalA }
  }, [rows])

  function exportCsv(){
    try{
      const header = ['Driver','Email','OpenAssigned','TotalAssigned','Delivered','Returned','Cancelled','Collected','Remitted','Pending']
      const lines = [header.join(',')]
      for (const r of rows){
        lines.push([
          `${r.driver.firstName||''} ${r.driver.lastName||''}`.trim(),
          r.driver.email||'',
          r.openAssigned,
          r.totalAssigned,
          r.deliveredCount,
          r.returned,
          r.cancelled,
          r.collectedSum,
          r.remittedSum,
          r.variance,
        ].map(v => typeof v==='string' && v.includes(',') ? `"${v.replace(/"/g,'""')}"` : v).join(','))
      }
      const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `driver-finances-${country||'all'}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }catch{}
  }

  const filteredRemitsForDriver = useMemo(()=>{
    if (!remitModalFor) return []
    return driverRemits.filter(r => String(r?.driver?._id || r?.driver || '') === String(remitModalFor))
      .filter(r => (fromDate || toDate) ? dateInRange(r?.acceptedAt || r?.createdAt, fromDate, toDate) : true)
  }, [driverRemits, remitModalFor, fromDate, toDate])
  
  // Pay to company handler
  async function payToCompany(){
    if (!payForm.amount){ toast.error('Enter amount'); return }
    const amt = Number(payForm.amount)
    if (Number.isNaN(amt) || amt <= 0){ toast.error('Enter a valid amount'); return }
    if (payForm.method === 'transfer' && !payForm.file){ toast.error('Attach proof for transfer method'); return }
    setSubmitting(true)
    try{
      const fd = new FormData()
      fd.append('amount', String(amt))
      fd.append('method', payForm.method)
      if (country) fd.append('country', country)
      if (payForm.note) fd.append('note', payForm.note)
      if (payForm.method === 'transfer' && payForm.file) fd.append('receipt', payForm.file)
      await apiUpload('/api/finance/manager-remittances', fd)
      // Refresh summary
      try{ const url = country ? `/api/finance/manager-remittances/summary?country=${encodeURIComponent(country)}` : '/api/finance/manager-remittances/summary'; const r = await apiGet(url); setManagerSummary({ totalSent: Number(r?.totalSent||0), totalAccepted: Number(r?.totalAccepted||0), totalPending: Number(r?.totalPending||0), currency: r?.currency||'' }) }catch{}
      setPayForm({ amount:'', method:'hand', note:'', file:null })
      setPayModal(false)
      toast.success('Payment sent to company. You will be notified when approved.')
    }catch(e){ toast.error(e?.message || 'Failed to send payment') }
    finally{ setSubmitting(false) }
  }

  return (
    <div className="section" style={{ display: 'grid', gap: 12 }}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Driver Settlement</div>
          <div className="page-subtitle">Monitor drivers' delivered collections and remittances</div>
        </div>
      {acceptModal && (
        <Modal
          title="Accept Driver Remittance"
          open={!!acceptModal}
          onClose={()=> setAcceptModal(null)}
          footer={
            <>
              <button className="btn secondary" onClick={()=> setAcceptModal(null)}>Close</button>
              {role!=='driver' && (
                <>
                  <button className="btn danger" onClick={async()=>{ const id=String(acceptModal?._id||''); await rejectRemit(id); setAcceptModal(null) }}>Reject</button>
                  <button className="btn success" onClick={async()=>{ const id=String(acceptModal?._id||''); await acceptRemit(id); setAcceptModal(null) }}>Accept</button>
                </>
              )}
            </>
          }
        >
          <div style={{display:'grid', gap:8}}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:8}}>
              <Info label="Driver" value={`${acceptModal?.driver?.firstName||''} ${acceptModal?.driver?.lastName||''}`.trim() || (acceptModal?.driver?.email||'-')} />
              <Info label="Approver" value={`${acceptModal?.manager?.firstName||''} ${acceptModal?.manager?.lastName||''}`.trim() || '—'} />
              <Info label="Amount" value={`${acceptModal?.currency||''} ${Number(acceptModal?.amount||0).toFixed(2)}`} />
              <Info label="Method" value={String(acceptModal?.method||'hand').toUpperCase()} />
              {acceptModal?.paidToName ? <Info label="Paid To" value={acceptModal?.paidToName} /> : null}
              {acceptModal?.note ? <Info label="Note" value={acceptModal?.note} /> : null}
              <Info label="Created" value={acceptModal?.createdAt ? new Date(acceptModal.createdAt).toLocaleString() : '-'} />
            </div>
            {acceptModal?.receiptPath ? (
              <div>
                <div className="helper">Proof</div>
                <img src={`${API_BASE}${acceptModal.receiptPath}`} alt="Proof" style={{maxWidth:'100%', borderRadius:8, border:'1px solid var(--border)'}} />
              </div>
            ) : null}
          </div>
        </Modal>
      )}
      </div>
      {err && <div className="error">{err}</div>}
      
      {/* Manager Summary & Pay to Company */}
      {role === 'manager' && (
        <div className="card" style={{ display:'grid', gap:10 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Manager Payable to Company</div>
              <div className="card-subtitle">Total amount collected from drivers</div>
            </div>
            <button className="btn" onClick={()=>{ const toPay = Math.max(0, totals.remitted - managerSummary.totalSent); setPayForm({ amount: toPay.toFixed(2), method:'hand', note:'', file:null }); setPayModal(true) }}>Pay to Company</button>
          </div>
          <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:12}}>
            <div style={{background:'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color:'#fff', padding:'16px', borderRadius:10}}>
              <div style={{fontSize:14, opacity:0.9}}>Total Collected from Drivers</div>
              <div style={{fontSize:28, fontWeight:800}}>{managerSummary.currency} {num(totals.remitted)}</div>
            </div>
            <div style={{background:'linear-gradient(135deg, #10b981 0%, #059669 100%)', color:'#fff', padding:'16px', borderRadius:10}}>
              <div style={{fontSize:14, opacity:0.9}}>Sent to Company</div>
              <div style={{fontSize:28, fontWeight:800}}>{managerSummary.currency} {num(managerSummary.totalAccepted)}</div>
            </div>
            <div style={{background:'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color:'#fff', padding:'16px', borderRadius:10}}>
              <div style={{fontSize:14, opacity:0.9}}>Pending Approval</div>
              <div style={{fontSize:28, fontWeight:800}}>{managerSummary.currency} {num(managerSummary.totalPending)}</div>
            </div>
            <div style={{background:'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color:'#fff', padding:'16px', borderRadius:10}}>
              <div style={{fontSize:14, opacity:0.9}}>To Pay Company</div>
              <div style={{fontSize:28, fontWeight:800}}>{managerSummary.currency} {num(Math.max(0, totals.remitted - managerSummary.totalSent))}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="card-header"><div className="card-title">Filters</div></div>
        <div className="section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          <select className="input" value={country} onChange={(e)=> setCountry(e.target.value)}>
            <option value="">Select Country</option>
            {countryOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input className="input" type="date" value={fromDate} onChange={e=> setFromDate(e.target.value)} />
          <input className="input" type="date" value={toDate} onChange={e=> setToDate(e.target.value)} />
          <select className="input" value={sortBy} onChange={e=> setSortBy(e.target.value)}>
            <option value="variance">Sort by Pending</option>
            <option value="collectedSum">Sort by Collected</option>
            <option value="remittedSum">Sort by Remitted</option>
            <option value="deliveredCount">Sort by Delivered</option>
            <option value="openAssigned">Sort by Open Assigned</option>
            <option value="totalAssigned">Sort by Total Assigned</option>
          </select>
          <select className="input" value={sortDir} onChange={e=> setSortDir(e.target.value)}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
          <button className="btn" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      {/* Drivers table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Drivers {country ? `in ${country}` : ''}</div>
          <div className="helper">Currency: {country ? countryCurrency(country) : '-'}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {!isMobile && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--panel)' }}>
                <th style={{ padding: '12px', textAlign:'left', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px' }}>Driver</th>
                <th style={{ padding: '12px', textAlign:'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px' }}>Open</th>
                <th style={{ padding: '12px', textAlign:'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px' }}>Assigned</th>
                <th style={{ padding: '12px', textAlign:'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px' }}>Delivered</th>
                <th style={{ padding: '12px', textAlign:'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px' }}>Collected</th>
                <th style={{ padding: '12px', textAlign:'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px' }}>Remitted</th>
                <th style={{ padding: '12px', textAlign:'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px' }}>Pending</th>
                <th style={{ padding: '12px', textAlign:'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:5}).map((_,i)=> (
                  <tr key={`sk${i}`}>
                    <td colSpan={8} style={{ padding:'12px' }}>
                      <div style={{ height:14, background:'var(--panel-2)', borderRadius:6, animation:'pulse 1.2s ease-in-out infinite' }} />
                    </td>
                  </tr>
                ))
              ) : !country ? (
                <tr><td colSpan={8} style={{ padding: '12px', opacity: 0.7 }}>Select a country to view driver settlement</td></tr>
              ) : drivers.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '12px', opacity: 0.7 }}>No drivers found</td></tr>
              ) : (
                rows.map((r, idx) => {
                  const varianceColor = r.variance > 0 ? 'var(--warning)' : (r.variance < 0 ? 'var(--success)' : 'var(--muted)')
                  const barPct = r.collectedSum > 0 ? Math.min(100, Math.max(0, (r.remittedSum / r.collectedSum) * 100)) : 0
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px' }}>
                        <span onClick={()=> goAllOrders(r.id)} title="View all orders" style={{ cursor:'pointer', fontWeight:600 }}>{userName(r.driver)}</span>
                        <div className="helper" style={{fontSize:11}}>{r.driver.email || ''}</div>
                      </td>
                      <td style={{ padding: '12px', textAlign:'right' }}>
                        <span onClick={()=> { const p = new URLSearchParams(); if (country) p.set('country', country); p.set('driver', r.id); p.set('ship','open'); navigate(`/user/orders?${p.toString()}`) }} title="View open assigned" style={{ cursor:'pointer', color:'#f59e0b', fontWeight:600 }}>{num(r.openAssigned)}</span>
                      </td>
                      <td style={{ padding: '12px', textAlign:'right' }}>
                        <span onClick={()=> goAllOrders(r.id)} title="View all assigned" style={{ cursor:'pointer', color:'#6366f1', fontWeight:600 }}>{num(r.totalAssigned)}</span>
                      </td>
                      <td style={{ padding: '12px', textAlign:'right' }}>
                        <span onClick={()=> goDelivered(r.id)} title="View delivered orders" style={{ cursor:'pointer', color:'#3b82f6', fontWeight:600 }}>{num(r.deliveredCount)}</span>
                      </td>
                      <td style={{ padding: '12px', textAlign:'right' }}>
                        <span onClick={()=> goDeliveredCollected(r.id)} title="View delivered orders with collected payments" style={{ cursor:'pointer', color:'#22c55e', fontWeight:600 }}>{num(r.collectedSum)}</span>
                      </td>
                      <td style={{ padding: '12px', textAlign:'right' }}>
                        <span onClick={()=> { setDetailModalFor(''); setRemitModalFor(r.id) }} title="View remittances" style={{ cursor:'pointer', color:'#22c55e', fontWeight:600 }}>{num(r.remittedSum)}</span>
                      </td>
                      <td style={{ padding: '12px', textAlign:'right' }}>
                        <span onClick={()=> { setDetailModalFor(''); setRemitModalFor(r.id) }} title="View pending remittances" style={{ cursor:'pointer', color:'#ef4444', fontWeight:600 }}>{num(r.variance)}</span>
                      </td>
                      <td style={{ padding: '12px', textAlign:'right' }}>
                        <div style={{display:'inline-flex', gap:8, alignItems:'center', justifyContent:'flex-end', flexWrap:'wrap'}}>
                          <button className="btn" style={{fontSize:13, padding:'6px 12px'}} onClick={()=> { setRemitModalFor(''); setDetailModalFor(r.id) }}>Details</button>
                          <button className="btn secondary" style={{fontSize:13, padding:'6px 12px'}} onClick={()=> { setDetailModalFor(''); setRemitModalFor(r.id) }}>History</button>
                          {(()=>{
                            const pending = latestPendingRemitForDriver(r.id)
                            if (!pending) return null
                            const status = String(pending?.status||'').toLowerCase()
                            const isManagerAccepted = status === 'manager_accepted'
                            return (
                              <>
                                <button className="btn" style={{fontSize:13, padding:'6px 12px', background: isManagerAccepted ? '#10b981' : undefined}} onClick={()=> setAcceptModal(pending)}>
                                  {isManagerAccepted ? '✓ Approve' : 'Pending'}
                                </button>
                                {pending.pdfPath && (
                                  <a 
                                    href={pending.pdfPath}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn"
                                    style={{background:'#dc2626', color:'white', padding:'6px 12px', fontSize:13, textDecoration:'none'}}
                                  >
                                    📄 PDF
                                  </a>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:'2px solid var(--border)', background:'var(--panel)' }}>
                <td style={{ padding:'12px', fontWeight:700 }}>Totals</td>
                <td style={{ padding:'12px', textAlign:'right', fontWeight:700, color:'#f59e0b' }}>
                  <span style={{ cursor:'pointer' }} onClick={()=>{ const p=new URLSearchParams(); if(country) p.set('country', country); p.set('ship','open'); navigate(`/user/orders?${p.toString()}`) }}>{num(totals.openA)}</span>
                </td>
                <td style={{ padding:'12px', textAlign:'right', fontWeight:700, color:'#6366f1' }}>
                  <span style={{ cursor:'pointer' }} onClick={()=>{ const p=new URLSearchParams(); if(country) p.set('country', country); navigate(`/user/orders?${p.toString()}`) }}>{num(totals.totalA)}</span>
                </td>
                <td style={{ padding:'12px', textAlign:'right', fontWeight:700, color:'#3b82f6' }}>
                  <span style={{ cursor:'pointer' }} onClick={()=>{ const p=new URLSearchParams(); if(country) p.set('country', country); p.set('ship','delivered'); navigate(`/user/orders?${p.toString()}`) }}>{num(totals.delivered)}</span>
                </td>
                <td style={{ padding:'12px', textAlign:'right', fontWeight:700, color:'#22c55e' }}>
                  <span style={{ cursor:'pointer' }} onClick={()=>{ const p=new URLSearchParams(); if(country) p.set('country', country); p.set('ship','delivered'); p.set('collected','true'); navigate(`/user/orders?${p.toString()}`) }}>{num(totals.collected)}</span>
                </td>
                <td style={{ padding:'12px', textAlign:'right', fontWeight:700, color:'#22c55e' }}>{num(totals.remitted)}</td>
                <td style={{ padding:'12px', textAlign:'right', fontWeight:700, color:'#ef4444' }}>{num(totals.pending)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          )}
          {isMobile && (
            <div style={{ display:'grid', gap:8 }}>
              {loading ? (
                <div className="helper">Loading…</div>
              ) : !country ? (
                <div className="helper">Select a country to view driver settlement</div>
              ) : rows.length===0 ? (
                <div className="helper">No drivers found</div>
              ) : rows.map(r => {
                const barPct = r.collectedSum > 0 ? Math.min(100, Math.max(0, (r.remittedSum / r.collectedSum) * 100)) : 0
                return (
                  <div key={r.id} className="card" style={{ display:'grid', gap:8, padding:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ fontWeight:800 }}>{userName(r.driver)}</div>
                      <div style={{display:'flex', gap:6, flexWrap:'wrap', alignItems:'center'}}>
                        {(()=>{
                          const pending = latestPendingRemitForDriver(r.id)
                          if (!pending) return null
                          const status = String(pending?.status||'').toLowerCase()
                          const isManagerAccepted = status === 'manager_accepted'
                          return (
                            <>
                              {isManagerAccepted && (
                                <span style={{
                                  padding: '4px 8px',
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  color: '#fff',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                                  whiteSpace:'nowrap'
                                }}>
                                  ✓ Manager OK
                                </span>
                              )}
                              <button className="btn small" onClick={()=> setAcceptModal(pending)}>
                                {isManagerAccepted ? 'Approve' : 'Accept'}
                              </button>
                              {pending.pdfPath && (
                                <a 
                                  href={pending.pdfPath}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn small"
                                  style={{background:'#dc2626', color:'white', textDecoration:'none'}}
                                  title="Download Settlement PDF"
                                >
                                  📄 PDF
                                </a>
                              )}
                            </>
                          )
                        })()}
                        <button className="btn secondary" onClick={()=> setDetailModalFor(r.id)}>Details</button>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
                      <span onClick={()=> { const p = new URLSearchParams(); if (country) p.set('country', country); p.set('driver', r.id); p.set('ship','open'); navigate(`/user/orders?${p.toString()}`) }} style={{ color:'#f59e0b', fontWeight:700, cursor:'pointer' }}>Open: {num(r.openAssigned)}</span>
                      <span onClick={()=> goAllOrders(r.id)} style={{ color:'#6366f1', fontWeight:700, cursor:'pointer' }}>Assigned: {num(r.totalAssigned)}</span>
                      <span onClick={()=> goDelivered(r.id)} style={{ color:'#3b82f6', fontWeight:700, cursor:'pointer' }}>Delivered: {num(r.deliveredCount)}</span>
                      <span onClick={()=> goDeliveredCollected(r.id)} style={{ color:'#22c55e', fontWeight:700, cursor:'pointer' }}>Collected: {num(r.collectedSum)}</span>
                    </div>
                    <div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span onClick={()=> setRemitModalFor(r.id)} style={{ color:'#22c55e', fontWeight:800, cursor:'pointer' }}>Remitted: {num(r.remittedSum)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {remitModalFor && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Driver Remittances</div>
              <button className="btn light" onClick={()=> setRemitModalFor('')}>Close</button>
            </div>
            <div className="modal-body" style={{ display:'grid', gap:8 }}>
              {filteredRemitsForDriver.length === 0 ? (
                <div className="helper">No remittances in selected date range.</div>
              ) : (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div className="helper">Showing {Math.min((remitPage - 1) * remitPerPage + 1, filteredRemitsForDriver.length)} - {Math.min(remitPage * remitPerPage, filteredRemitsForDriver.length)} of {filteredRemitsForDriver.length} remittances</div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <button className="btn secondary" onClick={()=> setRemitPage(p => Math.max(1, p - 1))} disabled={remitPage === 1} style={{fontSize:13, padding:'6px 12px'}}>← Prev</button>
                      <span style={{fontSize:13}}>Page {remitPage} of {Math.ceil(filteredRemitsForDriver.length / remitPerPage)}</span>
                      <button className="btn secondary" onClick={()=> setRemitPage(p => Math.min(Math.ceil(filteredRemitsForDriver.length / remitPerPage), p + 1))} disabled={remitPage >= Math.ceil(filteredRemitsForDriver.length / remitPerPage)} style={{fontSize:13, padding:'6px 12px'}}>Next →</button>
                    </div>
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--panel)' }}>
                          <th style={{ padding:'12px', textAlign:'left', fontWeight:600, fontSize:12, textTransform:'uppercase', color:'var(--muted)', letterSpacing:'0.5px' }}>Amount</th>
                          <th style={{ padding:'12px', textAlign:'left', fontWeight:600, fontSize:12, textTransform:'uppercase', color:'var(--muted)', letterSpacing:'0.5px' }}>Status</th>
                          <th style={{ padding:'12px', textAlign:'left', fontWeight:600, fontSize:12, textTransform:'uppercase', color:'var(--muted)', letterSpacing:'0.5px' }}>Method</th>
                          <th style={{ padding:'12px', textAlign:'left', fontWeight:600, fontSize:12, textTransform:'uppercase', color:'var(--muted)', letterSpacing:'0.5px' }}>Manager</th>
                          <th style={{ padding:'12px', textAlign:'left', fontWeight:600, fontSize:12, textTransform:'uppercase', color:'var(--muted)', letterSpacing:'0.5px' }}>Accepted</th>
                          <th style={{ padding:'12px', textAlign:'left', fontWeight:600, fontSize:12, textTransform:'uppercase', color:'var(--muted)', letterSpacing:'0.5px' }}>Created</th>
                          <th style={{ padding:'12px', textAlign:'left', fontWeight:600, fontSize:12, textTransform:'uppercase', color:'var(--muted)', letterSpacing:'0.5px' }}>Receipt</th>
                          <th style={{ padding:'12px', textAlign:'left', fontWeight:600, fontSize:12, textTransform:'uppercase', color:'var(--muted)', letterSpacing:'0.5px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRemitsForDriver.slice((remitPage - 1) * remitPerPage, remitPage * remitPerPage).map((r, i)=> (
                          <tr key={String(r._id||i)} style={{ borderTop:'1px solid var(--border)' }}>
                            <td style={{ padding:'12px', fontWeight:600, color:'#22c55e' }}>{num(r.amount)} {r.currency||''}</td>
                            <td style={{ padding:'12px' }}><span className="badge" style={{fontSize:11}}>{String(r.status||'').toUpperCase()}</span></td>
                            <td style={{ padding:'12px' }}>{(String(r.method||'hand').toLowerCase()==='transfer') ? 'Transfer' : 'Hand'}</td>
                            <td style={{ padding:'12px' }}>{r?.manager ? ((r.manager.firstName||'') + ' ' + (r.manager.lastName||'')).trim() || (r.manager.email||'-') : '-'}</td>
                            <td style={{ padding:'12px' }}>{r.acceptedAt? new Date(r.acceptedAt).toLocaleString(): '—'}</td>
                            <td style={{ padding:'12px' }}>{r.createdAt? new Date(r.createdAt).toLocaleString(): '—'}</td>
                            <td style={{ padding:'12px' }}>
                              {(r.pdfPath || r.acceptedPdfPath) ? (
                                <a href={`${API_BASE}/api/finance/remittances/${r._id}/download-settlement`} target="_blank" rel="noopener noreferrer" className="btn" style={{fontSize:13, padding:'6px 12px'}}>Download</a>
                              ) : '—'}
                            </td>
                            <td style={{ padding:'12px' }}>
                              {String(r.status||'').toLowerCase()==='pending' || String(r.status||'').toLowerCase()==='manager_accepted' ? (
                                <div style={{display:'flex', gap:6}}>
                                  <button className="btn" style={{fontSize:13, padding:'6px 12px'}} onClick={()=> acceptRemit(String(r._id||''))}>Accept</button>
                                  <button className="btn secondary" style={{fontSize:13, padding:'6px 12px'}} onClick={()=> rejectRemit(String(r._id||''))}>Reject</button>
                                </div>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {detailModalFor && (()=>{
        const r = rows.find(x => String(x.id) === String(detailModalFor))
        if (!r) return null
        const actionsStyle = { display:'flex', gap:8, flexWrap:'wrap' }
        const btnStyle = { padding:'6px 10px' }
        const hist = driverRemits
          .filter(x => String(x?.driver?._id || x?.driver || '') === String(r.id))
          .filter(x => (fromDate || toDate) ? dateInRange(x?.acceptedAt || x?.createdAt, fromDate, toDate) : true)
        return (
          <div className="modal-backdrop">
            <div className="modal">
              <div className="modal-header">
                <div className="modal-title">Driver Details</div>
                <button className="btn light" onClick={()=> setDetailModalFor('')}>Close</button>
              </div>
              <div className="modal-body" style={{ display:'grid', gap:12 }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Driver</div>
                    <div style={{ fontWeight:800 }}>{userName(r.driver)}</div>
                    <div className="helper">{r.driver.email||''}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Assigned (Open)</div>
                    <div style={{ fontWeight:800, color:'#f59e0b' }}>{num(r.openAssigned)}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Total Assigned</div>
                    <div style={{ fontWeight:800 }}>{num(r.totalAssigned)}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Delivered</div>
                    <div style={{ fontWeight:800 }}>{num(r.deliveredCount)}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Returned</div>
                    <div style={{ fontWeight:800, color:'var(--danger)' }}>{num(r.returned)}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Cancelled</div>
                    <div style={{ fontWeight:800, color:'var(--danger)' }}>{num(r.cancelled)}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Collected ({ccy})</div>
                    <div style={{ fontWeight:800, color:'#22c55e' }}>{num(r.collectedSum)}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Remitted ({ccy})</div>
                    <div style={{ fontWeight:800, color:'#22c55e' }}>{num(r.remittedSum)}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Pending ({ccy})</div>
                    <div style={{ fontWeight:800, color:'var(--danger)' }}>{num(r.variance)}</div>
                  </div>
                </div>
                <div style={actionsStyle}>
                  <button className="btn" style={btnStyle} onClick={()=> { const p = new URLSearchParams(); if (country) p.set('country', country); p.set('driver', r.id); p.set('ship','open'); navigate(`/user/orders?${p.toString()}`) }}>Open Assigned</button>
                  <button className="btn" style={btnStyle} onClick={()=> goAllOrders(r.id)}>All Assigned</button>
                  <button className="btn" style={btnStyle} onClick={()=> goDelivered(r.id)}>Delivered</button>
                  <button className="btn" style={btnStyle} onClick={()=> goDeliveredCollected(r.id)}>Collected</button>
                  <button className="btn" style={btnStyle} onClick={()=> { const p = new URLSearchParams(); if(country) p.set('country', country); p.set('driver', r.id); p.set('ship','returned'); navigate(`/user/orders?${p.toString()}`) }}>Returned</button>
                  <button className="btn" style={btnStyle} onClick={()=> { const p = new URLSearchParams(); if(country) p.set('country', country); p.set('driver', r.id); p.set('ship','cancelled'); navigate(`/user/orders?${p.toString()}`) }}>Cancelled</button>
                </div>
                {null}
              </div>
            </div>
          </div>
        )
      })()}
      
      {/* Pay to Company Modal */}
      {payModal && (
        <Modal
          title="Pay to Company"
          open={payModal}
          onClose={()=> setPayModal(false)}
          footer={
            <>
              <button className="btn secondary" onClick={()=> setPayModal(false)} disabled={submitting}>Cancel</button>
              <button className="btn success" disabled={submitting} onClick={payToCompany}>Confirm & Send</button>
            </>
          }
        >
          <div style={{display:'grid', gap:10}}>
            <div className="helper">Send collected driver funds to company</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:10}}>
              <div>
                <label className="input-label">Amount ({managerSummary.currency})</label>
                <input className="input" type="number" min="0" step="0.01" value={payForm.amount} onChange={e=> setPayForm(f=>({...f, amount:e.target.value}))} />
              </div>
              <div>
                <label className="input-label">Method</label>
                <select className="input" value={payForm.method} onChange={e=> setPayForm(f=>({...f, method:e.target.value}))}>
                  <option value="hand">Hand</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
            </div>
            {payForm.method === 'transfer' && (
              <div>
                <label className="input-label">Upload Proof (image)</label>
                <input className="input" type="file" accept="image/*" onChange={e=> setPayForm(f=>({...f, file: (e.target.files && e.target.files[0]) || null}))} />
              </div>
            )}
            <div>
              <label className="input-label">Note (optional)</label>
              <textarea className="input" rows={2} value={payForm.note} onChange={e=> setPayForm(f=>({...f, note:e.target.value}))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Info({ label, value }){
  return (
    <div className="panel" style={{ padding:10, borderRadius:10 }}>
      <div className="helper" style={{ fontSize:12 }}>{label}</div>
      <div style={{ fontWeight:700 }}>{value}</div>
    </div>
  )
}

// old helpers removed with ledger
