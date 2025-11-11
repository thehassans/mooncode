import React, { useEffect, useState } from 'react';
import { API_BASE, apiGet, apiPost } from '../../api';
import Modal from '../../components/Modal';

export default function InvestorProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [investModal, setInvestModal] = useState({ open: false, product: null });
  const [investForm, setInvestForm] = useState({ amount: '', quantity: '' });
  const [investLoading, setInvestLoading] = useState(false);
  const [investError, setInvestError] = useState('');
  const [investSuccess, setInvestSuccess] = useState('');
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

  function openInvestModal(product) {
    setInvestModal({ open: true, product });
    setInvestForm({ amount: '', quantity: '' });
    setInvestError('');
    setInvestSuccess('');
  }

  function closeInvestModal() {
    setInvestModal({ open: false, product: null });
    setInvestForm({ amount: '', quantity: '' });
    setInvestError('');
    setInvestSuccess('');
  }

  async function handleInvest() {
    const { product } = investModal;
    if (!product) return;

    const amount = Number(investForm.amount);
    const quantity = Number(investForm.quantity);

    if (!amount || amount <= 0) {
      setInvestError('Please enter a valid investment amount');
      return;
    }

    if (!quantity || quantity <= 0) {
      setInvestError('Please enter a valid quantity');
      return;
    }

    setInvestLoading(true);
    setInvestError('');

    try {
      await apiPost('/api/investor/invest', {
        productId: product._id,
        amount,
        quantity
      });

      setInvestSuccess('Investment successful!');
      setTimeout(() => {
        closeInvestModal();
        loadProducts();
      }, 1500);
    } catch (e) {
      setInvestError(e?.message || 'Failed to create investment');
    } finally {
      setInvestLoading(false);
    }
  }

  function formatCurrency(val, currency = 'SAR') {
    return `${currency} ${Number(val || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="section" style={{ display: 'grid', gap: 24, maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            All Products
          </h1>
          <p style={{ fontSize: 15, opacity: 0.7, margin: '8px 0 0 0' }}>Browse and invest in available products</p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', minWidth: 280 }}>
          <input
            type="text"
            placeholder="Search products..."
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
            onFocus={(e) => {
              e.target.style.borderColor = '#667eea';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border)';
            }}
          />
          <svg style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {filteredProducts.map((product) => (
            <div
              key={product._id}
              style={{
                background: 'var(--card-bg)',
                borderRadius: 20,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
              }}
            >
              {/* Product Image */}
              <div style={{ position: 'relative', paddingTop: '75%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
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

                {/* Investment Status Badge */}
                {product.invested && (
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: 'rgba(16, 185, 129, 0.95)',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                  }}>
                    Invested
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0', lineHeight: 1.4 }}>{product.name}</h3>
                
                {product.description && (
                  <p style={{ fontSize: 13, opacity: 0.7, margin: '0 0 16px 0', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {product.description}
                  </p>
                )}

                {/* Price and Stock */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: 'var(--panel)', padding: 12, borderRadius: 10 }}>
                    <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Sell Price</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#667eea' }}>{formatCurrency(product.price, product.baseCurrency)}</div>
                  </div>
                  <div style={{ background: 'var(--panel)', padding: 12, borderRadius: 10 }}>
                    <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Stock</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{product.stockQty || product.stock || 0} units</div>
                  </div>
                </div>

                {/* Current Investment (if any) */}
                {product.invested && (
                  <div style={{ background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)', padding: 12, borderRadius: 10, marginBottom: 16 }}>
                    <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6, fontWeight: 600 }}>Your Investment</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#667eea' }}>SAR {formatCurrency(product.investmentAmount)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#764ba2' }}>{product.investmentQuantity} units</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Invest Button */}
                <button
                  onClick={() => openInvestModal(product)}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'scale(1.02)';
                    e.target.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'scale(1)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  {product.invested ? 'Add More Investment' : 'Invest Now'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Investment Modal */}
      <Modal
        title={`Invest in ${investModal.product?.name || 'Product'}`}
        open={investModal.open}
        onClose={closeInvestModal}
        footer={
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={closeInvestModal}
              style={{
                padding: '12px 24px',
                borderRadius: 10,
                border: '2px solid var(--border)',
                background: 'transparent',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}
              disabled={investLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleInvest}
              disabled={investLoading}
              style={{
                padding: '12px 32px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: investLoading ? 'not-allowed' : 'pointer',
                opacity: investLoading ? 0.6 : 1
              }}
            >
              {investLoading ? 'Processing...' : 'Confirm Investment'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 20 }}>
          {investSuccess && (
            <div style={{ padding: 16, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 10, color: '#10b981', fontSize: 14, fontWeight: 600 }}>
              ✓ {investSuccess}
            </div>
          )}

          {investError && (
            <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 10, color: '#ef4444', fontSize: 14, fontWeight: 600 }}>
              {investError}
            </div>
          )}

          {/* Product Info */}
          <div style={{ background: 'var(--panel)', padding: 16, borderRadius: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>Product Details</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{investModal.product?.name}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#667eea' }}>
              Price: {formatCurrency(investModal.product?.price, investModal.product?.baseCurrency)}
            </div>
          </div>

          {/* Investment Form */}
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, opacity: 0.9 }}>
                Investment Amount (SAR)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter amount..."
                value={investForm.amount}
                onChange={(e) => setInvestForm({ ...investForm, amount: e.target.value })}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: '2px solid var(--border)',
                  fontSize: 15,
                  background: 'var(--panel)',
                  outline: 'none'
                }}
                onFocus={(e) => (e.target.style.borderColor = '#667eea')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, opacity: 0.9 }}>
                Quantity (Units)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Enter quantity..."
                value={investForm.quantity}
                onChange={(e) => setInvestForm({ ...investForm, quantity: e.target.value })}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: '2px solid var(--border)',
                  fontSize: 15,
                  background: 'var(--panel)',
                  outline: 'none'
                }}
                onFocus={(e) => (e.target.style.borderColor = '#667eea')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
          </div>

          {/* Investment Summary */}
          {investForm.amount && investForm.quantity && (
            <div style={{ background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)', padding: 16, borderRadius: 12 }}>
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 12, fontWeight: 600 }}>Investment Summary</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, opacity: 0.8 }}>Amount per unit:</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>SAR {(Number(investForm.amount) / Number(investForm.quantity)).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, opacity: 0.8 }}>Total quantity:</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{investForm.quantity} units</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>Total Investment:</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#667eea' }}>SAR {Number(investForm.amount).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Inline CSS */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 640px) {
          div[style*="gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
