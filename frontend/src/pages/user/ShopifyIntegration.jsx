import React, { useState, useEffect } from 'react'
import { apiGet, apiPost } from '../../api'

export default function ShopifyIntegration() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Shopify settings
  const [shopifyStore, setShopifyStore] = useState('')
  const [shopifyAccessToken, setShopifyAccessToken] = useState('')
  const [shopifyWebhookSecret, setShopifyWebhookSecret] = useState('')
  const [shopifyApiVersion, setShopifyApiVersion] = useState('2024-01')

  // Products ready for sync
  const [products, setProducts] = useState([])
  const [syncResults, setSyncResults] = useState([])

  useEffect(() => {
    loadSettings()
    loadProductsForSync()
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const data = await apiGet('/api/shopify/settings')
      setShopifyStore(data.shopifyStore || '')
      setShopifyAccessToken(data.shopifyAccessTokenFull || '')
      setShopifyWebhookSecret(data.shopifyWebhookSecret || '')
      setShopifyApiVersion(data.shopifyApiVersion || '2024-01')
    } catch (err) {
      console.error('Failed to load Shopify settings:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadProductsForSync() {
    try {
      const data = await apiGet('/api/products')
      const productsMarkedForShopify = (data.products || []).filter((p) => p.displayOnShopify)
      setProducts(productsMarkedForShopify)
    } catch (err) {
      console.error('Failed to load products:', err)
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      await apiPost('/api/shopify/settings', {
        shopifyStore,
        shopifyAccessToken,
        shopifyWebhookSecret,
        shopifyApiVersion,
      })

      setMessage('Shopify settings saved successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to save Shopify settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleSyncAll() {
    setSyncing(true)
    setMessage('')
    setError('')
    setSyncResults([])

    try {
      const data = await apiPost('/api/shopify/products/sync-all', {})
      setSyncResults(data.results || [])
      setMessage(`Synced ${data.results?.length || 0} products to Shopify!`)
      await loadProductsForSync() // Reload to update sync status
    } catch (err) {
      setError(err.message || 'Failed to sync products to Shopify')
    } finally {
      setSyncing(false)
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
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
            Shopify Integration
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
            Connect your Shopify store and sync products automatically
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

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* Shopify Configuration Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '24px',
              borderBottom: '1px solid var(--border)',
              background:
                'linear-gradient(135deg, rgba(132, 204, 22, 0.05), rgba(101, 163, 13, 0.05))',
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
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
                  Shopify Store Configuration
                </h2>
                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
                  Enter your Shopify store credentials to enable integration
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gap: '20px' }}>
              <div className="field">
                <label className="label">
                  Shopify Store URL
                  <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: '8px' }}>
                    (e.g., your-store.myshopify.com)
                  </span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={shopifyStore}
                  onChange={(e) => setShopifyStore(e.target.value)}
                  placeholder="your-store.myshopify.com"
                  required
                />
              </div>

              <div className="field">
                <label className="label">
                  Shopify Admin API Access Token
                  <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: '8px' }}>
                    (Private app token)
                  </span>
                </label>
                <input
                  type="password"
                  className="input"
                  value={shopifyAccessToken}
                  onChange={(e) => setShopifyAccessToken(e.target.value)}
                  placeholder="shpat_..."
                  required
                />
              </div>

              <div className="field">
                <label className="label">
                  Webhook Secret
                  <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: '8px' }}>
                    (For webhook verification)
                  </span>
                </label>
                <input
                  type="password"
                  className="input"
                  value={shopifyWebhookSecret}
                  onChange={(e) => setShopifyWebhookSecret(e.target.value)}
                  placeholder="Your webhook secret key"
                />
              </div>

              <div className="field">
                <label className="label">API Version</label>
                <input
                  type="text"
                  className="input"
                  value={shopifyApiVersion}
                  onChange={(e) => setShopifyApiVersion(e.target.value)}
                  placeholder="2024-01"
                />
              </div>

              <div
                style={{
                  padding: '16px',
                  background: 'rgba(132, 204, 22, 0.05)',
                  border: '1px solid rgba(132, 204, 22, 0.2)',
                  borderRadius: '10px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
                  📦 Setup Instructions
                </div>
                <ol style={{ color: 'var(--muted)', paddingLeft: '20px', margin: 0 }}>
                  <li>Go to your Shopify Admin → Apps → Develop apps</li>
                  <li>Create a new app or select an existing one</li>
                  <li>
                    Configure Admin API scopes: read_products, write_products, read_orders,
                    write_orders, write_fulfillments
                  </li>
                  <li>Install the app and copy the Admin API access token</li>
                  <li>Create webhooks for: orders/create, orders/fulfilled, orders/cancelled</li>
                  <li>Webhook URL: https://web.buysial.com/api/shopify/webhooks/orders/create</li>
                </ol>
              </div>

              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Saving...' : 'Save Shopify Settings'}
              </button>
            </div>
          </form>
        </div>

        {/* Products Sync Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '24px',
              borderBottom: '1px solid var(--border)',
              background:
                'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(37, 99, 235, 0.05))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
                    Product Sync
                  </h2>
                  <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
                    {products.length} products marked for Shopify sync
                  </p>
                </div>
              </div>
              <button
                className="btn"
                onClick={handleSyncAll}
                disabled={syncing || products.length === 0}
                style={{ minWidth: '150px' }}
              >
                {syncing ? 'Syncing...' : 'Sync All Products'}
              </button>
            </div>
          </div>

          <div style={{ padding: '24px' }}>
            {products.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: 'var(--muted)',
                }}
              >
                <p style={{ fontSize: '16px', marginBottom: '8px' }}>
                  No products marked for Shopify
                </p>
                <p style={{ fontSize: '14px' }}>
                  Go to Products → In-house Products and check "Sync to Shopify" on products you
                  want to list
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {products.map((product) => (
                  <div
                    key={product._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {product.imagePath && (
                        <img
                          src={product.imagePath}
                          alt={product.name}
                          style={{
                            width: '40px',
                            height: '40px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                          }}
                        />
                      )}
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '14px' }}>{product.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {product.baseCurrency} {product.price}
                          {product.shopifyProductId && (
                            <span style={{ marginLeft: '8px', color: '#10b981' }}>✓ Synced</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {product.lastShopifySync && (
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        Last sync: {new Date(product.lastShopifySync).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Sync Results */}
            {syncResults.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '16px' }}>
                  Sync Results:
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {syncResults.map((result, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '10px 12px',
                        background: result.success
                          ? 'rgba(16, 185, 129, 0.05)'
                          : 'rgba(239, 68, 68, 0.05)',
                        border: `1px solid ${result.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{result.productName}</span>
                      {' - '}
                      {result.success ? (
                        <span style={{ color: '#10b981' }}>
                          {result.action === 'created' ? 'Created' : 'Updated'} ✓
                        </span>
                      ) : (
                        <span style={{ color: '#ef4444' }}>Failed: {result.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Webhook Information */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Webhook Endpoints
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '16px' }}>
            Configure these webhook URLs in your Shopify admin to receive order notifications:
          </p>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div
              style={{
                padding: '12px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '13px',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Order Created:</div>
              https://web.buysial.com/api/shopify/webhooks/orders/create
            </div>
            <div
              style={{
                padding: '12px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '13px',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Order Fulfilled:</div>
              https://web.buysial.com/api/shopify/webhooks/orders/fulfilled
            </div>
            <div
              style={{
                padding: '12px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '13px',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Order Cancelled:</div>
              https://web.buysial.com/api/shopify/webhooks/orders/cancelled
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
