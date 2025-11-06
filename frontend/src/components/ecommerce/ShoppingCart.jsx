import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../ui/Toast'
import { apiPost, API_BASE } from '../../api.js'
import { getCurrencyConfig, convert as fxConvert } from '../../util/currency'
import { trackRemoveFromCart, trackCheckoutStart } from '../../utils/analytics'

export default function ShoppingCart({ isOpen, onClose }) {
  const [cartItems, setCartItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name:'', phone:'', country:'SA', city:'', cityOther:'', area:'', address:'', details:'' })
  const [ccyCfg, setCcyCfg] = useState(null)

  const COUNTRIES = [
    { code:'SA', name:'KSA', flag:'🇸🇦', dial:'+966' },
    { code:'AE', name:'UAE', flag:'🇦🇪', dial:'+971' },
    { code:'OM', name:'Oman', flag:'🇴🇲', dial:'+968' },
    { code:'BH', name:'Bahrain', flag:'🇧🇭', dial:'+973' },
    { code:'IN', name:'India', flag:'🇮🇳', dial:'+91' },
    { code:'KW', name:'Kuwait', flag:'🇰🇼', dial:'+965' },
    { code:'QA', name:'Qatar', flag:'🇶🇦', dial:'+974' },
  ]
  const CITY_OPTIONS = {
    SA: ['Riyadh','Jeddah','Dammam','Khobar','Makkah','Madinah','Tabuk','Abha','Taif'],
    AE: ['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain'],
    OM: ['Muscat','Seeb','Salalah','Sohar','Nizwa'],
    BH: ['Manama','Riffa','Muharraq','Isa Town','Hamad Town'],
    IN: ['Mumbai','Delhi','Bengaluru','Hyderabad','Chennai','Kolkata'],
    KW: ['Kuwait City','Al Ahmadi','Hawalli','Salmiya','Farwaniya'],
    QA: ['Doha','Al Rayyan','Al Khor','Mesaieed','Umm Salal'],
  }

  // Quick adjust: pick last added product or only item
  const lastAddedId = (() => { try { return localStorage.getItem('last_added_product') || '' } catch { return '' } })()
  const quickItem = cartItems.length === 1 ? cartItems[0] : (cartItems.find(i => i.id === lastAddedId) || cartItems[0])
  const selectedCountry = COUNTRIES.find(c => c.code === form.country) || COUNTRIES[0]

  // Load currency config for dynamic conversion
  useEffect(() => {
    let alive = true
    getCurrencyConfig().then(cfg => { if (alive) setCcyCfg(cfg) }).catch(()=>{})
    return () => { alive = false }
  }, [])
  const COUNTRY_TO_CURRENCY = { SA: 'SAR', AE: 'AED', OM: 'OMR', BH: 'BHD', IN: 'INR', KW: 'KWD', QA: 'QAR' }
  const displayCurrency = COUNTRY_TO_CURRENCY[selectedCountry.code] || 'SAR'
  const convertPrice = (value, fromCurrency, toCurrency) => {
    const from = fromCurrency || 'SAR'
    const to = toCurrency || displayCurrency
    return fxConvert(value, from, to, ccyCfg)
  }
  const formatPrice = (value, currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || displayCurrency, minimumFractionDigits: 2 }).format(Number(value||0))

  // Removed free shipping logic per request

  const getImageUrl = (p) => {
    const imagePath = p || ''
    if (!imagePath) return '/placeholder-product.svg'
    if (String(imagePath).startsWith('http')) return imagePath
    let pathPart = String(imagePath).replace(/\\/g,'/')
    if (!pathPart.startsWith('/')) pathPart = '/' + pathPart
    try{
      const base = String(API_BASE||'').trim()
      if (!base) return pathPart
      if (/^https?:\/\//i.test(base)){
        const u = new URL(base)
        const prefix = u.pathname && u.pathname !== '/' ? u.pathname.replace(/\/$/, '') : ''
        return `${u.origin}${prefix}${pathPart}`
      }
      const prefix = base.replace(/\/$/, '')
      return `${prefix}${pathPart}`
    }catch{
      return pathPart
    }
  }

  const reloadCartFromStorage = () => {
    try{
      const savedCart = localStorage.getItem('shopping_cart')
      if (savedCart) setCartItems(JSON.parse(savedCart))
      else setCartItems([])
    }catch(err){ console.error('Error loading cart from localStorage:', err) }
  }

  // Load cart on mount and whenever we receive a cartUpdated event
  useEffect(() => {
    reloadCartFromStorage()
    const handler = () => reloadCartFromStorage()
    window.addEventListener('cartUpdated', handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('cartUpdated', handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  // When opening the cart, re-sync from storage to ensure the latest items are shown
  useEffect(() => {
    if (isOpen) reloadCartFromStorage()
  }, [isOpen])

  // Default country from catalog selection if available
  useEffect(() => {
    try {
      const savedCountry = localStorage.getItem('selected_country')
      if (savedCountry && savedCountry !== form.country) {
        setForm(prev => ({ ...prev, country: savedCountry }))
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist chosen country and reset city to a sensible default for that country
  useEffect(() => {
    try { localStorage.setItem('selected_country', form.country) } catch {}
    const opts = CITY_OPTIONS[form.country] || []
    if (opts.length && !opts.includes(form.city)) {
      setForm(prev => ({ ...prev, city: opts[0] }))
    }
    if (!opts.length && form.city) {
      setForm(prev => ({ ...prev, city: '' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.country])

  // Save cart to localStorage and notify header whenever cartItems changes
  useEffect(() => {
    localStorage.setItem('shopping_cart', JSON.stringify(cartItems))
    try { window.dispatchEvent(new CustomEvent('cartUpdated')) } catch {}
  }, [cartItems])

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }
    setCartItems(prevItems => {
      const next = prevItems.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item)
      try { localStorage.setItem('shopping_cart', JSON.stringify(next)) } catch {}
      try { window.dispatchEvent(new CustomEvent('cartUpdated')) } catch {}
      return next
    })
  }

  const removeFromCart = (productId) => {
    try {
      const removedItem = cartItems.find(item => item.id === productId)
      if (removedItem) {
        try { trackRemoveFromCart(removedItem.id, removedItem.name, removedItem.quantity) } catch {}
      }
    } catch {}
    setCartItems(prevItems => {
      const next = prevItems.filter(item => item.id !== productId)
      try { localStorage.setItem('shopping_cart', JSON.stringify(next)) } catch {}
      try { window.dispatchEvent(new CustomEvent('cartUpdated')) } catch {}
      return next
    })
    toast.success('Item removed from cart')
  }

  const clearCart = () => {
    setCartItems(() => {
      const next = []
      try { localStorage.setItem('shopping_cart', JSON.stringify(next)) } catch {}
      try { window.dispatchEvent(new CustomEvent('cartUpdated')) } catch {}
      return next
    })
    toast.success('Cart cleared')
  }

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => {
      const from = item.currency || 'SAR'
      const unit = convertPrice(item.price, from, displayCurrency)
      return total + (unit * item.quantity)
    }, 0)
  }

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0)
  }

  const handleCheckout = () => {
    submitOrder()
  }

  const onChange = (e)=>{
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function submitOrder(){
    if (cartItems.length === 0){ toast.error('Your cart is empty'); return }
    if (!form.name.trim()){ toast.error('Please enter your full name'); return }
    if (!form.phone.trim()){ toast.error('Please enter your phone number'); return }
    if (!(form.city && (form.city !== 'Other' || (form.city === 'Other' && String(form.cityOther||'').trim())))){
      toast.error('Please select your city');
      return
    }
    if (!form.address.trim()){ toast.error('Please enter your full address'); return }

    try{
      setIsLoading(true)
      // Track checkout start
      const cartValue = getTotalPrice()
      const itemCount = cartItems.reduce((total, item) => total + item.quantity, 0)
      trackCheckoutStart(cartValue, itemCount)

      const items = cartItems.map(it => ({ productId: it.id, quantity: Math.max(1, Number(it.quantity||1)) }))
      const body = {
        customerName: form.name.trim(),
        customerPhone: form.phone.trim(),
        phoneCountryCode: selectedCountry.dial,
        orderCountry: selectedCountry.name,
        city: (form.city === 'Other' ? String(form.cityOther||'').trim() : String(form.city||'').trim()),
        area: String(form.area||'').trim(),
        address: form.address.trim(),
        details: String(form.details||'').trim(),
        items,
        currency: displayCurrency,
      }
      await apiPost('/api/ecommerce/orders', body)
      toast.success('Order submitted! We will contact you shortly.')
      setCartItems([])
      onClose && onClose()
    }catch(err){
      toast.error(err?.message || 'Failed to submit order')
    }finally{
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/15 backdrop-blur-[1px] z-50 flex justify-end" onClick={onClose}>
      <div 
        className="w-full max-w-md sm:max-w-lg bg-white h-full shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col border-l-4 border-orange-500" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Minimal Premium */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white">
          <h2 className="text-xl font-bold text-gray-900">
            Cart <span className="text-orange-500">({getTotalItems()})</span>
          </h2>
          <button 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={onClose}
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="text-6xl mb-4">🛒</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h3>
              <p className="text-gray-600 mb-6">Add some products to get started!</p>
              <button 
                onClick={onClose}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <>
              {/* Cart Items - Minimal */}
              <div className="px-6 py-4 space-y-3">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-4 p-3 bg-white rounded-lg border border-gray-100 hover:border-orange-200 transition-colors">
                    <div className="w-16 h-16 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden">
                      <img 
                        src={getImageUrl(item.image || item.imagePath)} 
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = '/placeholder-product.svg'
                        }}
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 text-sm line-clamp-2 mb-2">
                        {item.name}
                      </h4>
                      <p className="text-orange-500 font-semibold text-sm mb-3">
                        {formatPrice(convertPrice(item.price, item.currency || 'SAR', displayCurrency), displayCurrency)}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                          <button 
                            className={`p-1.5 transition-colors ${item.quantity <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                            onClick={() => item.quantity > 1 && updateQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <span className="px-3 py-1 text-sm font-medium min-w-[2.5rem] text-center bg-white">
                            {item.quantity}
                          </span>
                          <button 
                            className={`p-1.5 transition-colors ${Number(item.maxStock) > 0 && item.quantity >= Number(item.maxStock) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                            onClick={() => {
                              const max = Number(item.maxStock)
                              if (max > 0 && item.quantity >= max) return
                              updateQuantity(item.id, item.quantity + 1)
                            }}
                            disabled={Number(item.maxStock) > 0 && item.quantity >= Number(item.maxStock)}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </button>
                        </div>
                        
                        <button 
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          onClick={() => removeFromCart(item.id)}
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-gray-900 text-sm">
                        {formatPrice(convertPrice(item.price, item.currency || 'SAR', displayCurrency) * item.quantity, displayCurrency)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary - Minimal */}
              <div className="px-6 py-4 bg-gray-50 border-y border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total ({getTotalItems()} items)</span>
                  <span className="text-xl font-bold text-gray-900">{formatPrice(getTotalPrice(), displayCurrency)}</span>
                </div>
              </div>

              {/* Add More Items Button - Above Form */}
              <div className="px-6 pt-4 pb-2">
                <button 
                  className="w-full bg-white border-2 border-orange-500 text-orange-500 py-2.5 px-4 rounded-lg hover:bg-orange-50 transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2"
                  onClick={() => {
                    onClose()
                    navigate('/catalog')
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add More Items
                </button>
              </div>

              {/* Order Form - Minimal */}
              <div className="px-6 pb-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Full Name</label>
                  <input name="name" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" value={form.name} onChange={onChange} placeholder="Your full name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Phone Number</label>
                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <select name="country" value={form.country} onChange={onChange} className="border border-gray-200 rounded-lg px-2 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors">
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.dial}</option>)}
                    </select>
                    <input name="phone" className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" value={form.phone} onChange={onChange} placeholder="5xxxxxxx" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Country</label>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50" value={selectedCountry.name} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">City</label>
                    <select name="city" value={form.city} onChange={onChange} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors">
                      <option value="">Select city</option>
                      {(CITY_OPTIONS[form.country] || []).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                {form.city === 'Other' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Other City</label>
                    <input name="cityOther" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" value={form.cityOther} onChange={onChange} placeholder="Enter your city" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Area</label>
                  <input name="area" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" value={form.area} onChange={onChange} placeholder="Area / district" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Full Address</label>
                  <input name="address" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" value={form.address} onChange={onChange} placeholder="Street, building" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Delivery Notes <span className="text-gray-400">(optional)</span></label>
                  <textarea name="details" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors resize-none" value={form.details} onChange={onChange} placeholder="Any notes for delivery" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sticky bottom checkout bar - Minimal */}
        {cartItems.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-4 bg-white">
            <div className="flex gap-2">
              <button 
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-4 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 font-semibold text-sm shadow-sm hover:shadow-md"
                onClick={handleCheckout}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Place Order'}
              </button>
              <button 
                className="px-4 py-3 bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors text-sm font-medium rounded-lg"
                onClick={clearCart}
                title="Clear Cart"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}