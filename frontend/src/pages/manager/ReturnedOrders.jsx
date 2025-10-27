import React, { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../api'
import { useToast } from '../../ui/Toast.jsx'

export default function ManagerReturnedOrders(){
  const toast = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(null)

  async function loadOrders(){
    setLoading(true)
    try{
      const res = await apiGet('/api/orders?ship=cancelled,returned&limit=200')
      const allOrders = res?.orders || []
      // Filter only submitted returns that need verification
      const submitted = allOrders.filter(o => 
        o.returnSubmittedToCompany && 
        ['cancelled', 'returned'].includes(String(o.shipmentStatus || '').toLowerCase())
      )
      setOrders(submitted)
    }catch(e){
      toast.error(e?.message || 'Failed to load orders')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ loadOrders() },[])

  async function verifyReturn(orderId){
    setVerifying(orderId)
    try{
      // Save current scroll position
      const scrollY = window.scrollY
      
      await apiPost(`/api/orders/${orderId}/return/verify`, {})
      toast.success('Order verified successfully')
      
      // Update state locally instead of reloading to preserve scroll
      setOrders(prev => prev.map(o => 
        String(o._id) === String(orderId)
          ? { ...o, returnVerified: true, returnVerifiedAt: new Date().toISOString() }
          : o
      ))
      
      // Restore scroll position after state update
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY)
      })
    }catch(e){
      toast.error(e?.message || 'Failed to verify order')
    }finally{
      setVerifying(null)
    }
  }

  function formatDate(d){
    try{ return d ? new Date(d).toLocaleString() : '-' }catch{ return '-' }
  }

  const pendingOrders = orders.filter(o => !o.returnVerified)
  const verifiedOrders = orders.filter(o => o.returnVerified)

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-red">Returned & Cancelled Orders</div>
          <div className="page-subtitle">Verify orders submitted by drivers</div>
        </div>
      </div>

      {/* Pending Verification Section */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Pending Verification ({pendingOrders.length})</div>
        </div>
        <div style={{display:'grid', gap:10}}>
          {loading ? (
            <div className="section">Loading...</div>
          ) : pendingOrders.length === 0 ? (
            <div className="section helper">No orders pending verification</div>
          ) : (
            pendingOrders.map(order => {
              const isVerifying = verifying === String(order._id)
              const status = String(order.shipmentStatus || '').toLowerCase()
              
              return (
                <div key={order._id} className="panel" style={{display:'grid', gap:10, padding:16, border:'1px solid var(--border)', borderRadius:8}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                      <div style={{fontWeight:800, fontSize:16}}>
                        #{order.invoiceNumber || String(order._id).slice(-6)}
                      </div>
                      <div className="helper" style={{marginTop:4}}>
                        Status: <strong style={{color:'#ef4444', textTransform:'capitalize'}}>{status}</strong>
                      </div>
                    </div>
                    <div style={{display:'flex', gap:8, alignItems:'center'}}>
                      {order.orderCountry && <span className="badge">{order.orderCountry}</span>}
                      {order.city && <span className="chip">{order.city}</span>}
                    </div>
                  </div>

                  <div style={{display:'grid', gap:6}}>
                    <div className="helper">
                      <strong>Customer:</strong> {order.customerName || '-'} • {order.customerPhone || '-'}
                    </div>
                    <div className="helper">
                      <strong>Address:</strong> {order.customerAddress || order.customerLocation || '-'}
                    </div>
                    {order.returnReason && (
                      <div className="helper">
                        <strong>Reason:</strong> {order.returnReason}
                      </div>
                    )}
                    <div className="helper">
                      <strong>Submitted:</strong> {formatDate(order.returnSubmittedAt)}
                    </div>
                    <div className="helper">
                      <strong>Driver:</strong> {order.deliveryBoy?.firstName} {order.deliveryBoy?.lastName || '-'}
                    </div>
                  </div>

                  <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:8}}>
                    <button 
                      className="btn success"
                      onClick={() => verifyReturn(order._id)}
                      disabled={isVerifying}
                      style={{minWidth:150}}
                    >
                      {isVerifying ? 'Verifying...' : 'Accept & Verify'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Verified Orders Section */}
      {verifiedOrders.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Verified Orders ({verifiedOrders.length})</div>
          </div>
          <div style={{display:'grid', gap:10}}>
            {verifiedOrders.map(order => {
              const status = String(order.shipmentStatus || '').toLowerCase()
              
              return (
                <div key={order._id} className="panel" style={{display:'grid', gap:8, padding:16, border:'1px solid #10b981', borderRadius:8, background:'rgba(16, 185, 129, 0.05)'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                      <div style={{fontWeight:800, fontSize:16}}>
                        #{order.invoiceNumber || String(order._id).slice(-6)}
                      </div>
                      <div style={{color:'#10b981', fontWeight:700, marginTop:4}}>
                        ✅ {status.charAt(0).toUpperCase() + status.slice(1)} Order Verified
                      </div>
                    </div>
                    <div style={{display:'flex', gap:8, alignItems:'center'}}>
                      {order.orderCountry && <span className="badge">{order.orderCountry}</span>}
                      {order.city && <span className="chip">{order.city}</span>}
                    </div>
                  </div>

                  <div style={{display:'grid', gap:4}}>
                    <div className="helper">
                      <strong>Customer:</strong> {order.customerName || '-'}
                    </div>
                    <div className="helper">
                      <strong>Verified:</strong> {formatDate(order.returnVerifiedAt)}
                    </div>
                    <div className="helper">
                      <strong>Submitted:</strong> {formatDate(order.returnSubmittedAt)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
