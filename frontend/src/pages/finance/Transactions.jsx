import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPost, apiUpload } from '../../api'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/Modal.jsx'
import { useToast } from '../../ui/Toast.jsx'

export default function Transactions() {
  const navigate = useNavigate()
  const toast = useToast()
  const [me, setMe] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('me') || '{}')
    } catch {
      return {}
    }
  })
  const role = String(me?.role || '')
  const [driverRemits, setDriverRemits] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [country, setCountry] = useState('')
  const [countryOptions, setCountryOptions] = useState([])
  const [drivers, setDrivers] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(0) // 0 = All time
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [sortBy, setSortBy] = useState('variance')
  const [sortDir, setSortDir] = useState('desc')
  const [remitModalFor, setRemitModalFor] = useState('')
  const [detailModalFor, setDetailModalFor] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [acceptModal, setAcceptModal] = useState(null)
  const [managerSummary, setManagerSummary] = useState({
    totalSent: 0,
    totalAccepted: 0,
    totalPending: 0,
    currency: '',
  })
  const [payModal, setPayModal] = useState(false)
  const [payForm, setPayForm] = useState({ amount: '', method: 'hand', note: '', file: null })
  const [submitting, setSubmitting] = useState(false)
  const [remitPage, setRemitPage] = useState(1)
  const remitPerPage = 6
  const [driverRemitsHistory, setDriverRemitsHistory] = useState([])
  const [openGroups, setOpenGroups] = useState({})

  // Helper to get date range for selected month (UAE timezone UTC+4)
  const getMonthDateRange = () => {
    if (selectedMonth === 0) return null // All time
    const UAE_OFFSET_HOURS = 4
    const startDate = new Date(
      Date.UTC(selectedYear, selectedMonth - 1, 1, -UAE_OFFSET_HOURS, 0, 0, 0)
    )
    const endDate = new Date(
      Date.UTC(selectedYear, selectedMonth, 0, 23 - UAE_OFFSET_HOURS, 59, 59, 999)
    )
    return {
      from: startDate.toISOString(),
      to: endDate.toISOString(),
    }
  }

  // Load country options for filter (top selector)
  useEffect(() => {
    ;(async () => {
      try {
        const r = await apiGet('/api/orders/options')
        const arr = Array.isArray(r?.countries) ? r.countries : []
        // Normalize and dedupe (avoid both 'UAE' and 'Uae')
        const map = new Map()
        for (const c of arr) {
          const raw = String(c || '').trim()
          const key = raw.toLowerCase()
          if (!map.has(key)) map.set(key, raw.toUpperCase() === 'UAE' ? 'UAE' : raw)
        }
        const options = Array.from(map.values())
        setCountryOptions(options)
        // Default to first country if not set
        if (!country && options.length > 0) {
          setCountry(options[0])
        }
      } catch {
        setCountryOptions([])
      }
    })()
  }, [])

  // When country changes, load drivers and remittances only (backend provides aggregated data)
  useEffect(() => {
    if (!country) {
      setDrivers([])
      setDriverRemits([])
      return
    }
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const dateRange = getMonthDateRange()
        const dateQuery = dateRange ? `&from=${dateRange.from}&to=${dateRange.to}` : ''

        // Load driver summaries with all aggregated data from backend
        const loadDrivers = apiGet(
          `/api/finance/drivers/summary?country=${encodeURIComponent(country)}&limit=200${dateQuery}`
        )
          .then((d) => {
            if (alive) setDrivers(Array.isArray(d?.drivers) ? d.drivers : [])
          })
          .catch(() => {
            if (alive) setDrivers([])
          })

        // Load remittances
        const remitsUrl =
          role === 'manager'
            ? `/api/finance/remittances?workspace=1&country=${encodeURIComponent(country)}${dateQuery}`
            : `/api/finance/remittances?country=${encodeURIComponent(country)}${dateQuery}`
        const loadRemits = apiGet(remitsUrl)
          .then((remitResp) => {
            const allRemits = Array.isArray(remitResp?.remittances) ? remitResp.remittances : []
            // Backend now handles filtering, but we keep this just in case
            const filteredRemits = allRemits
            if (alive) setDriverRemits(filteredRemits)
          })
          .catch(() => {
            if (alive) setDriverRemits([])
          })

        await Promise.all([loadDrivers, loadRemits])
      } catch (e) {
        if (alive) setErr(e?.message || 'Failed to load driver finances')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [country, role, selectedMonth, selectedYear])

  // Reset remit page when modal opens and load driver remittances from API
  useEffect(() => {
    if (remitModalFor) {
      setRemitPage(1)
      // Load all remittances for this driver directly from API with pagination
      let alive = true
      ;(async () => {
        try {
          const allRemits = []
          let page = 1
          let hasMore = true
          // Fetch all pages to get complete history
          while (hasMore && page <= 50) {
            const remitsUrl =
              role === 'manager'
                ? `/api/finance/remittances?workspace=1&page=${page}&limit=100`
                : `/api/finance/remittances?page=${page}&limit=100`
            const res = await apiGet(remitsUrl)
            const items = Array.isArray(res?.remittances) ? res.remittances : []
            allRemits.push(...items)
            hasMore = res?.hasMore || false
            page++
          }
          // Filter by driver ID only, don't filter by country to get complete history
          const driverRemits = allRemits.filter(
            (r) => String(r?.driver?._id || r?.driver || '') === String(remitModalFor)
          )
          if (alive) setDriverRemitsHistory(driverRemits)
        } catch {
          if (alive) setDriverRemitsHistory([])
        }
      })()
      return () => {
        alive = false
      }
    } else {
      setDriverRemitsHistory([])
    }
  }, [remitModalFor, role])

  // Live updates: refresh remittances on create/accept/reject/manager_accepted
  useEffect(() => {
    let socket
    try {
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, {
        path: '/socket.io',
        transports: ['polling'],
        upgrade: false,
        withCredentials: true,
        auth: { token },
      })
      const onRemit = async () => {
        try {
          await refreshRemittances()
        } catch {}
      }
      socket.on('remittance.created', onRemit)
      socket.on('remittance.accepted', onRemit)
      socket.on('remittance.rejected', onRemit)
      socket.on('remittance.manager_accepted', onRemit)
    } catch {}
    return () => {
      try {
        socket && socket.off('remittance.created')
      } catch {}
      try {
        socket && socket.off('remittance.accepted')
      } catch {}
      try {
        socket && socket.off('remittance.rejected')
      } catch {}
      try {
        socket && socket.off('remittance.manager_accepted')
      } catch {}
      try {
        socket && socket.disconnect()
      } catch {}
    }
  }, [])

  // Live manager remittance updates
  useEffect(() => {
    if (role !== 'manager') return
    let socket
    try {
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, {
        path: '/socket.io',
        transports: ['polling'],
        upgrade: false,
        withCredentials: true,
        auth: { token },
      })
      const onMgrRemit = async () => {
        try {
          const url = country
            ? `/api/finance/manager-remittances/summary?country=${encodeURIComponent(country)}`
            : '/api/finance/manager-remittances/summary'
          const r = await apiGet(url)
          setManagerSummary({
            totalSent: Number(r?.totalSent || 0),
            totalAccepted: Number(r?.totalAccepted || 0),
            totalPending: Number(r?.totalPending || 0),
            currency: r?.currency || '',
          })
        } catch {}
      }
      socket.on('manager-remittance.accepted', onMgrRemit)
      socket.on('manager-remittance.rejected', onMgrRemit)
    } catch {}
    return () => {
      try {
        socket && socket.off('manager-remittance.accepted')
      } catch {}
      try {
        socket && socket.off('manager-remittance.rejected')
      } catch {}
      try {
        socket && socket.disconnect()
      } catch {}
    }
  }, [role, country])

  async function refreshRemittances() {
    try {
      const dateRange = getMonthDateRange()
      const dateQuery = dateRange ? `&from=${dateRange.from}&to=${dateRange.to}` : ''
      const remitsUrl =
        role === 'manager'
          ? `/api/finance/remittances?workspace=1&country=${encodeURIComponent(country)}${dateQuery}`
          : `/api/finance/remittances?country=${encodeURIComponent(country)}${dateQuery}`
      const remitResp = await apiGet(remitsUrl)
      const allRemits = Array.isArray(remitResp?.remittances) ? remitResp.remittances : []
      setDriverRemits(allRemits)
    } catch {}
  }
  async function acceptRemit(id) {
    try {
      await apiPost(`/api/finance/remittances/${id}/accept`, {})
      await refreshRemittances()
      toast.success('Remittance accepted')
    } catch (e) {
      toast.error(e?.message || 'Failed to accept')
    }
  }
  async function rejectRemit(id) {
    try {
      await apiPost(`/api/finance/remittances/${id}/reject`, {})
      await refreshRemittances()
      toast.warn('Remittance rejected')
    } catch (e) {
      toast.error(e?.message || 'Failed to reject')
    }
  }
  function num(n) {
    return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  function userName(u) {
    if (!u) return '-'
    return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '-'
  }
  function dateInRange(d, from, to) {
    try {
      if (!d) return false
      const t = new Date(d).getTime()
      if (from) {
        const f = new Date(from).setHours(0, 0, 0, 0)
        if (t < f) return false
      }
      if (to) {
        const tt = new Date(to).setHours(23, 59, 59, 999)
        if (t > tt) return false
      }
      return true
    } catch {
      return true
    }
  }

  function latestPendingRemitForDriver(driverId) {
    try {
      // For managers: show only 'pending' status
      // For owners: show both 'pending' and 'manager_accepted' status
      const statusFilter =
        role === 'manager'
          ? (r) => String(r?.status || '').toLowerCase() === 'pending'
          : (r) => ['pending', 'manager_accepted'].includes(String(r?.status || '').toLowerCase())

      const list = driverRemits
        .filter((r) => String(r?.driver?._id || r?.driver || '') === String(driverId))
        // Country filter is now handled by backend/refreshRemittances but keeping for safety
        .filter(
          (r) =>
            String(r?.country || '')
              .trim()
              .toLowerCase() ===
            String(country || '')
              .trim()
              .toLowerCase()
        )
        .filter(statusFilter)
        .filter((r) =>
          role === 'manager'
            ? String(r?.manager?._id || r?.manager || '') === String(me?._id || me?.id || '')
            : true
        )
        // Date filter is now handled by backend
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.acceptedAt || 0) - new Date(a.createdAt || a.acceptedAt || 0)
        )
      return list[0] || null
    } catch {
      return null
    }
  }
  async function quickAcceptForDriver(driverId) {
    const r = latestPendingRemitForDriver(driverId)
    if (!r) {
      alert('No pending remittance for this driver in the current filters')
      return
    }
    const amt = `${r.currency || ''} ${Number(r.amount || 0).toFixed(2)}`
    const ok = window.confirm(`Accept pending remittance of ${amt}?`)
    if (!ok) return
    await acceptRemit(String(r._id || ''))
  }

  // Sum accepted/received remittances per driver (delivered to company)
  const driverAcceptedSum = useMemo(() => {
    const by = new Map()
    for (const r of driverRemits) {
      if (
        String(r?.country || '')
          .trim()
          .toLowerCase() !==
        String(country || '')
          .trim()
          .toLowerCase()
      )
        continue
      const st = String(r?.status || '')
      // Include accepted, received, and manager_accepted statuses
      if (st === 'accepted' || st === 'received' || st === 'manager_accepted') {
        const id = String(r?.driver?._id || r?.driver || '')
        if (!id) continue
        // Date filtering is handled by backend now
        if (!by.has(id)) by.set(id, 0)
        by.set(id, by.get(id) + Number(r?.amount || 0))
      }
    }
    return by
  }, [driverRemits, country])

  function countryCurrency(c) {
    const raw = String(c || '')
      .trim()
      .toLowerCase()
    if (!raw) return 'SAR'
    if (raw.includes('saudi') || raw === 'ksa') return 'SAR'
    if (raw.includes('united arab emirates') || raw === 'uae' || raw === 'ae') return 'AED'
    if (raw === 'oman' || raw === 'om') return 'OMR'
    if (raw === 'bahrain' || raw === 'bh') return 'BHD'
    if (raw === 'india' || raw === 'in') return 'INR'
    if (raw === 'kuwait' || raw === 'kw' || raw === 'kwt') return 'KWD'
    if (raw === 'qatar' || raw === 'qa') return 'QAR'
    return 'SAR'
  }
  const ccy = countryCurrency(country)
  function num(n) {
    return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  function goAllOrders(driverId) {
    const p = new URLSearchParams()
    if (country) p.set('country', country)
    p.set('driver', String(driverId))
    navigate(`/user/orders?${p.toString()}`)
  }
  function goDelivered(driverId) {
    const p = new URLSearchParams()
    if (country) p.set('country', country)
    p.set('driver', String(driverId))
    p.set('ship', 'delivered')
    navigate(`/user/orders?${p.toString()}`)
  }
  function goDeliveredCollected(driverId) {
    const p = new URLSearchParams()
    if (country) p.set('country', country)
    p.set('driver', String(driverId))
    p.set('ship', 'delivered')
    p.set('collected', 'true')
    navigate(`/user/orders?${p.toString()}`)
  }

  const rows = useMemo(() => {
    const arr = drivers.map((d) => {
      // Use backend-calculated values from /api/finance/drivers/summary
      const id = String(d?.id || d?._id)
      const openCount = d.open || 0 // Orders with non-final statuses
      const assignedCount = d.assigned || 0 // Orders with 'assigned' status only
      const deliveredCount = d.deliveredCount || 0
      const collectedSum = d.collected || 0
      const remittedSum = d.deliveredToCompany || 0
      const variance = d.pendingToCompany || 0
      const returned = 0 // Not needed for main view, can be loaded on demand
      const cancelled = d.canceled || 0
      // Create driver object in expected format
      const driver = {
        _id: id,
        firstName: d.name?.split(' ')[0] || '',
        lastName: d.name?.split(' ').slice(1).join(' ') || '',
        phone: d.phone || '',
        country: d.country || '',
      }
      return {
        id,
        driver,
        openCount,
        assignedCount,
        deliveredCount,
        collectedSum,
        remittedSum,
        variance,
        returned,
        cancelled,
      }
    })
    const dir = sortDir === 'asc' ? 1 : -1
    const key = sortBy
    arr.sort((a, b) => {
      const av = a[key] ?? 0
      const bv = b[key] ?? 0
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return arr
  }, [drivers, sortBy, sortDir])

  const totals = useMemo(() => {
    let delivered = 0,
      collected = 0,
      remitted = 0,
      pending = 0,
      openTotal = 0,
      assignedTotal = 0
    for (const r of rows) {
      delivered += Number(r.deliveredCount || 0)
      collected += Number(r.collectedSum || 0)
      remitted += Number(r.remittedSum || 0)
      pending += Number(r.variance || 0)
      openTotal += Number(r.openCount || 0)
      assignedTotal += Number(r.assignedCount || 0)
    }
    return { delivered, collected, remitted, pending, openTotal, assignedTotal }
  }, [rows])

  function exportCsv() {
    try {
      const header = [
        'Driver',
        'Email',
        'Open',
        'Assigned',
        'Delivered',
        'Returned',
        'Cancelled',
        'Collected',
        'Remitted',
        'Pending',
      ]
      const lines = [header.join(',')]
      for (const r of rows) {
        lines.push(
          [
            `${r.driver.firstName || ''} ${r.driver.lastName || ''}`.trim(),
            r.driver.email || '',
            r.openCount,
            r.assignedCount,
            r.deliveredCount,
            r.returned,
            r.cancelled,
            r.collectedSum,
            r.remittedSum,
            r.variance,
          ]
            .map((v) =>
              typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v
            )
            .join(',')
        )
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `driver-finances-${country || 'all'}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {}
  }

  const filteredRemitsForDriver = useMemo(() => {
    if (!remitModalFor) return []
    // Use driverRemitsHistory which is loaded directly from API for this specific driver
    // Backend filtering is better but for history modal we might want to keep client filtering if we loaded ALL history
    // But wait, driverRemitsHistory is loaded in useEffect when modal opens, we should update THAT to use date filter too?
    // The previous code loaded ALL history (pages 1-50).
    // If we want to support date filtering in the modal too, we should probably filter client side there OR pass date to that API call too.
    // For now, let's keep client side filtering for the modal history using the selected date range
    const dateRange = getMonthDateRange()
    const from = dateRange?.from
    const to = dateRange?.to
    return driverRemitsHistory.filter((r) =>
      from || to ? dateInRange(r?.acceptedAt || r?.createdAt, from, to) : true
    )
  }, [driverRemitsHistory, remitModalFor, selectedMonth, selectedYear])

  // Pay to company handler
  async function payToCompany() {
    if (!payForm.amount) {
      toast.error('Enter amount')
      return
    }
    const amt = Number(payForm.amount)
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (payForm.method === 'transfer' && !payForm.file) {
      toast.error('Attach proof for transfer method')
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('amount', String(amt))
      fd.append('method', payForm.method)
      if (country) fd.append('country', country)
      if (payForm.note) fd.append('note', payForm.note)
      if (payForm.method === 'transfer' && payForm.file) fd.append('receipt', payForm.file)
      await apiUpload('/api/finance/manager-remittances', fd)
      // Refresh summary
      try {
        const url = country
          ? `/api/finance/manager-remittances/summary?country=${encodeURIComponent(country)}`
          : '/api/finance/manager-remittances/summary'
        const r = await apiGet(url)
        setManagerSummary({
          totalSent: Number(r?.totalSent || 0),
          totalAccepted: Number(r?.totalAccepted || 0),
          totalPending: Number(r?.totalPending || 0),
          currency: r?.currency || '',
        })
      } catch {}
      setPayForm({ amount: '', method: 'hand', note: '', file: null })
      setPayModal(false)
      toast.success('Payment sent to company. You will be notified when approved.')
    } catch (e) {
      toast.error(e?.message || 'Failed to send payment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="section" style={{ display: 'grid', gap: 12 }}>
      <div className="page-header" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
        <div>
          <div
            className="page-title gradient heading-blue"
            style={{
              fontSize: '32px',
              fontWeight: 900,
              letterSpacing: '-0.5px',
              marginBottom: '8px',
            }}
          >
            Driver Finances
          </div>
          <div className="page-subtitle" style={{ fontSize: '15px' }}>
            Monitor drivers' delivered collections and remittances
          </div>
        </div>
        {acceptModal && (
          <Modal
            title="Accept Driver Remittance"
            open={!!acceptModal}
            onClose={() => setAcceptModal(null)}
            footer={
              <>
                <button className="btn secondary" onClick={() => setAcceptModal(null)}>
                  Close
                </button>
                {role !== 'driver' && (
                  <>
                    <button
                      className="btn danger"
                      onClick={async () => {
                        const id = String(acceptModal?._id || '')
                        await rejectRemit(id)
                        setAcceptModal(null)
                      }}
                    >
                      Reject
                    </button>
                    <button
                      className="btn success"
                      onClick={async () => {
                        const id = String(acceptModal?._id || '')
                        await acceptRemit(id)
                        setAcceptModal(null)
                      }}
                    >
                      Accept
                    </button>
                  </>
                )}
              </>
            }
          >
            <div style={{ display: 'grid', gap: 8 }}>
              {String(acceptModal?.status || '').toLowerCase() === 'manager_accepted' && (
                <div
                  style={{
                    padding: '12px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    borderRadius: 8,
                    fontWeight: 600,
                    textAlign: 'center',
                  }}
                >
                  ✓ Accepted by Manager:{' '}
                  {`${acceptModal?.managerAcceptedBy?.firstName || ''} ${acceptModal?.managerAcceptedBy?.lastName || ''}`.trim() ||
                    'Manager'}
                </div>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))',
                  gap: 8,
                }}
              >
                <Info
                  label="Driver"
                  value={
                    `${acceptModal?.driver?.firstName || ''} ${acceptModal?.driver?.lastName || ''}`.trim() ||
                    acceptModal?.driver?.email ||
                    '-'
                  }
                />
                <Info
                  label="Submitted To"
                  value={
                    `${acceptModal?.manager?.firstName || ''} ${acceptModal?.manager?.lastName || ''}`.trim() ||
                    '—'
                  }
                />
                <Info
                  label="Amount"
                  value={`${acceptModal?.currency || ''} ${Number(acceptModal?.amount || 0).toFixed(2)}`}
                />
                <Info label="Method" value={String(acceptModal?.method || 'hand').toUpperCase()} />
                {acceptModal?.paidToName ? (
                  <Info label="Paid To" value={acceptModal?.paidToName} />
                ) : null}
                {acceptModal?.note ? <Info label="Note" value={acceptModal?.note} /> : null}
                <Info
                  label="Created"
                  value={
                    acceptModal?.createdAt ? new Date(acceptModal.createdAt).toLocaleString() : '-'
                  }
                />
                {acceptModal?.managerAcceptedAt ? (
                  <Info
                    label="Manager Accepted"
                    value={new Date(acceptModal.managerAcceptedAt).toLocaleString()}
                  />
                ) : null}
              </div>
              {acceptModal?.receiptPath ? (
                <div>
                  <div className="helper">Proof</div>
                  <img
                    src={`${API_BASE}${acceptModal.receiptPath}`}
                    alt="Proof"
                    style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                </div>
              ) : null}
            </div>
          </Modal>
        )}
      </div>
      {err && <div className="error">{err}</div>}

      {/* Manager Summary & Pay to Company */}
      {role === 'manager' && (
        <div
          className="card hover-lift"
          style={{ display: 'grid', gap: 10, animation: 'scaleIn 0.5s ease-out 0.1s backwards' }}
        >
          <div className="card-header">
            <div>
              <div className="card-title" style={{ fontSize: '20px', fontWeight: 800 }}>
                Manager Payable to Company
              </div>
              <div className="card-subtitle">Total amount collected from drivers</div>
            </div>
            <button
              className="btn action-btn"
              onClick={() => {
                const toPay = Math.max(0, totals.remitted - managerSummary.totalSent)
                setPayForm({ amount: toPay.toFixed(2), method: 'hand', note: '', file: null })
                setPayModal(true)
              }}
              disabled={managerSummary.totalPending > 0}
              title={
                managerSummary.totalPending > 0
                  ? 'You have a pending remittance awaiting approval'
                  : 'Send payment to company'
              }
              style={managerSummary.totalPending > 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              {managerSummary.totalPending > 0 ? 'Pending Approval...' : 'Pay to Company'}
            </button>
          </div>
          <div
            className="section"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))',
              gap: 16,
            }}
          >
            <div
              className="stat-card stagger-item gradient-purple"
              style={{ animationDelay: '0.2s' }}
            >
              <div
                style={{
                  fontSize: 13,
                  opacity: 0.95,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                }}
              >
                Total Collected from Drivers
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px' }}>
                {managerSummary.currency} {num(totals.remitted)}
              </div>
            </div>
            <div
              className="stat-card stagger-item gradient-green"
              style={{ animationDelay: '0.25s' }}
            >
              <div
                style={{
                  fontSize: 13,
                  opacity: 0.95,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                }}
              >
                Sent to Company
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px' }}>
                {managerSummary.currency} {num(managerSummary.totalAccepted)}
              </div>
            </div>
            <div
              className="stat-card stagger-item gradient-orange"
              style={{
                animationDelay: '0.3s',
                ...(managerSummary.totalPending > 0
                  ? { animation: 'pulseGlow 2s ease-in-out infinite' }
                  : {}),
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  opacity: 0.95,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                }}
              >
                Pending Approval
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px' }}>
                {managerSummary.currency} {num(managerSummary.totalPending)}
              </div>
            </div>
            <div
              className="stat-card stagger-item gradient-red"
              style={{ animationDelay: '0.35s' }}
            >
              <div
                style={{
                  fontSize: 13,
                  opacity: 0.95,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                }}
              >
                To Pay Company
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px' }}>
                {managerSummary.currency}{' '}
                {num(Math.max(0, totals.remitted - managerSummary.totalSent))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="card hover-lift"
        style={{ display: 'grid', gap: 10, animation: 'scaleIn 0.5s ease-out 0.15s backwards' }}
      >
        <div className="card-header">
          <div className="card-title" style={{ fontSize: '18px', fontWeight: 800 }}>
            Filters
          </div>
        </div>
        <div
          className="section"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
          }}
        >
          <select
            className="input filter-select"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">Select Country</option>
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="input filter-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
          >
            <option value={0}>All Time</option>
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            className="input filter-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {Array.from({ length: 5 }).map((_, i) => {
              const y = new Date().getFullYear() - i
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              )
            })}
          </select>
          <select
            className="input filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="variance">Sort by Pending</option>
            <option value="collectedSum">Sort by Collected</option>
            <option value="remittedSum">Sort by Remitted</option>
            <option value="deliveredCount">Sort by Delivered</option>
            <option value="openAssigned">Sort by Open Assigned</option>
            <option value="totalAssigned">Sort by Total Assigned</option>
          </select>
          <select
            className="input filter-select"
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value)}
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
          <button
            className="btn action-btn gradient-blue"
            onClick={exportCsv}
            style={{ color: 'white', fontWeight: 700 }}
          >
            📊 Export CSV
          </button>
        </div>
      </div>

      {/* Drivers table */}
      <div className="card" style={{ animation: 'scaleIn 0.5s ease-out 0.2s backwards' }}>
        <div className="card-header">
          <div className="card-title" style={{ fontSize: '20px', fontWeight: 800 }}>
            Drivers {country ? `in ${country}` : ''}
          </div>
          <div className="helper" style={{ fontSize: '13px' }}>
            Currency: {country ? countryCurrency(country) : '-'}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }} className="premium-scroll">
          {!isMobile && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--panel)' }}>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Driver
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Open
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Assigned
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Delivered
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Collected
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Remitted
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Pending
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`sk${i}`}>
                      <td colSpan={8} style={{ padding: '12px' }}>
                        <div
                          className="skeleton"
                          style={{
                            height: 40,
                            borderRadius: 8,
                          }}
                        />
                      </td>
                    </tr>
                  ))
                ) : !country ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '12px', opacity: 0.7 }}>
                      Select a country to view driver finances
                    </td>
                  </tr>
                ) : drivers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '12px', opacity: 0.7 }}>
                      No drivers found
                    </td>
                  </tr>
                ) : (
                  rows.map((r, idx) => {
                    const varianceColor =
                      r.variance > 0
                        ? 'var(--warning)'
                        : r.variance < 0
                          ? 'var(--success)'
                          : 'var(--muted)'
                    const barPct =
                      r.collectedSum > 0
                        ? Math.min(100, Math.max(0, (r.remittedSum / r.collectedSum) * 100))
                        : 0
                    return (
                      <tr
                        key={r.id}
                        className="premium-table-row"
                        style={{ borderTop: '1px solid var(--border)' }}
                      >
                        <td style={{ padding: '12px' }}>
                          <span
                            onClick={() => goAllOrders(r.id)}
                            title="View all orders"
                            style={{ cursor: 'pointer', fontWeight: 600 }}
                          >
                            {userName(r.driver)}
                          </span>
                          <div className="helper" style={{ fontSize: 11 }}>
                            {r.driver.email || ''}
                          </div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <span
                            onClick={() => {
                              const p = new URLSearchParams()
                              if (country) p.set('country', country)
                              p.set('driver', r.id)
                              p.set('ship', 'open')
                              navigate(`/user/orders?${p.toString()}`)
                            }}
                            title="View open orders (non-final statuses)"
                            style={{ cursor: 'pointer', color: '#f59e0b', fontWeight: 600 }}
                          >
                            {num(r.openCount)}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <span
                            onClick={() => {
                              const p = new URLSearchParams()
                              if (country) p.set('country', country)
                              p.set('driver', r.id)
                              p.set('ship', 'assigned')
                              navigate(`/user/orders?${p.toString()}`)
                            }}
                            title="View assigned orders"
                            style={{ cursor: 'pointer', color: '#6366f1', fontWeight: 600 }}
                          >
                            {num(r.assignedCount)}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <span
                            onClick={() => goDelivered(r.id)}
                            title="View delivered orders"
                            style={{ cursor: 'pointer', color: '#3b82f6', fontWeight: 600 }}
                          >
                            {num(r.deliveredCount)}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <span
                            onClick={() => goDeliveredCollected(r.id)}
                            title="View delivered orders with collected payments"
                            style={{ cursor: 'pointer', color: '#22c55e', fontWeight: 600 }}
                          >
                            {num(r.collectedSum)}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <span
                            onClick={() => {
                              setDetailModalFor('')
                              setRemitModalFor(r.id)
                            }}
                            title="View remittances"
                            style={{ cursor: 'pointer', color: '#22c55e', fontWeight: 600 }}
                          >
                            {num(r.remittedSum)}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <span
                            onClick={() => {
                              setDetailModalFor('')
                              setRemitModalFor(r.id)
                            }}
                            title="View pending remittances"
                            style={{ cursor: 'pointer', color: '#ef4444', fontWeight: 600 }}
                          >
                            {num(r.variance)}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              gap: 8,
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              flexWrap: 'wrap',
                            }}
                          >
                            <button
                              className="btn"
                              style={{ fontSize: 13, padding: '6px 12px' }}
                              onClick={() => {
                                setRemitModalFor('')
                                setDetailModalFor(r.id)
                              }}
                            >
                              Details
                            </button>
                            <button
                              className="btn secondary"
                              style={{ fontSize: 13, padding: '6px 12px' }}
                              onClick={() => {
                                setDetailModalFor('')
                                setRemitModalFor(r.id)
                              }}
                            >
                              History
                            </button>
                            {(() => {
                              const pending = latestPendingRemitForDriver(r.id)
                              if (!pending) return null
                              const status = String(pending?.status || '').toLowerCase()
                              const isManagerAccepted = status === 'manager_accepted'
                              return (
                                <>
                                  <button
                                    className="btn"
                                    style={{
                                      fontSize: 13,
                                      padding: '6px 12px',
                                      background: isManagerAccepted ? '#10b981' : undefined,
                                    }}
                                    onClick={() => setAcceptModal(pending)}
                                  >
                                    {isManagerAccepted ? '✓ Approve' : 'Pending'}
                                  </button>
                                  {pending.pdfPath && (
                                    <a
                                      href={pending.pdfPath}
                                      download
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn"
                                      style={{
                                        background: '#dc2626',
                                        color: 'white',
                                        padding: '6px 12px',
                                        fontSize: 13,
                                        textDecoration: 'none',
                                      }}
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
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--panel)' }}>
                  <td style={{ padding: '12px', fontWeight: 700 }}>Totals</td>
                  <td
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#f59e0b',
                    }}
                  >
                    <span
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const p = new URLSearchParams()
                        if (country) p.set('country', country)
                        p.set('ship', 'open')
                        navigate(`/user/orders?${p.toString()}`)
                      }}
                    >
                      {num(totals.openTotal)}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#6366f1',
                    }}
                  >
                    <span
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const p = new URLSearchParams()
                        if (country) p.set('country', country)
                        p.set('ship', 'assigned')
                        navigate(`/user/orders?${p.toString()}`)
                      }}
                    >
                      {num(totals.assignedTotal)}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#3b82f6',
                    }}
                  >
                    <span
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const p = new URLSearchParams()
                        if (country) p.set('country', country)
                        p.set('ship', 'delivered')
                        navigate(`/user/orders?${p.toString()}`)
                      }}
                    >
                      {num(totals.delivered)}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#22c55e',
                    }}
                  >
                    <span
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const p = new URLSearchParams()
                        if (country) p.set('country', country)
                        p.set('ship', 'delivered')
                        p.set('collected', 'true')
                        navigate(`/user/orders?${p.toString()}`)
                      }}
                    >
                      {num(totals.collected)}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#22c55e',
                    }}
                  >
                    {num(totals.remitted)}
                  </td>
                  <td
                    style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#ef4444',
                    }}
                  >
                    {num(totals.pending)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
          {isMobile && (
            <div style={{ display: 'grid', gap: 8 }}>
              {loading ? (
                <div className="helper">Loading…</div>
              ) : !country ? (
                <div className="helper">Select a country to view driver finances</div>
              ) : rows.length === 0 ? (
                <div className="helper">No drivers found</div>
              ) : (
                rows.map((r) => {
                  const barPct =
                    r.collectedSum > 0
                      ? Math.min(100, Math.max(0, (r.remittedSum / r.collectedSum) * 100))
                      : 0
                  return (
                    <div
                      key={r.id}
                      className="card"
                      style={{ display: 'grid', gap: 8, padding: 10 }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>{userName(r.driver)}</div>
                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                          }}
                        >
                          {(() => {
                            const pending = latestPendingRemitForDriver(r.id)
                            if (!pending) return null
                            const status = String(pending?.status || '').toLowerCase()
                            const isManagerAccepted = status === 'manager_accepted'
                            return (
                              <>
                                {isManagerAccepted && (
                                  <span
                                    style={{
                                      padding: '4px 8px',
                                      background:
                                        'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                      color: '#fff',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={
                                      `Accepted by ${pending?.managerAcceptedBy?.firstName || ''} ${pending?.managerAcceptedBy?.lastName || ''}`.trim() ||
                                      'Manager'
                                    }
                                  >
                                    ✓ By{' '}
                                    {pending?.managerAcceptedBy?.firstName ||
                                    pending?.managerAcceptedBy?.lastName
                                      ? `${pending?.managerAcceptedBy?.firstName || ''} ${pending?.managerAcceptedBy?.lastName || ''}`.trim()
                                      : 'Manager'}
                                  </span>
                                )}
                                <button
                                  className="btn small"
                                  onClick={() => setAcceptModal(pending)}
                                >
                                  {isManagerAccepted ? 'Approve' : 'Accept'}
                                </button>
                                {pending.pdfPath && (
                                  <a
                                    href={pending.pdfPath}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn small"
                                    style={{
                                      background: '#dc2626',
                                      color: 'white',
                                      textDecoration: 'none',
                                    }}
                                    title="Download Settlement PDF"
                                  >
                                    📄 PDF
                                  </a>
                                )}
                              </>
                            )
                          })()}
                          <button className="btn secondary" onClick={() => setDetailModalFor(r.id)}>
                            Details
                          </button>
                        </div>
                      </div>
                      <div
                        style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}
                      >
                        <span
                          onClick={() => {
                            const p = new URLSearchParams()
                            if (country) p.set('country', country)
                            p.set('driver', r.id)
                            p.set('ship', 'open')
                            navigate(`/user/orders?${p.toString()}`)
                          }}
                          style={{ color: '#f59e0b', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Open: {num(r.openAssigned)}
                        </span>
                        <span
                          onClick={() => goAllOrders(r.id)}
                          style={{ color: '#6366f1', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Assigned: {num(r.totalAssigned)}
                        </span>
                        <span
                          onClick={() => goDelivered(r.id)}
                          style={{ color: '#3b82f6', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Delivered: {num(r.deliveredCount)}
                        </span>
                        <span
                          onClick={() => goDeliveredCollected(r.id)}
                          style={{ color: '#22c55e', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Collected: {num(r.collectedSum)}
                        </span>
                      </div>
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span
                            onClick={() => setRemitModalFor(r.id)}
                            style={{ color: '#22c55e', fontWeight: 800, cursor: 'pointer' }}
                          >
                            Remitted: {num(r.remittedSum)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      {remitModalFor && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Driver Remittances</div>
              <button className="btn light" onClick={() => setRemitModalFor('')}>
                Close
              </button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 8 }}>
              {filteredRemitsForDriver.length === 0 ? (
                <div className="helper">No remittances in selected date range.</div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div className="helper">
                      Showing{' '}
                      {Math.min((remitPage - 1) * remitPerPage + 1, filteredRemitsForDriver.length)}{' '}
                      - {Math.min(remitPage * remitPerPage, filteredRemitsForDriver.length)} of{' '}
                      {filteredRemitsForDriver.length} remittances
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        className="btn secondary"
                        onClick={() => setRemitPage((p) => Math.max(1, p - 1))}
                        disabled={remitPage === 1}
                        style={{ fontSize: 13, padding: '6px 12px' }}
                      >
                        ← Prev
                      </button>
                      <span style={{ fontSize: 13 }}>
                        Page {remitPage} of{' '}
                        {Math.ceil(filteredRemitsForDriver.length / remitPerPage)}
                      </span>
                      <button
                        className="btn secondary"
                        onClick={() =>
                          setRemitPage((p) =>
                            Math.min(
                              Math.ceil(filteredRemitsForDriver.length / remitPerPage),
                              p + 1
                            )
                          )
                        }
                        disabled={
                          remitPage >= Math.ceil(filteredRemitsForDriver.length / remitPerPage)
                        }
                        style={{ fontSize: 13, padding: '6px 12px' }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr
                          style={{
                            borderBottom: '2px solid var(--border)',
                            background: 'var(--panel)',
                          }}
                        >
                          <th
                            style={{
                              padding: '12px',
                              textAlign: 'left',
                              fontWeight: 600,
                              fontSize: 12,
                              textTransform: 'uppercase',
                              color: 'var(--muted)',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Amount
                          </th>
                          <th
                            style={{
                              padding: '12px',
                              textAlign: 'left',
                              fontWeight: 600,
                              fontSize: 12,
                              textTransform: 'uppercase',
                              color: 'var(--muted)',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Status
                          </th>
                          <th
                            style={{
                              padding: '12px',
                              textAlign: 'left',
                              fontWeight: 600,
                              fontSize: 12,
                              textTransform: 'uppercase',
                              color: 'var(--muted)',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Method
                          </th>
                          <th
                            style={{
                              padding: '12px',
                              textAlign: 'left',
                              fontWeight: 600,
                              fontSize: 12,
                              textTransform: 'uppercase',
                              color: 'var(--muted)',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Manager
                          </th>
                          <th
                            style={{
                              padding: '12px',
                              textAlign: 'left',
                              fontWeight: 600,
                              fontSize: 12,
                              textTransform: 'uppercase',
                              color: 'var(--muted)',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Accepted
                          </th>
                          <th
                            style={{
                              padding: '12px',
                              textAlign: 'left',
                              fontWeight: 600,
                              fontSize: 12,
                              textTransform: 'uppercase',
                              color: 'var(--muted)',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Created
                          </th>
                          <th
                            style={{
                              padding: '12px',
                              textAlign: 'left',
                              fontWeight: 600,
                              fontSize: 12,
                              textTransform: 'uppercase',
                              color: 'var(--muted)',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Receipt
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRemitsForDriver
                          .slice((remitPage - 1) * remitPerPage, remitPage * remitPerPage)
                          .map((r, i) => (
                            <tr
                              key={String(r._id || i)}
                              style={{ borderTop: '1px solid var(--border)' }}
                            >
                              <td style={{ padding: '12px', fontWeight: 600, color: '#22c55e' }}>
                                {num(r.amount)} {r.currency || ''}
                              </td>
                              <td style={{ padding: '12px' }}>
                                <span className="badge" style={{ fontSize: 11 }}>
                                  {String(r.status || '').toUpperCase()}
                                </span>
                              </td>
                              <td style={{ padding: '12px' }}>
                                {String(r.method || 'hand').toLowerCase() === 'transfer'
                                  ? 'Transfer'
                                  : 'Hand'}
                              </td>
                              <td style={{ padding: '12px' }}>
                                {r?.manager
                                  ? (
                                      (r.manager.firstName || '') +
                                      ' ' +
                                      (r.manager.lastName || '')
                                    ).trim() ||
                                    r.manager.email ||
                                    '-'
                                  : '-'}
                              </td>
                              <td style={{ padding: '12px' }}>
                                {r.acceptedAt ? new Date(r.acceptedAt).toLocaleString() : '—'}
                              </td>
                              <td style={{ padding: '12px' }}>
                                {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                              </td>
                              <td style={{ padding: '12px' }}>
                                {r.pdfPath || r.acceptedPdfPath ? (
                                  <button
                                    className="btn"
                                    style={{ fontSize: 13, padding: '6px 12px' }}
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(
                                          `${API_BASE}/finance/remittances/${r._id}/download-settlement`,
                                          {
                                            headers: {
                                              Authorization: `Bearer ${localStorage.getItem('token')}`,
                                            },
                                          }
                                        )
                                        if (!response.ok) throw new Error('Download failed')
                                        const blob = await response.blob()
                                        const url = window.URL.createObjectURL(blob)
                                        const a = document.createElement('a')
                                        a.href = url
                                        a.download = `Settlement_${r.driver?.firstName || 'Driver'}_${new Date(r.createdAt).toLocaleDateString().replace(/\//g, '-')}.pdf`
                                        document.body.appendChild(a)
                                        a.click()
                                        window.URL.revokeObjectURL(url)
                                        document.body.removeChild(a)
                                      } catch (err) {
                                        alert('Failed to download PDF')
                                      }
                                    }}
                                  >
                                    Download
                                  </button>
                                ) : (
                                  '—'
                                )}
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

      {detailModalFor &&
        (() => {
          const r = rows.find((x) => String(x.id) === String(detailModalFor))
          if (!r) return null
          const actionsStyle = { display: 'flex', gap: 8, flexWrap: 'wrap' }
          const btnStyle = { padding: '6px 10px' }
          const hist = driverRemits.filter(
            (x) => String(x?.driver?._id || x?.driver || '') === String(r.id)
          )
          return (
            <div className="modal-backdrop">
              <div className="modal">
                <div className="modal-header">
                  <div className="modal-title">Driver Details</div>
                  <button className="btn light" onClick={() => setDetailModalFor('')}>
                    Close
                  </button>
                </div>
                <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: 8,
                    }}
                  >
                    <div className="card" style={{ padding: 10 }}>
                      <div className="label">Driver</div>
                      <div style={{ fontWeight: 800 }}>{userName(r.driver)}</div>
                      <div className="helper">{r.driver.email || ''}</div>
                    </div>
                    <div className="card" style={{ padding: 10 }}>
                      <div className="label">Assigned (Open)</div>
                      <div style={{ fontWeight: 800, color: '#f59e0b' }}>{num(r.openAssigned)}</div>
                    </div>
                    <div className="card" style={{ padding: 10 }}>
                      <div className="label">Total Assigned</div>
                      <div style={{ fontWeight: 800 }}>{num(r.totalAssigned)}</div>
                    </div>
                    <div className="card" style={{ padding: 10 }}>
                      <div className="label">Delivered</div>
                      <div style={{ fontWeight: 800 }}>{num(r.deliveredCount)}</div>
                    </div>
                    <div className="card" style={{ padding: 10 }}>
                      <div className="label">Returned</div>
                      <div style={{ fontWeight: 800, color: 'var(--danger)' }}>
                        {num(r.returned)}
                      </div>
                    </div>
                    <div className="card" style={{ padding: 10 }}>
                      <div className="label">Cancelled</div>
                      <div style={{ fontWeight: 800, color: 'var(--danger)' }}>
                        {num(r.cancelled)}
                      </div>
                    </div>
                    <div className="card" style={{ padding: 10 }}>
                      <div className="label">Collected ({ccy})</div>
                      <div style={{ fontWeight: 800, color: '#22c55e' }}>{num(r.collectedSum)}</div>
                    </div>
                    <div className="card" style={{ padding: 10 }}>
                      <div className="label">Remitted ({ccy})</div>
                      <div style={{ fontWeight: 800, color: '#22c55e' }}>{num(r.remittedSum)}</div>
                    </div>
                    <div className="card" style={{ padding: 10 }}>
                      <div className="label">Pending ({ccy})</div>
                      <div style={{ fontWeight: 800, color: 'var(--danger)' }}>
                        {num(r.variance)}
                      </div>
                    </div>
                  </div>
                  <div style={actionsStyle}>
                    <button
                      className="btn"
                      style={btnStyle}
                      onClick={() => {
                        const p = new URLSearchParams()
                        if (country) p.set('country', country)
                        p.set('driver', r.id)
                        p.set('ship', 'open')
                        navigate(`/user/orders?${p.toString()}`)
                      }}
                    >
                      Open Assigned
                    </button>
                    <button className="btn" style={btnStyle} onClick={() => goAllOrders(r.id)}>
                      All Assigned
                    </button>
                    <button className="btn" style={btnStyle} onClick={() => goDelivered(r.id)}>
                      Delivered
                    </button>
                    <button
                      className="btn"
                      style={btnStyle}
                      onClick={() => goDeliveredCollected(r.id)}
                    >
                      Collected
                    </button>
                    <button
                      className="btn"
                      style={btnStyle}
                      onClick={() => {
                        const p = new URLSearchParams()
                        if (country) p.set('country', country)
                        p.set('driver', r.id)
                        p.set('ship', 'returned')
                        navigate(`/user/orders?${p.toString()}`)
                      }}
                    >
                      Returned
                    </button>
                    <button
                      className="btn"
                      style={btnStyle}
                      onClick={() => {
                        const p = new URLSearchParams()
                        if (country) p.set('country', country)
                        p.set('driver', r.id)
                        p.set('ship', 'cancelled')
                        navigate(`/user/orders?${p.toString()}`)
                      }}
                    >
                      Cancelled
                    </button>
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
          onClose={() => setPayModal(false)}
          footer={
            <>
              <button
                className="btn secondary"
                onClick={() => setPayModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button className="btn success" disabled={submitting} onClick={payToCompany}>
                Confirm & Send
              </button>
            </>
          }
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="helper">Send collected driver funds to company</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))',
                gap: 10,
              }}
            >
              <div>
                <label className="input-label">Amount ({managerSummary.currency})</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={payForm.amount}
                  onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="input-label">Method</label>
                <select
                  className="input"
                  value={payForm.method}
                  onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}
                >
                  <option value="hand">Hand</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
            </div>
            {payForm.method === 'transfer' && (
              <div>
                <label className="input-label">Upload Proof (image)</label>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setPayForm((f) => ({
                      ...f,
                      file: (e.target.files && e.target.files[0]) || null,
                    }))
                  }
                />
              </div>
            )}
            <div>
              <label className="input-label">Note (optional)</label>
              <textarea
                className="input"
                rows={2}
                value={payForm.note}
                onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="panel" style={{ padding: 10, borderRadius: 10 }}>
      <div className="helper" style={{ fontSize: 12 }}>
        {label}
      </div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  )
}

// old helpers removed with ledger
