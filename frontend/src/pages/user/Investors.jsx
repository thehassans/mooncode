import React, { useEffect, useState } from 'react'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import { apiGet, apiPost, apiDelete } from '../../api'
import { io } from 'socket.io-client'
import Modal from '../../components/Modal.jsx'
import 'react-phone-number-input/style.css'

export default function Investors() {
  const [form, setForm] = useState({ 
    firstName: '', 
    lastName: '', 
    email: '', 
    password: '', 
    phone: '', 
    investmentAmount: '', 
    profitPercentage: '15', 
    currency: 'SAR' 
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [delModal, setDelModal] = useState({ open: false, busy: false, error: '', confirm: '', investor: null })
  const [editModal, setEditModal] = useState({ open: false, busy: false, error: '', investor: null })
  const [editForm, setEditForm] = useState({ 
    firstName: '', 
    lastName: '', 
    email: '', 
    phone: '', 
    investmentAmount: '', 
    profitPercentage: '15', 
    currency: 'SAR' 
  })

  const CURRENCIES = [
    { key: 'AED', label: 'AED (UAE Dirham)' },
    { key: 'SAR', label: 'SAR (Saudi Riyal)' },
    { key: 'OMR', label: 'Omani Rial)' },
    { key: 'BHD', label: 'BHD (Bahraini Dinar)' },
    { key: 'INR', label: 'INR (Indian Rupee)' },
    { key: 'KWD', label: 'KWD (Kuwaiti Dinar)' },
    { key: 'QAR', label: 'QAR (Qatari Riyal)' },
    { key: 'USD', label: 'USD (US Dollar)' },
    { key: 'CNY', label: 'CNY (Chinese Yuan)' },
  ]

  useEffect(() => {
    loadInvestors()
    const token = localStorage.getItem('token') || ''
    const socket = io(undefined, { path: '/socket.io', transports: ['polling'], upgrade: false, auth: { token }, withCredentials: true })
    socket.on('investor.created', loadInvestors)
    socket.on('investor.updated', loadInvestors)
    socket.on('investor.deleted', loadInvestors)
    return () => {
      socket.off('investor.created')
      socket.off('investor.updated')
      socket.off('investor.deleted')
      socket.disconnect()
    }
  }, [])

  async function loadInvestors() {
    setLoadingList(true)
    try {
      const data = await apiGet(`/api/users/investors?q=${encodeURIComponent(q)}`)
      setRows(data.users || [])
    } catch (err) {
      console.error('Failed to load investors:', err)
    } finally {
      setLoadingList(false)
    }
  }

  function onChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  function onEditFormChange(e) {
    const { name, value } = e.target
    setEditForm(f => ({ ...f, [name]: value }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      setMsg('Please fill in all required fields')
      return
    }

    if (form.phone && !isValidPhoneNumber(form.phone)) {
      setPhoneError('Invalid phone number')
      return
    }

    setLoading(true)
    setMsg('')
    setPhoneError('')

    try {
      await apiPost('/api/users/investors', {
        ...form,
        investmentAmount: Number(form.investmentAmount || 0),
        profitPercentage: Number(form.profitPercentage || 15)
      })
      setMsg('Investor created successfully!')
      setForm({ 
        firstName: '', 
        lastName: '', 
        email: '', 
        password: '', 
        phone: '', 
        investmentAmount: '', 
        profitPercentage: '15', 
        currency: 'SAR' 
      })
      loadInvestors()
    } catch (err) {
      setMsg(err?.message || 'Failed to create investor')
    } finally {
      setLoading(false)
    }
  }

  function openEditModal(investor) {
    setEditForm({
      firstName: investor.firstName || '',
      lastName: investor.lastName || '',
      email: investor.email || '',
      phone: investor.phone || '',
      investmentAmount: String(investor.investorProfile?.investmentAmount || ''),
      profitPercentage: String(investor.investorProfile?.profitPercentage || '15'),
      currency: investor.investorProfile?.currency || 'SAR'
    })
    setEditModal({ open: true, busy: false, error: '', investor })
  }

  async function handleEdit(e) {
    e.preventDefault()
    if (!editForm.firstName || !editForm.lastName || !editForm.email) {
      setEditModal(m => ({ ...m, error: 'Please fill in all required fields' }))
      return
    }

    setEditModal(m => ({ ...m, busy: true, error: '' }))

    try {
      await apiPost(`/api/users/investors/${editModal.investor._id}`, {
        ...editForm,
        investmentAmount: Number(editForm.investmentAmount || 0),
        profitPercentage: Number(editForm.profitPercentage || 15)
      })
      setEditModal({ open: false, busy: false, error: '', investor: null })
      loadInvestors()
    } catch (err) {
      setEditModal(m => ({ ...m, busy: false, error: err?.message || 'Failed to update investor' }))
    }
  }

  function openDelModal(investor) {
    setDelModal({ open: true, busy: false, error: '', confirm: '', investor })
  }

  async function handleDelete() {
    if (delModal.confirm !== 'DELETE') {
      setDelModal(m => ({ ...m, error: 'Please type DELETE to confirm' }))
      return
    }

    setDelModal(m => ({ ...m, busy: true, error: '' }))

    try {
      await apiDelete(`/api/users/investors/${delModal.investor._id}`)
      setDelModal({ open: false, busy: false, error: '', confirm: '', investor: null })
      loadInvestors()
    } catch (err) {
      setDelModal(m => ({ ...m, busy: false, error: err?.message || 'Failed to delete investor' }))
    }
  }

  function calculateTargetProfit(amount, percentage) {
    return (Number(amount || 0) * Number(percentage || 15)) / 100
  }

  function calculateTotalReturn(amount, percentage) {
    return Number(amount || 0) + calculateTargetProfit(amount, percentage)
  }

  const filteredRows = rows.filter(r =>
    `${r.firstName} ${r.lastName} ${r.email}`.toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="section" style={{ display: 'grid', gap: 24 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Investors</div>
          <div className="page-subtitle">Manage investors and track sequential profit distribution</div>
        </div>
      </div>

      {/* Create Investor Form */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Create New Investor</div>
        </div>
        <form onSubmit={handleCreate} style={{ display: 'grid', gap: 20, padding: 24 }}>
          {msg && (
            <div style={{ padding: 12, borderRadius: 8, background: msg.includes('success') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: msg.includes('success') ? '#10b981' : '#ef4444' }}>
              {msg}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div className="label">First Name *</div>
              <input className="input" type="text" name="firstName" value={form.firstName} onChange={onChange} required />
            </div>
            <div>
              <div className="label">Last Name *</div>
              <input className="input" type="text" name="lastName" value={form.lastName} onChange={onChange} required />
            </div>
          </div>

          <div>
            <div className="label">Email *</div>
            <input className="input" type="email" name="email" value={form.email} onChange={onChange} required />
          </div>

          <div>
            <div className="label">Password *</div>
            <input className="input" type="password" name="password" value={form.password} onChange={onChange} required minLength={6} />
          </div>

          <div>
            <div className="label">Phone</div>
            <PhoneInput international defaultCountry="SA" value={form.phone} onChange={val => setForm(f => ({ ...f, phone: val || '' }))} />
            {phoneError && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 4 }}>{phoneError}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <div className="label">Investment Amount *</div>
              <input className="input" type="number" min="0" step="0.01" name="investmentAmount" value={form.investmentAmount} onChange={onChange} placeholder="1000" required />
            </div>
            <div>
              <div className="label">Profit % per Order *</div>
              <input className="input" type="number" min="0" max="100" step="0.1" name="profitPercentage" value={form.profitPercentage} onChange={onChange} placeholder="15" required />
            </div>
            <div>
              <div className="label">Currency</div>
              <select className="input" name="currency" value={form.currency} onChange={onChange}>
                {CURRENCIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {form.investmentAmount && form.profitPercentage && (
            <div style={{ padding: 16, background: 'var(--panel)', borderRadius: 8 }}>
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>Investment Summary</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Investment Amount:</span>
                  <strong>{form.currency} {Number(form.investmentAmount).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Target Profit ({form.profitPercentage}%):</span>
                  <strong>{form.currency} {calculateTargetProfit(form.investmentAmount, form.profitPercentage).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 700 }}>Total Return:</span>
                  <strong style={{ color: '#10b981', fontSize: 18 }}>{form.currency} {calculateTotalReturn(form.investmentAmount, form.profitPercentage).toFixed(2)}</strong>
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Creating...' : 'Create Investor'}
          </button>
        </form>
      </div>

      {/* Investors List */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Investors List ({filteredRows.length})</div>
          <input
            className="input"
            type="text"
            placeholder="Search investors..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 300 }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 12, textAlign: 'left' }}>Name</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Email</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Investment</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Profit %</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Target Profit</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Earned</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Status</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', opacity: 0.7 }}>Loading...</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', opacity: 0.7 }}>No investors found</td></tr>
              ) : (
                filteredRows.map((inv) => (
                  <tr key={inv._id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 12 }}>{inv.firstName} {inv.lastName}</td>
                    <td style={{ padding: 12 }}>{inv.email}</td>
                    <td style={{ padding: 12 }}>{inv.investorProfile?.currency} {Number(inv.investorProfile?.investmentAmount || 0).toFixed(2)}</td>
                    <td style={{ padding: 12 }}>{inv.investorProfile?.profitPercentage || 15}%</td>
                    <td style={{ padding: 12 }}>{inv.investorProfile?.currency} {Number(inv.investorProfile?.targetProfit || 0).toFixed(2)}</td>
                    <td style={{ padding: 12 }}>{inv.investorProfile?.currency} {Number(inv.investorProfile?.earnedProfit || 0).toFixed(2)}</td>
                    <td style={{ padding: 12 }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        background: inv.investorProfile?.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: inv.investorProfile?.status === 'completed' ? '#10b981' : '#3b82f6'
                      }}>
                        {inv.investorProfile?.status || 'active'}
                      </span>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn secondary small" onClick={() => openEditModal(inv)}>Edit</button>
                        <button className="btn danger small" onClick={() => openDelModal(inv)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        title="Edit Investor"
        open={editModal.open}
        onClose={() => setEditModal({ open: false, busy: false, error: '', investor: null })}
        footer={
          <>
            <button className="btn secondary" onClick={() => setEditModal({ open: false, busy: false, error: '', investor: null })} disabled={editModal.busy}>Cancel</button>
            <button className="btn" onClick={handleEdit} disabled={editModal.busy}>{editModal.busy ? 'Saving...' : 'Save Changes'}</button>
          </>
        }
      >
        <form onSubmit={handleEdit} style={{ display: 'grid', gap: 16 }}>
          {editModal.error && (
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
              {editModal.error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div className="label">First Name *</div>
              <input className="input" type="text" name="firstName" value={editForm.firstName} onChange={onEditFormChange} required />
            </div>
            <div>
              <div className="label">Last Name *</div>
              <input className="input" type="text" name="lastName" value={editForm.lastName} onChange={onEditFormChange} required />
            </div>
          </div>

          <div>
            <div className="label">Email *</div>
            <input className="input" type="email" name="email" value={editForm.email} onChange={onEditFormChange} required />
          </div>

          <div>
            <div className="label">Phone</div>
            <PhoneInput international defaultCountry="SA" value={editForm.phone} onChange={val => setEditForm(f => ({ ...f, phone: val || '' }))} />
          </div>

          {editModal.investor?.investorProfile?.status !== 'completed' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <div className="label">Investment Amount</div>
                  <input className="input" type="number" min="0" step="0.01" name="investmentAmount" value={editForm.investmentAmount} onChange={onEditFormChange} />
                </div>
                <div>
                  <div className="label">Profit %</div>
                  <input className="input" type="number" min="0" max="100" step="0.1" name="profitPercentage" value={editForm.profitPercentage} onChange={onEditFormChange} />
                </div>
                <div>
                  <div className="label">Currency</div>
                  <select className="input" name="currency" value={editForm.currency} onChange={onEditFormChange}>
                    {CURRENCIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              {editForm.investmentAmount && (
                <div style={{ padding: 12, background: 'var(--panel)', borderRadius: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>New Target Profit:</span>
                    <strong>{editForm.currency} {calculateTargetProfit(editForm.investmentAmount, editForm.profitPercentage).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>New Total Return:</span>
                    <strong>{editForm.currency} {calculateTotalReturn(editForm.investmentAmount, editForm.profitPercentage).toFixed(2)}</strong>
                  </div>
                </div>
              )}
            </>
          )}
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        title="Delete Investor"
        open={delModal.open}
        onClose={() => setDelModal({ open: false, busy: false, error: '', confirm: '', investor: null })}
        footer={
          <>
            <button className="btn secondary" onClick={() => setDelModal({ open: false, busy: false, error: '', confirm: '', investor: null })} disabled={delModal.busy}>Cancel</button>
            <button className="btn danger" onClick={handleDelete} disabled={delModal.busy || delModal.confirm !== 'DELETE'}>
              {delModal.busy ? 'Deleting...' : 'Delete'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 16 }}>
          {delModal.error && (
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
              {delModal.error}
            </div>
          )}
          <p>Are you sure you want to delete investor <strong>{delModal.investor?.firstName} {delModal.investor?.lastName}</strong>?</p>
          <p style={{ fontSize: 13, opacity: 0.7 }}>Type <strong>DELETE</strong> to confirm:</p>
          <input
            className="input"
            type="text"
            value={delModal.confirm}
            onChange={(e) => setDelModal(m => ({ ...m, confirm: e.target.value }))}
            placeholder="Type DELETE"
          />
        </div>
      </Modal>
    </div>
  )
}
