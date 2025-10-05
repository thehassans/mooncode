import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../ui/Toast'
import { apiPost, API_BASE } from '../../api.js'
import { trackRemoveFromCart, trackCheckoutStart } from '../../utils/analytics'

export default function ShoppingCart({ isOpen, onClose }) {
  const [cartItems, setCartItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name:'', phone:'', country:'SA', city:'', area:'', address:'', details:'' })

  const COUNTRIES = [
    { code:'SA', name:'KSA', flag:'🇸🇦', dial:'+966' },
    { code:'AE', name:'UAE', flag:'🇦🇪', dial:'+971' },
    { code:'OM', name:'Oman', flag:'🇴🇲', dial:'+968' },
    { code:'BH', name:'Bahrain', flag:'🇧🇭', dial:'+973' },
    { code:'IN', name:'India', flag:'🇮🇳', dial:'+91' },
    { code:'KW', name:'Kuwait', flag:'🇰🇼', dial:'+965' },
    { code:'QA', name:'Qatar', flag:'🇶🇦', dial:'+974' },
  ]
  const selectedCountry = COUNTRIES.find(c => c.code === form.country) || COUNTRIES[0]

  // Currency conversion (same base as elsewhere)
  const RATES = {
    SAR: { SAR: 1, AED: 0.98, OMR: 0.10, BHD: 0.10 },
    AED: { SAR: 1.02, AED: 1, OMR: 0.10, BHD: 0.10 },
    OMR: { SAR: 9.78, AED: 9.58, OMR: 1, BHD: 0.98 },
    BHD: { SAR: 9.94, AED: 9.74, OMR: 1.02, BHD: 1 },
  }
  const COUNTRY_TO_CURRENCY = { SA: 'SAR', AE: 'AED', OM: 'OMR', BH: 'BHD' }
  const displayCurrency = COUNTRY_TO_CURRENCY[selectedCountry.code] || 'SAR'
  const convertPrice = (value, fromCurrency, toCurrency) => {
    const v = Number(value || 0)
    const from = fromCurrency || 'SAR'
    const to = toCurrency || displayCurrency
    if (from === to) return v
    const rate = RATES[from]?.[to]
    return rate ? v * rate : v
  }
  const formatPrice = (value, currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || displayCurrency, minimumFractionDigits: 2 }).format(Number(value||0))

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

  // Load cart from localStorage on component mount
  useEffect(() => {
    const savedCart = localStorage.getItem('shopping_cart')
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart))
      } catch (error) {
        console.error('Error loading cart from localStorage:', error)
      }
    }
  }, [])

  // Save cart to localStorage whenever cartItems changes
  useEffect(() => {
    localStorage.setItem('shopping_cart', JSON.stringify(cartItems))
  }, [cartItems])

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    )
  }

  const removeFromCart = (productId) => {
    // Find the removed item for tracking
    const removedItem = cartItems.find(item => item.id === productId)
    if (removedItem) {
      trackRemoveFromCart(removedItem.id, removedItem.name, removedItem.quantity)
    }
    
    setCartItems(prevItems => prevItems.filter(item => item.id !== productId))
    
    // Dispatch custom event to update cart count in header
    window.dispatchEvent(new CustomEvent('cartUpdated'))
    
    toast.success('Item removed from cart')
  }

  const clearCart = () => {
    setCartItems([])
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
    if (!form.city.trim()){ toast.error('Please enter your city'); return }
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
        city: form.city.trim(),
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
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <h2 className="text-lg sm:text-xl font-bold">
            Shopping Cart ({getTotalItems()} items)
          </h2>
          <button 
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            onClick={onClose}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="p-4 sm:p-6 space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-white rounded-lg overflow-hidden border border-gray-200">
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
                      <h4 className="font-semibold text-gray-900 text-sm sm:text-base line-clamp-2 mb-1">
                        {item.name}
                      </h4>
                      <p className="text-orange-600 font-bold text-sm sm:text-base mb-3">
                        {formatPrice(convertPrice(item.price, item.currency || 'SAR', displayCurrency), displayCurrency)}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center bg-white border border-gray-300 rounded-lg">
                          <button 
                            className="p-2 hover:bg-gray-100 transition-colors rounded-l-lg"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <span className="px-3 py-2 text-sm font-medium min-w-[3rem] text-center">
                            {item.quantity}
                          </span>
                          <button 
                            className="p-2 hover:bg-gray-100 transition-colors rounded-r-lg"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </button>
                        </div>
                        
                        <button 
                          className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                          onClick={() => removeFromCart(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-bold text-gray-900 text-sm sm:text-base">
                        {formatPrice(convertPrice(item.price, item.currency || 'SAR', displayCurrency) * item.quantity, displayCurrency)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer: Slide-in checkout form */}
        {cartItems.length > 0 && (
          <div className="border-t border-gray-200 p-4 sm:p-6 bg-white">
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal:</span>
                <span>{formatPrice(getTotalPrice(), displayCurrency)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total:</span>
                <span>{formatPrice(getTotalPrice(), displayCurrency)}</span>
              </div>
            </div>

            {/* Order Form */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-sm text-gray-700">Full Name</label>
                <input name="name" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={form.name} onChange={onChange} placeholder="Your full name" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Phone</label>
                <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                  <select name="country" value={form.country} onChange={onChange} className="border border-gray-300 rounded-lg px-2 py-2">
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.dial}</option>)}
                  </select>
                  <input name="phone" className="border border-gray-300 rounded-lg px-3 py-2" value={form.phone} onChange={onChange} placeholder="5xxxxxxx" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm text-gray-700">Country</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2" value={selectedCountry.name} readOnly />
                </div>
                <div>
                  <label className="text-sm text-gray-700">City</label>
                  <input name="city" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={form.city} onChange={onChange} placeholder="City" />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-700">Area</label>
                <input name="area" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={form.area} onChange={onChange} placeholder="Area / district" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Full Address</label>
                <input name="address" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={form.address} onChange={onChange} placeholder="Street, building" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Notes (optional)</label>
                <textarea name="details" rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2" value={form.details} onChange={onChange} placeholder="Any notes for delivery" />
              </div>
            </div>

            <div className="space-y-3">
              <button 
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-4 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 font-semibold text-sm sm:text-base shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                onClick={handleCheckout}
                disabled={isLoading}
              >
                {isLoading ? 'Submitting…' : 'Place Order'}
              </button>
              <button 
                className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                onClick={clearCart}
              >
                Clear Cart
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}