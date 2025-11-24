import React, { useState, useEffect } from 'react'
import { apiGet, apiPost } from '../../api.js'

export default function LabelSettings() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [labelDesign, setLabelDesign] = useState(1)

  useEffect(() => {
    loadLabelDesign()
  }, [])

  async function loadLabelDesign() {
    try {
      const data = await apiGet('/api/settings/label-design')
      setLabelDesign(data.designId || 1)
    } catch (err) {
      console.error('Failed to load label design:', err)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      await apiPost('/api/settings/label-design', {
        designId: labelDesign,
      })

      setMessage('Label design updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to update label design')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="section">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Label Settings</h1>
          <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
            Customize your print label design
          </p>
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: '16px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            color: '#10b981',
            marginBottom: '24px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          ✓ {message}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            color: '#ef4444',
            marginBottom: '24px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          ✗ {error}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid var(--border)',
            background:
              'linear-gradient(135deg, rgba(251, 146, 60, 0.05), rgba(249, 115, 22, 0.05))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
                Print Label Design
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
                Choose from 5 ultra-premium label designs
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gap: '20px' }}>
            <div className="field">
              <label className="label">Select Label Design</label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '12px',
                  marginTop: '12px',
                }}
              >
                {[1, 2, 3, 4, 5].map((id) => (
                  <div
                    key={id}
                    onClick={() => setLabelDesign(id)}
                    style={{
                      padding: '20px',
                      border: labelDesign === id ? '2px solid #f97316' : '2px solid var(--border)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      background: labelDesign === id ? 'rgba(251, 146, 60, 0.1)' : 'var(--panel)',
                      transition: 'all 0.2s',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        marginBottom: '8px',
                        color: labelDesign === id ? '#f97316' : 'var(--text)',
                      }}
                    >
                      {id}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--muted)',
                        fontWeight: 500,
                      }}
                    >
                      {id === 1 && 'Minimalist'}
                      {id === 2 && 'Geometric'}
                      {id === 3 && 'Elegant'}
                      {id === 4 && 'Industrial'}
                      {id === 5 && 'Rounded'}
                    </div>
                    {labelDesign === id && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: '#f97316',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '12px',
                        }}
                      >
                        ✓
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                padding: '16px',
                background: 'rgba(251, 146, 60, 0.05)',
                border: '1px solid rgba(251, 146, 60, 0.2)',
                borderRadius: '10px',
                fontSize: '13px',
                lineHeight: '1.6',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
                🎨 Design Styles
              </div>
              <ul style={{ color: 'var(--muted)', paddingLeft: '20px', margin: 0 }}>
                <li>
                  <strong>Minimalist:</strong> Clean, bold, high contrast design
                </li>
                <li>
                  <strong>Geometric:</strong> Sharp lines and distinct sections
                </li>
                <li>
                  <strong>Elegant:</strong> Serif fonts with double borders
                </li>
                <li>
                  <strong>Industrial:</strong> Thick borders and large data points
                </li>
                <li>
                  <strong>Rounded:</strong> Soft corners and spacious layout
                </li>
              </ul>
            </div>

            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Saving...' : 'Save Label Design'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
