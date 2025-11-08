import React, { useState } from 'react'

export default function PageManager() {
  const [toast, setToast] = useState(null)

  const pages = [
    { id: 1, name: 'Home Page', url: '/', status: 'Published', lastModified: '2024-11-05' },
    { id: 2, name: 'Products', url: '/catalog', status: 'Published', lastModified: '2024-11-06' },
    { id: 3, name: 'About Us', url: '/about', status: 'Published', lastModified: '2024-10-15' },
    { id: 4, name: 'Contact', url: '/contact', status: 'Published', lastModified: '2024-10-10' }
  ]

  function showToast(message) {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700 }}>📄 Page Manager</h1>
          <button
            onClick={() => showToast('✓ New page feature coming soon!')}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            + New Page
          </button>
        </div>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Create and manage website pages</p>
      </div>

      {/* Pages List */}
      <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>PAGE NAME</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>URL</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>STATUS</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>LAST MODIFIED</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {pages.map(page => (
              <tr key={page.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '16px', fontSize: '14px', fontWeight: 600 }}>{page.name}</td>
                <td style={{ padding: '16px', fontSize: '14px', color: '#6b7280' }}>{page.url}</td>
                <td style={{ padding: '16px' }}>
                  <span style={{
                    padding: '4px 12px',
                    background: '#d1fae5',
                    color: '#065f46',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    {page.status}
                  </span>
                </td>
                <td style={{ padding: '16px', fontSize: '14px', color: '#6b7280' }}>{page.lastModified}</td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button
                    onClick={() => showToast(`✏️ Editing ${page.name}...`)}
                    style={{
                      padding: '6px 12px',
                      background: 'white',
                      color: '#667eea',
                      border: '1px solid #667eea',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => showToast(`⚙️ ${page.name} settings`)}
                    style={{
                      padding: '6px 12px',
                      background: 'white',
                      color: '#6b7280',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Settings
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div style={{ marginTop: '24px', padding: '16px', background: '#eff6ff', border: '2px solid #dbeafe', borderRadius: '12px' }}>
        <p style={{ fontSize: '14px', color: '#1e40af', margin: 0 }}>
          💡 <strong>Tip:</strong> Page editing functionality will be integrated with the Live Editor for a seamless experience.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          padding: '12px 20px',
          background: '#10b981',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          fontSize: '14px',
          fontWeight: 500,
          zIndex: 1000
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
