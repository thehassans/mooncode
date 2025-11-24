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
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px',
                  marginTop: '16px',
                }}
              >
                {/* Design 1: Minimalist */}
                <div
                  onClick={() => setLabelDesign(1)}
                  style={{
                    border: labelDesign === 1 ? '3px solid #f97316' : '2px solid var(--border)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: labelDesign === 1 ? 'rgba(251, 146, 60, 0.05)' : 'var(--panel)',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {labelDesign === 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: '#f97316',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        zIndex: 10,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}
                    >
                      ✓
                    </div>
                  )}

                  {/* Mini Label Preview */}
                  <div
                    style={{
                      padding: '16px',
                      background: '#fff',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '7px',
                      lineHeight: 1.2,
                      color: '#000',
                    }}
                  >
                    <div
                      style={{
                        borderBottom: '1.5px solid #000',
                        paddingBottom: '6px',
                        marginBottom: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '9px' }}>LOGO</div>
                      <div
                        style={{
                          background: '#000',
                          color: '#fff',
                          padding: '2px 6px',
                          fontSize: '7px',
                          fontWeight: 800,
                        }}
                      >
                        COD
                      </div>
                    </div>
                    <div style={{ border: '1px solid #000', padding: '6px', marginBottom: '4px' }}>
                      <div
                        style={{
                          fontSize: '6px',
                          textTransform: 'uppercase',
                          color: '#555',
                          marginBottom: '2px',
                        }}
                      >
                        Customer
                      </div>
                      <div style={{ fontWeight: 700 }}>John Doe</div>
                    </div>
                    <div style={{ border: '1px solid #000', padding: '6px', marginBottom: '4px' }}>
                      <table style={{ width: '100%', fontSize: '6px', borderCollapse: 'collapse' }}>
                        <tr style={{ borderBottom: '1px solid #000' }}>
                          <th style={{ textAlign: 'left', fontWeight: 800, padding: '2px 0' }}>
                            ITEM
                          </th>
                          <th style={{ textAlign: 'right', fontWeight: 800, padding: '2px 0' }}>
                            PRICE
                          </th>
                        </tr>
                        <tr>
                          <td style={{ padding: '2px 0' }}>Product Name</td>
                          <td style={{ textAlign: 'right', padding: '2px 0' }}>$99.99</td>
                        </tr>
                      </table>
                    </div>
                    <div
                      style={{
                        background: '#000',
                        color: '#fff',
                        padding: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '7px',
                        fontWeight: 800,
                      }}
                    >
                      <span>TOTAL</span>
                      <span>$99.99</span>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '12px 16px',
                      borderTop: '1px solid var(--border)',
                      background: 'var(--panel)',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                      1. Minimalist
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Clean, bold, high contrast
                    </div>
                  </div>
                </div>

                {/* Design 2: Geometric */}
                <div
                  onClick={() => setLabelDesign(2)}
                  style={{
                    border: labelDesign === 2 ? '3px solid #f97316' : '2px solid var(--border)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: labelDesign === 2 ? 'rgba(251, 146, 60, 0.05)' : 'var(--panel)',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {labelDesign === 2 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: '#f97316',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        zIndex: 10,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}
                    >
                      ✓
                    </div>
                  )}

                  <div
                    style={{
                      padding: '16px',
                      background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '7px',
                      lineHeight: 1.2,
                      color: '#000',
                    }}
                  >
                    <div
                      style={{
                        background: '#6366f1',
                        color: '#fff',
                        padding: '6px',
                        marginBottom: '6px',
                        clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '9px' }}>LOGO</div>
                      <div
                        style={{
                          background: '#fff',
                          color: '#6366f1',
                          padding: '2px 6px',
                          fontSize: '7px',
                          fontWeight: 800,
                          clipPath:
                            'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)',
                        }}
                      >
                        COD
                      </div>
                    </div>
                    <div
                      style={{
                        border: '1.5px solid #6366f1',
                        padding: '6px',
                        marginBottom: '4px',
                        clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%)',
                        background: '#fff',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '6px',
                          textTransform: 'uppercase',
                          color: '#6366f1',
                          marginBottom: '2px',
                          fontWeight: 700,
                        }}
                      >
                        Customer
                      </div>
                      <div style={{ fontWeight: 700 }}>John Doe</div>
                    </div>
                    <div
                      style={{
                        border: '1.5px solid #6366f1',
                        padding: '6px',
                        background: '#fff',
                        clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%)',
                      }}
                    >
                      <div
                        style={{
                          borderBottom: '1.5px solid #6366f1',
                          paddingBottom: '2px',
                          marginBottom: '3px',
                          fontSize: '6px',
                          fontWeight: 800,
                          color: '#6366f1',
                          textTransform: 'uppercase',
                        }}
                      >
                        ORDER DETAILS
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '6px',
                        }}
                      >
                        <span>Product</span>
                        <span style={{ fontWeight: 700 }}>$99.99</span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '12px 16px',
                      borderTop: '1px solid var(--border)',
                      background: 'var(--panel)',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                      2. Geometric
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Sharp lines, distinct sections
                    </div>
                  </div>
                </div>

                {/* Design 3: Elegant */}
                <div
                  onClick={() => setLabelDesign(3)}
                  style={{
                    border: labelDesign === 3 ? '3px solid #f97316' : '2px solid var(--border)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: labelDesign === 3 ? 'rgba(251, 146, 60, 0.05)' : 'var(--panel)',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {labelDesign === 3 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: '#f97316',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        zIndex: 10,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}
                    >
                      ✓
                    </div>
                  )}

                  <div
                    style={{
                      padding: '16px',
                      background: '#fefefe',
                      border: '2px double #1a1a1a',
                      fontFamily: 'Georgia, serif',
                      fontSize: '7px',
                      lineHeight: 1.3,
                      color: '#1a1a1a',
                    }}
                  >
                    <div
                      style={{
                        border: '1.5px double #1a1a1a',
                        padding: '6px',
                        marginBottom: '6px',
                        background: 'linear-gradient(to bottom, #fefefe, #f9f9f9)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '9px',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        LOGO
                      </div>
                      <div
                        style={{
                          background: '#1a1a1a',
                          color: '#fefefe',
                          padding: '2px 7px',
                          fontSize: '7px',
                          fontWeight: 700,
                          fontFamily: 'Inter, sans-serif',
                          letterSpacing: '0.5px',
                        }}
                      >
                        COD
                      </div>
                    </div>
                    <div
                      style={{
                        border: '1.5px double #1a1a1a',
                        padding: '6px',
                        marginBottom: '4px',
                        background: '#fcfcfc',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '6px',
                          textTransform: 'uppercase',
                          color: '#666',
                          marginBottom: '2px',
                          fontWeight: 600,
                          fontFamily: 'Inter, sans-serif',
                          letterSpacing: '0.8px',
                        }}
                      >
                        Customer
                      </div>
                      <div style={{ fontWeight: 600 }}>John Doe</div>
                    </div>
                    <div
                      style={{
                        border: '1.5px double #1a1a1a',
                        padding: '6px',
                        background: '#fcfcfc',
                      }}
                    >
                      <div
                        style={{
                          borderBottom: '1.5px solid #1a1a1a',
                          paddingBottom: '3px',
                          marginBottom: '3px',
                          fontSize: '7px',
                          fontWeight: 700,
                          fontFamily: 'Inter, sans-serif',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                        }}
                      >
                        Order Details
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '7px',
                        }}
                      >
                        <span>Product Name</span>
                        <span style={{ fontWeight: 600 }}>$99.99</span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '12px 16px',
                      borderTop: '1px solid var(--border)',
                      background: 'var(--panel)',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                      3. Elegant
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Serif fonts, double borders
                    </div>
                  </div>
                </div>

                {/* Design 4: Industrial */}
                <div
                  onClick={() => setLabelDesign(4)}
                  style={{
                    border: labelDesign === 4 ? '3px solid #f97316' : '2px solid var(--border)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: labelDesign === 4 ? 'rgba(251, 146, 60, 0.05)' : 'var(--panel)',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {labelDesign === 4 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: '#f97316',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        zIndex: 10,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}
                    >
                      ✓
                    </div>
                  )}

                  <div
                    style={{
                      padding: '14px',
                      background: '#f5f5f5',
                      border: '3px solid #000',
                      fontFamily: 'Arial Black, Arial, sans-serif',
                      fontSize: '7px',
                      lineHeight: 1.1,
                      color: '#000',
                    }}
                  >
                    <div
                      style={{
                        background: '#000',
                        color: '#ffd700',
                        padding: '6px',
                        marginBottom: '5px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 900, fontSize: '9px' }}>LOGO</div>
                      <div
                        style={{
                          background: '#ffd700',
                          color: '#000',
                          padding: '3px 7px',
                          fontSize: '8px',
                          fontWeight: 900,
                          border: '2px solid #000',
                        }}
                      >
                        COD
                      </div>
                    </div>
                    <div
                      style={{
                        border: '2.5px solid #000',
                        padding: '5px',
                        marginBottom: '4px',
                        background: '#fff',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '7px',
                          textTransform: 'uppercase',
                          color: '#000',
                          marginBottom: '2px',
                          fontWeight: 900,
                          background: '#ffd700',
                          padding: '1px 3px',
                          display: 'inline-block',
                        }}
                      >
                        Customer
                      </div>
                      <div style={{ fontWeight: 900, fontSize: '8px' }}>John Doe</div>
                    </div>
                    <div style={{ border: '2.5px solid #000', padding: '5px', background: '#fff' }}>
                      <div
                        style={{
                          background: '#000',
                          color: '#ffd700',
                          padding: '3px 5px',
                          marginBottom: '3px',
                          fontSize: '7px',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                        }}
                      >
                        Order Details
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '7px',
                          fontWeight: 700,
                        }}
                      >
                        <span>Product</span>
                        <span>$99.99</span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '12px 16px',
                      borderTop: '1px solid var(--border)',
                      background: 'var(--panel)',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                      4. Industrial
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Thick borders, large data
                    </div>
                  </div>
                </div>

                {/* Design 5: Rounded */}
                <div
                  onClick={() => setLabelDesign(5)}
                  style={{
                    border: labelDesign === 5 ? '3px solid #f97316' : '2px solid var(--border)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: labelDesign === 5 ? 'rgba(251, 146, 60, 0.05)' : 'var(--panel)',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {labelDesign === 5 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: '#f97316',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        zIndex: 10,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}
                    >
                      ✓
                    </div>
                  )}

                  <div
                    style={{
                      padding: '16px',
                      background: 'linear-gradient(135deg, #fef5e7 0%, #fff 100%)',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '7px',
                      lineHeight: 1.3,
                      color: '#2c3e50',
                    }}
                  >
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                        color: '#fff',
                        padding: '7px',
                        marginBottom: '6px',
                        borderRadius: '10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '9px' }}>LOGO</div>
                      <div
                        style={{
                          background: '#fff',
                          color: '#3498db',
                          padding: '2px 7px',
                          fontSize: '7px',
                          fontWeight: 700,
                          borderRadius: '12px',
                        }}
                      >
                        COD
                      </div>
                    </div>
                    <div
                      style={{
                        border: '1.5px solid #ecf0f1',
                        padding: '6px',
                        marginBottom: '5px',
                        borderRadius: '10px',
                        background: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '6px',
                          textTransform: 'uppercase',
                          color: '#95a5a6',
                          marginBottom: '2px',
                          fontWeight: 600,
                          letterSpacing: '0.5px',
                        }}
                      >
                        Customer
                      </div>
                      <div style={{ fontWeight: 600 }}>John Doe</div>
                    </div>
                    <div
                      style={{
                        border: '1.5px solid #ecf0f1',
                        padding: '6px',
                        borderRadius: '10px',
                        background: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #e67e22 0%, #d35400 100%)',
                          color: '#fff',
                          padding: '3px 6px',
                          borderRadius: '12px',
                          marginBottom: '3px',
                          fontSize: '6px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          display: 'inline-block',
                        }}
                      >
                        Order Details
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '6px',
                        }}
                      >
                        <span>Product Name</span>
                        <span style={{ fontWeight: 600 }}>$99.99</span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '12px 16px',
                      borderTop: '1px solid var(--border)',
                      background: 'var(--panel)',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                      5. Rounded
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Soft corners, spacious layout
                    </div>
                  </div>
                </div>
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
