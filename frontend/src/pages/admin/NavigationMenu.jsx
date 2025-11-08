import React, { useState } from 'react'

export default function NavigationMenu() {
  const [menuItems, setMenuItems] = useState([
    { id: 1, label: 'Home', url: '/', order: 1, visible: true },
    { id: 2, label: 'Products', url: '/catalog', order: 2, visible: true },
    { id: 3, label: 'Categories', url: '/categories', order: 3, visible: true },
    { id: 4, label: 'About', url: '/about', order: 4, visible: true },
    { id: 5, label: 'Contact', url: '/contact', order: 5, visible: true }
  ])
  const [toast, setToast] = useState(null)

  function toggleVisibility(id) {
    setMenuItems(prev => prev.map(item => 
      item.id === id ? { ...item, visible: !item.visible } : item
    ))
    showToast('✓ Menu updated')
  }

  function moveUp(id) {
    const index = menuItems.findIndex(item => item.id === id)
    if (index > 0) {
      const newItems = [...menuItems]
      const temp = newItems[index]
      newItems[index] = newItems[index - 1]
      newItems[index - 1] = temp
      setMenuItems(newItems)
      showToast('✓ Order updated')
    }
  }

  function moveDown(id) {
    const index = menuItems.findIndex(item => item.id === id)
    if (index < menuItems.length - 1) {
      const newItems = [...menuItems]
      const temp = newItems[index]
      newItems[index] = newItems[index + 1]
      newItems[index + 1] = temp
      setMenuItems(newItems)
      showToast('✓ Order updated')
    }
  }

  function showToast(message) {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700 }}>🧭 Navigation Menu</h1>
          <button
            onClick={() => showToast('✓ Add menu item feature coming soon!')}
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
            + Add Menu Item
          </button>
        </div>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Customize your website navigation menu</p>
      </div>

      {/* Menu Items */}
      <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
        <div style={{ marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>
            Main Navigation Menu
          </p>
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', margin: 0 }}>
            Drag to reorder • Toggle visibility • Click to edit
          </p>
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          {menuItems.map((item, index) => (
            <div key={item.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              background: item.visible ? 'white' : '#f9fafb',
              border: '2px solid',
              borderColor: item.visible ? '#667eea' : '#e5e7eb',
              borderRadius: '8px',
              opacity: item.visible ? 1 : 0.6
            }}>
              {/* Drag Handle */}
              <div style={{ color: '#9ca3af', cursor: 'move' }}>
                ⋮⋮
              </div>

              {/* Item Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {item.url}
                </div>
              </div>

              {/* Order Buttons */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => moveUp(item.id)}
                  disabled={index === 0}
                  style={{
                    padding: '6px 10px',
                    background: 'white',
                    color: index === 0 ? '#d1d5db' : '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: index === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  ↑
                </button>
                <button
                  onClick={() => moveDown(item.id)}
                  disabled={index === menuItems.length - 1}
                  style={{
                    padding: '6px 10px',
                    background: 'white',
                    color: index === menuItems.length - 1 ? '#d1d5db' : '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: index === menuItems.length - 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  ↓
                </button>
              </div>

              {/* Visibility Toggle */}
              <button
                onClick={() => toggleVisibility(item.id)}
                style={{
                  padding: '8px 16px',
                  background: item.visible ? '#10b981' : '#e5e7eb',
                  color: item.visible ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {item.visible ? '👁️ Visible' : '🚫 Hidden'}
              </button>

              {/* Edit Button */}
              <button
                onClick={() => showToast(`✏️ Editing ${item.label}...`)}
                style={{
                  padding: '8px 16px',
                  background: 'white',
                  color: '#667eea',
                  border: '1px solid #667eea',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Section */}
      <div style={{ marginTop: '24px', background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Preview</h3>
        <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
          <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {menuItems.filter(item => item.visible).map(item => (
              <div key={item.id} style={{ 
                padding: '8px 16px',
                color: '#374151',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer'
              }}>
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div style={{ marginTop: '24px', padding: '16px', background: '#eff6ff', border: '2px solid #dbeafe', borderRadius: '12px' }}>
        <p style={{ fontSize: '14px', color: '#1e40af', margin: 0 }}>
          💡 <strong>Tip:</strong> Changes to the navigation menu require a page refresh to take effect.
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
