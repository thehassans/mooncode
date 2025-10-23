import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../../api'
import Modal from '../../components/Modal.jsx'

const COUNTRIES = [
  { code: 'UAE', name: 'UAE', flag: '🇦🇪' },
  { code: 'Oman', name: 'Oman', flag: '🇴🇲' },
  { code: 'KSA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'Bahrain', name: 'Bahrain', flag: '🇧🇭' },
  { code: 'India', name: 'India', flag: '🇮🇳' },
  { code: 'Kuwait', name: 'Kuwait', flag: '🇰🇼' },
  { code: 'Qatar', name: 'Qatar', flag: '🇶🇦' }
]

export default function Shipments(){
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('all')
  const [showAddStockModal, setShowAddStockModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [stockForm, setStockForm] = useState({ country: '', quantity: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [stockHistory, setStockHistory] = useState([])

  useEffect(()=>{ loadProducts() },[])

  async function loadProducts(){
    setLoading(true)
    try{
      const data = await apiGet('/api/products')
      setProducts(data.products || [])
    }catch(err){ 
      setMsg(err?.message || 'Failed to load products')
    } finally{ 
      setLoading(false) 
    }
  }

  async function handleAddStock(){
    if (!selectedProduct || !stockForm.country || !stockForm.quantity) {
      setMsg('Please fill all required fields')
      return
    }
    
    setSubmitting(true)
    try{
      await apiPost(`/api/products/${selectedProduct._id}/stock/add`, {
        country: stockForm.country,
        quantity: Number(stockForm.quantity),
        notes: stockForm.notes
      })
      setMsg('✅ Stock added successfully')
      setTimeout(() => setMsg(''), 3000)
      setShowAddStockModal(false)
      setStockForm({ country: '', quantity: '', notes: '' })
      setSelectedProduct(null)
      await loadProducts()
    }catch(err){ 
      setMsg(err?.message || 'Failed to add stock')
    } finally{ 
      setSubmitting(false) 
    }
  }

  function openAddStockModal(product){
    setSelectedProduct(product)
    setStockForm({ country: '', quantity: '', notes: '' })
    setShowAddStockModal(true)
  }

  async function viewStockHistory(product){
    setSelectedProduct(product)
    setShowHistoryModal(true)
    try{
      const data = await apiGet(`/api/products/${product._id}/stock/history`)
      setStockHistory(data.history || [])
    }catch(err){
      setMsg('Failed to load stock history')
      setStockHistory([])
    }
  }

  function getStockForCountry(product, countryCode){
    return product?.stockByCountry?.[countryCode] || 0
  }

  function getTotalStock(product){
    if (!product?.stockByCountry) return 0
    return Object.values(product.stockByCountry).reduce((sum, val) => sum + Number(val || 0), 0)
  }

  const filteredProducts = useMemo(()=>{
    let list = products
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      list = list.filter(p => 
        p.name?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query)
      )
    }
    
    if (selectedCountry !== 'all') {
      list = list.filter(p => {
        const stock = getStockForCountry(p, selectedCountry)
        return stock > 0
      })
    }
    
    return list
  }, [products, searchQuery, selectedCountry])

  const stats = useMemo(() => {
    const totalProducts = products.length
    let totalStock = 0
    let lowStockCount = 0
    const stockByCountry = {}
    
    COUNTRIES.forEach(c => stockByCountry[c.code] = 0)
    
    products.forEach(p => {
      const pTotal = getTotalStock(p)
      totalStock += pTotal
      if (pTotal < 10) lowStockCount++
      
      COUNTRIES.forEach(c => {
        stockByCountry[c.code] += getStockForCountry(p, c.code)
      })
    })
    
    return { totalProducts, totalStock, lowStockCount, stockByCountry }
  }, [products])

  function fmtDate(s){ 
    try{ 
      return new Date(s).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }catch{ return ''} 
  }


  return (
    <div style={{display:'grid', gap:20, padding:'20px'}}>
      {/* Header */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16}}>
        <div>
          <h1 style={{fontSize:28, fontWeight:800, margin:0, background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>
            📦 Inventory Management
          </h1>
          <p style={{margin:'4px 0 0', opacity:0.7, fontSize:14}}>Manage your product stock across all countries</p>
        </div>
      </div>

      {msg && (
        <div style={{
          padding:16, 
          borderRadius:12, 
          background: msg.includes('✅') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${msg.includes('✅') ? '#10b981' : '#ef4444'}`,
          color: msg.includes('✅') ? '#065f46' : '#991b1b',
          fontWeight:600
        }}>
          {msg}
        </div>
      )}

      {/* Stats Cards */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:16}}>
        <div style={{
          background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding:24,
          borderRadius:16,
          color:'white',
          boxShadow:'0 10px 30px rgba(102, 126, 234, 0.3)'
        }}>
          <div style={{fontSize:13, opacity:0.9, marginBottom:8, textTransform:'uppercase', letterSpacing:1}}>Total Products</div>
          <div style={{fontSize:36, fontWeight:800}}>{stats.totalProducts}</div>
        </div>

        <div style={{
          background:'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          padding:24,
          borderRadius:16,
          color:'white',
          boxShadow:'0 10px 30px rgba(245, 87, 108, 0.3)'
        }}>
          <div style={{fontSize:13, opacity:0.9, marginBottom:8, textTransform:'uppercase', letterSpacing:1}}>Total Stock Units</div>
          <div style={{fontSize:36, fontWeight:800}}>{stats.totalStock.toLocaleString()}</div>
        </div>

        <div style={{
          background:'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
          padding:24,
          borderRadius:16,
          color:'white',
          boxShadow:'0 10px 30px rgba(250, 112, 154, 0.3)'
        }}>
          <div style={{fontSize:13, opacity:0.9, marginBottom:8, textTransform:'uppercase', letterSpacing:1}}>Low Stock Alert</div>
          <div style={{fontSize:36, fontWeight:800}}>{stats.lowStockCount}</div>
          <div style={{fontSize:12, opacity:0.9, marginTop:4}}>Products below 10 units</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card" style={{padding:20}}>
        <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:12, marginBottom:16}}>
          <input
            type="text"
            className="input"
            placeholder="🔍 Search products by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{fontSize:15}}
          />
          
          <select
            className="input"
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            style={{minWidth:200, fontSize:15}}
          >
            <option value="all">All Countries</option>
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color:'white'}}>
                <th style={{padding:'16px 20px', textAlign:'left', fontWeight:700, fontSize:13, letterSpacing:0.5}}>PRODUCT</th>
                <th style={{padding:'16px 20px', textAlign:'left', fontWeight:700, fontSize:13, letterSpacing:0.5}}>SKU</th>
                <th style={{padding:'16px 20px', textAlign:'center', fontWeight:700, fontSize:13, letterSpacing:0.5}}>TOTAL STOCK</th>
                {COUNTRIES.map(c => (
                  <th key={c.code} style={{padding:'16px 20px', textAlign:'center', fontWeight:700, fontSize:13, letterSpacing:0.5}}>
                    {c.flag} {c.code}
                  </th>
                ))}
                <th style={{padding:'16px 20px', textAlign:'center', fontWeight:700, fontSize:13, letterSpacing:0.5}}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{padding:'40px 20px', textAlign:'center', opacity:0.7}}>
                    Loading products...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{padding:'40px 20px', textAlign:'center', opacity:0.7}}>
                    No products found
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product, idx) => {
                  const totalStock = getTotalStock(product)
                  const isLowStock = totalStock < 10
                  
                  return (
                    <tr key={product._id} style={{
                      borderBottom:'1px solid var(--border)', 
                      background: idx % 2 ? 'transparent' : 'rgba(102, 126, 234, 0.03)',
                      transition:'all 0.2s'
                    }}>
                      <td style={{padding:'16px 20px'}}>
                        <div style={{display:'flex', gap:12, alignItems:'center'}}>
                          {product.imagePath || (product.images && product.images[0]) ? (
                            <img
                              src={product.imagePath || product.images[0]}
                              alt={product.name}
                              style={{
                                width:60,
                                height:60,
                                objectFit:'cover',
                                borderRadius:8,
                                border:'2px solid var(--border)',
                                background:'var(--panel)'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none'
                              }}
                            />
                          ) : (
                            <div style={{
                              width:60,
                              height:60,
                              borderRadius:8,
                              border:'2px solid var(--border)',
                              background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              display:'flex',
                              alignItems:'center',
                              justifyContent:'center',
                              fontSize:24,
                              color:'white'
                            }}>
                              📦
                            </div>
                          )}
                          <div>
                            <div style={{fontWeight:700, fontSize:15, marginBottom:4}}>{product.name}</div>
                            <div style={{fontSize:12, opacity:0.7}}>{product.baseCurrency} {product.price?.toFixed(2)}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{padding:'16px 20px'}}>
                        <span style={{
                          background:'rgba(102, 126, 234, 0.1)',
                          padding:'4px 12px',
                          borderRadius:6,
                          fontSize:13,
                          fontWeight:600,
                          color:'#667eea'
                        }}>
                          {product.sku || 'N/A'}
                        </span>
                      </td>
                      <td style={{padding:'16px 20px', textAlign:'center'}}>
                        <div style={{
                          display:'inline-block',
                          background: isLowStock ? 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color:'white',
                          padding:'8px 16px',
                          borderRadius:8,
                          fontWeight:800,
                          fontSize:18,
                          minWidth:80
                        }}>
                          {totalStock}
                        </div>
                        {isLowStock && (
                          <div style={{fontSize:11, color:'#ef4444', fontWeight:600, marginTop:4}}>⚠️ Low Stock</div>
                        )}
                      </td>
                      {COUNTRIES.map(c => {
                        const stock = getStockForCountry(product, c.code)
                        return (
                          <td key={c.code} style={{padding:'16px 20px', textAlign:'center'}}>
                            <span style={{
                              fontSize:16,
                              fontWeight:700,
                              color: stock === 0 ? '#9ca3af' : stock < 5 ? '#f59e0b' : '#10b981'
                            }}>
                              {stock}
                            </span>
                          </td>
                        )
                      })}
                      <td style={{padding:'16px 20px', textAlign:'center'}}>
                        <div style={{display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap'}}>
                          <button
                            className="btn"
                            onClick={() => openAddStockModal(product)}
                            style={{
                              background:'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              border:'none',
                              padding:'8px 16px',
                              fontSize:13,
                              fontWeight:700,
                              color:'white',
                              borderRadius:8,
                              cursor:'pointer',
                              boxShadow:'0 4px 12px rgba(16, 185, 129, 0.3)'
                            }}
                          >
                            ➕ Add Stock
                          </button>
                          <button
                            className="btn secondary"
                            onClick={() => viewStockHistory(product)}
                            style={{
                              padding:'8px 16px',
                              fontSize:13,
                              fontWeight:700,
                              borderRadius:8
                            }}
                          >
                            📜 History
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Stock Modal */}
      {showAddStockModal && selectedProduct && (
        <Modal
          open={showAddStockModal}
          onClose={() => {
            setShowAddStockModal(false)
            setSelectedProduct(null)
            setStockForm({ country: '', quantity: '', notes: '' })
          }}
          title="➕ Add Stock"
        >
          <div style={{display:'grid', gap:20}}>
            <div style={{
              padding:20,
              background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius:12,
              color:'white'
            }}>
              <div style={{fontSize:14, opacity:0.9, marginBottom:4}}>Product</div>
              <div style={{fontSize:20, fontWeight:800}}>{selectedProduct.name}</div>
              <div style={{fontSize:13, opacity:0.9, marginTop:4}}>
                Current Total Stock: <strong>{getTotalStock(selectedProduct)}</strong> units
              </div>
            </div>

            <div>
              <label className="label" style={{fontWeight:700, marginBottom:8, display:'block'}}>
                Country <span style={{color:'#ef4444'}}>*</span>
              </label>
              <select
                className="input"
                value={stockForm.country}
                onChange={(e) => setStockForm({...stockForm, country: e.target.value})}
                style={{fontSize:15}}
              >
                <option value="">Select Country</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} (Current: {getStockForCountry(selectedProduct, c.code)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" style={{fontWeight:700, marginBottom:8, display:'block'}}>
                Quantity to Add <span style={{color:'#ef4444'}}>*</span>
              </label>
              <input
                type="number"
                className="input"
                placeholder="Enter quantity"
                value={stockForm.quantity}
                onChange={(e) => setStockForm({...stockForm, quantity: e.target.value})}
                min="1"
                style={{fontSize:15}}
              />
            </div>

            <div>
              <label className="label" style={{fontWeight:700, marginBottom:8, display:'block'}}>
                Notes (Optional)
              </label>
              <textarea
                className="input"
                placeholder="Add notes about this stock addition..."
                value={stockForm.notes}
                onChange={(e) => setStockForm({...stockForm, notes: e.target.value})}
                rows={3}
                style={{fontSize:14, resize:'vertical'}}
              />
            </div>

            <div style={{display:'flex', gap:12, justifyContent:'flex-end'}}>
              <button
                className="btn secondary"
                onClick={() => {
                  setShowAddStockModal(false)
                  setSelectedProduct(null)
                  setStockForm({ country: '', quantity: '', notes: '' })
                }}
                style={{padding:'12px 24px', fontWeight:700}}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleAddStock}
                disabled={submitting || !stockForm.country || !stockForm.quantity}
                style={{
                  padding:'12px 24px',
                  fontWeight:700,
                  background:'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border:'none',
                  opacity: (submitting || !stockForm.country || !stockForm.quantity) ? 0.5 : 1
                }}
              >
                {submitting ? '⏳ Adding...' : '✅ Add Stock'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Stock History Modal */}
      {showHistoryModal && selectedProduct && (
        <Modal
          open={showHistoryModal}
          onClose={() => {
            setShowHistoryModal(false)
            setSelectedProduct(null)
            setStockHistory([])
          }}
          title="📜 Stock History"
        >
          <div style={{display:'grid', gap:20}}>
            <div style={{
              padding:20,
              background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius:12,
              color:'white'
            }}>
              <div style={{fontSize:14, opacity:0.9, marginBottom:4}}>Product</div>
              <div style={{fontSize:20, fontWeight:800}}>{selectedProduct.name}</div>
            </div>

            <div style={{maxHeight:400, overflowY:'auto'}}>
              {stockHistory.length === 0 ? (
                <div style={{padding:40, textAlign:'center', opacity:0.7}}>
                  No stock history available
                </div>
              ) : (
                <div style={{display:'grid', gap:12}}>
                  {stockHistory.map((entry, idx) => (
                    <div key={idx} style={{
                      padding:16,
                      border:'1px solid var(--border)',
                      borderRadius:12,
                      background:'var(--panel)',
                      transition:'all 0.2s'
                    }}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:8}}>
                        <div>
                          <div style={{fontSize:12, opacity:0.7, marginBottom:4}}>
                            {fmtDate(entry.date || entry.createdAt)}
                          </div>
                          <div style={{display:'flex', alignItems:'center', gap:8}}>
                            <span style={{fontSize:20}}>
                              {COUNTRIES.find(c => c.code === entry.country)?.flag || '🌍'}
                            </span>
                            <span style={{fontWeight:700, fontSize:15}}>
                              {COUNTRIES.find(c => c.code === entry.country)?.name || entry.country}
                            </span>
                          </div>
                        </div>
                        <div style={{
                          background:'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color:'white',
                          padding:'6px 12px',
                          borderRadius:8,
                          fontWeight:800,
                          fontSize:16
                        }}>
                          +{entry.quantity}
                        </div>
                      </div>
                      {entry.notes && (
                        <div style={{
                          fontSize:13,
                          opacity:0.8,
                          padding:12,
                          background:'var(--bg)',
                          borderRadius:8,
                          marginTop:8
                        }}>
                          {entry.notes}
                        </div>
                      )}
                      {entry.addedBy && (
                        <div style={{fontSize:12, opacity:0.6, marginTop:8}}>
                          Added by: {entry.addedBy.firstName} {entry.addedBy.lastName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
