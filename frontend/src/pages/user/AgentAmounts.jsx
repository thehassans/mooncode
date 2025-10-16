import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../../api'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../ui/Toast.jsx'
import Modal from '../../components/Modal.jsx'

export default function AgentAmounts(){
  const navigate = useNavigate()
  const toast = useToast()
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [payingAgent, setPayingAgent] = useState(null)
  const [payModal, setPayModal] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const r = await apiGet('/api/finance/agents/commission')
        if (alive) setAgents(Array.isArray(r?.agents) ? r.agents : [])
        setErr('')
      } catch (e) {
        if (alive) setErr(e?.message || 'Failed to load agent amounts')
      } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }

  const filteredAgents = useMemo(()=>{
    if (!searchTerm) return agents
    const term = searchTerm.toLowerCase()
    return agents.filter(a => 
      String(a.name||'').toLowerCase().includes(term) ||
      String(a.phone||'').toLowerCase().includes(term)
    )
  }, [agents, searchTerm])

  const totals = useMemo(()=>{
    let deliveredCommission = 0, upcomingCommission = 0, withdrawn = 0, pending = 0, ordersSubmitted = 0, totalOrderValueAED = 0
    for (const a of filteredAgents){
      deliveredCommission += Number(a.deliveredCommissionPKR||0)
      upcomingCommission += Number(a.upcomingCommissionPKR||0)
      withdrawn += Number(a.withdrawnPKR||0)
      pending += Number(a.pendingPKR||0)
      ordersSubmitted += Number(a.ordersSubmitted||0)
      totalOrderValueAED += Number(a.totalOrderValueAED||0)
    }
    return { deliveredCommission, upcomingCommission, withdrawn, pending, ordersSubmitted, totalOrderValueAED }
  }, [filteredAgents])

  return (
    <div className="section" style={{ display: 'grid', gap: 12 }}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-green">Agent Amounts</div>
          <div className="page-subtitle">Monitor agent earnings from submitted orders</div>
        </div>
      </div>
      {err && <div className="error">{err}</div>}

      {/* Search Filter */}
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="card-header"><div className="card-title">Search</div></div>
        <input 
          className="input" 
          type="text" 
          placeholder="Search by agent name or phone..." 
          value={searchTerm} 
          onChange={(e)=> setSearchTerm(e.target.value)} 
        />
      </div>

      {/* Summary Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:12 }}>
        <div className="card" style={{background:'linear-gradient(135deg, #10b981 0%, #059669 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Delivered Commission</div>
            <div style={{fontSize:28, fontWeight:800}}>PKR {num(totals.deliveredCommission)}</div>
            <div style={{fontSize:12, opacity:0.8, marginTop:4}}>From delivered orders</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Upcoming Commission</div>
            <div style={{fontSize:28, fontWeight:800}}>PKR {num(totals.upcomingCommission)}</div>
            <div style={{fontSize:12, opacity:0.8, marginTop:4}}>From pending orders</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Total Withdrawn</div>
            <div style={{fontSize:28, fontWeight:800}}>PKR {num(totals.withdrawn)}</div>
            <div style={{fontSize:12, opacity:0.8, marginTop:4}}>Already paid out</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Pending Requests</div>
            <div style={{fontSize:28, fontWeight:800}}>PKR {num(totals.pending)}</div>
            <div style={{fontSize:12, opacity:0.8, marginTop:4}}>Awaiting approval</div>
          </div>
        </div>
      </div>

      {/* Agents Table */}
      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontWeight: 700 }}>Agent Commission Summary</div>
          <div className="helper">{filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#8b5cf6' }}>Agent</th>
                <th style={{ padding: '10px 12px', textAlign:'center', borderRight:'1px solid var(--border)', color:'#6366f1' }}>Orders Submitted</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#06b6d4' }}>Total Value (AED)</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#10b981' }}>Delivered Comm.</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#3b82f6' }}>Upcoming Comm.</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#8b5cf6' }}>Withdrawn</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#f59e0b' }}>Pending</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#ef4444' }}>Balance</th>
                <th style={{ padding: '10px 12px', textAlign:'center', color:'#8b5cf6' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:5}).map((_,i)=> (
                  <tr key={`sk${i}`}>
                    <td colSpan={9} style={{ padding:'10px 12px' }}>
                      <div style={{ height:14, background:'var(--panel-2)', borderRadius:6, animation:'pulse 1.2s ease-in-out infinite' }} />
                    </td>
                  </tr>
                ))
              ) : filteredAgents.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '10px 12px', opacity: 0.7, textAlign:'center' }}>No agents found</td></tr>
              ) : (
                filteredAgents.map((a, idx) => {
                  const balance = Number(a.deliveredCommissionPKR||0) - Number(a.withdrawnPKR||0) - Number(a.pendingPKR||0)
                  return (
                    <tr key={String(a.id)} style={{ borderTop: '1px solid var(--border)', background: idx % 2 ? 'transparent' : 'var(--panel)' }}>
                      <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>
                        <div style={{fontWeight:700, color:'#8b5cf6'}}>{a.name || 'Unnamed'}</div>
                        <div className="helper">{a.phone || ''}</div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'center', borderRight:'1px solid var(--border)' }}>
                        <span style={{color:'#6366f1', fontWeight:700}}>{num(a.ordersSubmitted||0)}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                        <span style={{color:'#06b6d4', fontWeight:800}}>AED {num(a.totalOrderValueAED||0)}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                        <span style={{color:'#10b981', fontWeight:800}}>PKR {num(a.deliveredCommissionPKR)}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                        <span style={{color:'#3b82f6', fontWeight:800}}>PKR {num(a.upcomingCommissionPKR)}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                        <span style={{color:'#8b5cf6', fontWeight:800}}>PKR {num(a.withdrawnPKR)}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                        <span style={{color:'#f59e0b', fontWeight:800}}>PKR {num(a.pendingPKR)}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                        <span style={{color: balance < 0 ? '#ef4444' : '#10b981', fontWeight:800}}>PKR {num(balance)}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'center' }}>
                        {balance > 0 ? (
                          <button 
                            className="btn success" 
                            style={{fontSize:12, padding:'6px 12px'}}
                            disabled={payingAgent === a.id}
                            onClick={()=> setPayModal({ agent: a, balance })}
                          >
                            Pay Commission
                          </button>
                        ) : (
                          <span style={{color:'var(--text-muted)', fontSize:12}}>No balance</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Commission Modal */}
      <Modal
        title="Pay Agent Commission"
        open={!!payModal}
        onClose={()=> setPayModal(null)}
        footer={
          <>
            <button className="btn secondary" onClick={()=> setPayModal(null)} disabled={!!payingAgent}>Cancel</button>
            <button 
              className="btn success" 
              disabled={!!payingAgent}
              onClick={async()=>{
                setPayingAgent(payModal.agent.id)
                try{
                  await apiPost(`/api/finance/agents/${payModal.agent.id}/pay-commission`, { amount: payModal.balance })
                  toast.success('Commission payment sent successfully')
                  setPayModal(null)
                  // Refresh data
                  const r = await apiGet('/api/finance/agents/commission')
                  setAgents(Array.isArray(r?.agents) ? r.agents : [])
                }catch(e){
                  toast.error(e?.message || 'Failed to send payment')
                }finally{
                  setPayingAgent(null)
                }
              }}
            >
              {payingAgent ? 'Sending...' : 'Confirm Payment'}
            </button>
          </>
        }
      >
        {payModal && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ fontSize: 16, marginBottom: 24, textAlign: 'center' }}>
              Send <strong style={{ color: '#10b981', fontSize: 20 }}>PKR {num(payModal.balance)}</strong> commission to <strong style={{ color: '#8b5cf6' }}>{payModal.agent.name}</strong>?
            </div>
            <div style={{ background: 'var(--panel)', padding: 12, borderRadius: 8, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>Agent:</span>
                <strong>{payModal.agent.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>Phone:</span>
                <strong>{payModal.agent.phone}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ opacity: 0.7 }}>Amount:</span>
                <strong style={{ color: '#10b981' }}>PKR {num(payModal.balance)}</strong>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
