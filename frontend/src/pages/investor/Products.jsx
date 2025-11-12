import React, { useEffect, useState } from 'react';
import { API_BASE, apiGet } from '../../api';

export default function InvestorProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      const data = await apiGet('/api/investor/products');
      setProducts(data.products || []);
    } catch (e) {
      console.error('Failed to load products:', e);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(val, currency = 'SAR') {
    return `${currency} ${Number(val || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="section" style={{ display: 'grid', gap: 24, maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      {/* Hero */}
      <div style={{
        borderRadius: 20,
        padding: 24,
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.12))',
        border: '1px solid rgba(102, 126, 234, 0.25)',
        boxShadow: '0 10px 40px rgba(102, 126, 234, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, marginBottom: 6,
              background: 'linear-gradient(135deg, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              All Products
            </div>
            <div style={{ opacity: 0.75 }}>Explore the catalog from your workspace owner</div>
          </div>
          {/* Search */}
          <div style={{ position: 'relative', minWidth: 280 }}>
            <input
              type="search"
              placeholder="Search products..."
              aria-label="Search products"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px 12px 44px',
                borderRadius: 12,
                border: '2px solid var(--border)',
                fontSize: 14,
                background: 'var(--panel)',
                outline: 'none',
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => { e.target.style.borderColor = '#667eea' }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
            />
            <svg style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ display: 'inline-block', width: 50, height: 50, border: '5px solid var(--border)', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <div style={{ marginTop: 20, fontSize: 16, opacity: 0.7 }}>Loading products...</div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, opacity: 0.7 }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🔍</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 10 }}>No products found</div>
          <div style={{ fontSize: 15 }}>
            {searchQuery ? 'Try a different search term' : 'No products available for investment'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          {filteredProducts.map((product) => (
            <div
              key={product._id}
              style={{
                background: 'var(--card-bg)',
                borderRadius: 20,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                transition: 'transform .25s ease, box-shadow .25s ease',
                cursor: 'pointer',
                boxShadow: '0 10px 30px rgba(0,0,0,0.08)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow = '0 18px 50px rgba(0,0,0,0.16)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.08)';
              }}
            >
              {/* Product Image */}
              <div style={{ position: 'relative', paddingTop: '70%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                {product.image ? (
                  <img
                    src={`${API_BASE}${product.image}`}
                    alt={product.name}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, color: '#fff' }}>
                    📦
                  </div>
                )}
                {/* overlay gloss */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.08))' }} />
              </div>

              {/* Product Details */}
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px 0', lineHeight: 1.35 }}>{product.name}</h3>
                
                {product.description && (
                  <p style={{ fontSize: 13, opacity: 0.7, margin: '0 0 16px 0', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {product.description}
                  </p>
                )}

                {/* Price */}
                <div style={{ background: 'var(--panel)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, textTransform: 'uppercase', fontWeight: 700 }}>Sell Price</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#667eea' }}>{formatCurrency(product.price, product.baseCurrency)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline CSS */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 640px) {
          .section { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}
