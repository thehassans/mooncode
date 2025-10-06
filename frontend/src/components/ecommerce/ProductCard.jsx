import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../ui/Toast'
import { trackProductView, trackAddToCart } from '../../utils/analytics'
import { API_BASE } from '../../api.js'
import { getCurrencyConfig, convert as fxConvert } from '../../util/currency'

export default function ProductCard({ product, onAddToCart, selectedCountry = 'SA', selectionEnabled = false, selected = false, onToggleSelect }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [qty, setQty] = useState(1)

  const [ccyCfg, setCcyCfg] = useState(null)
  useEffect(()=>{ let alive=true; getCurrencyConfig().then(cfg=>{ if(alive) setCcyCfg(cfg) }).catch(()=>{}); return ()=>{alive=false} },[])

  // Country to currency mapping
  const COUNTRY_TO_CURRENCY = {
    'AE': 'AED', // UAE
    'OM': 'OMR', // Oman
    'SA': 'SAR', // KSA
    'BH': 'BHD', // Bahrain
    'IN': 'INR', // India
    'KW': 'KWD', // Kuwait
    'QA': 'QAR', // Qatar
  }

  const convertPrice = (value, fromCurrency, toCurrency) => fxConvert(value, fromCurrency||'SAR', toCurrency||getDisplayCurrency(), ccyCfg)

  const getDisplayCurrency = () => {
    return COUNTRY_TO_CURRENCY[selectedCountry] || 'SAR'
  }

  const getConvertedPrice = (price) => {
    const baseCurrency = product.baseCurrency || 'SAR'
    const displayCurrency = getDisplayCurrency()
    return convertPrice(price, baseCurrency, displayCurrency)
  }

  const handleProductClick = () => {
    if (selectionEnabled) {
      try { onToggleSelect && onToggleSelect() } catch {}
      return
    }
    // Track product view
    trackProductView(product._id, product.name, product.category, product.price)
    navigate(`/product/${product._id}`)
  }

  const formatPrice = (price, currency = 'SAR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(price)
  }

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '/placeholder-product.svg'
    if (imagePath.startsWith('http')) return imagePath
    let p = String(imagePath).replace(/\\/g,'/')
    if (!p.startsWith('/')) p = '/' + p
    try{
      const base = String(API_BASE||'').trim()
      if (!base) return p
      if (/^https?:\/\//i.test(base)){
        const u = new URL(base)
        const prefix = u.pathname && u.pathname !== '/' ? u.pathname.replace(/\/$/, '') : ''
        return `${u.origin}${prefix}${p}`
      }
      // base is relative (e.g., '/api')
      const prefix = base.replace(/\/$/, '')
      return `${prefix}${p}`
    }catch{
      return p
    }
  }

  const renderStars = (rating) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className="text-yellow-400">★</span>)
    }
    
    if (hasHalfStar) {
      stars.push(<span key="half" className="text-yellow-400">☆</span>)
    }
    
    const emptyStars = 5 - Math.ceil(rating)
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<span key={`empty-${i}`} className="text-gray-300">☆</span>)
    }
    
    return stars
  }

  const handleAddToCart = (e) => {
    e.stopPropagation() // Prevent navigation when clicking add to cart
    
    try {
      const basePrice = Number(product?.price) || 0
      const discounted = Number(product?.discount) > 0 ? basePrice * (1 - Number(product.discount) / 100) : basePrice
      const unitPrice = Number(
        product?.onSale && (product?.salePrice ?? null) != null
          ? product.salePrice
          : discounted
      ) || 0
      const addQty = Math.max(1, Math.floor(Number(qty) || 1))
      const savedCart = localStorage.getItem('shopping_cart')
      let cartItems = []
      
      if (savedCart) {
        cartItems = JSON.parse(savedCart)
      }

      const existingItemIndex = cartItems.findIndex(item => item.id === product._id)
      const max = Number(product.stockQty || 0)
      
      if (existingItemIndex > -1) {
        // Item already exists, increase quantity within stock limits
        const current = Number(cartItems[existingItemIndex].quantity || 0)
        const candidate = current + addQty
        if (max > 0 && candidate > max) {
          cartItems[existingItemIndex].quantity = max
          toast.info(`Only ${max} in stock`)
        } else {
          cartItems[existingItemIndex].quantity = candidate
        }
        // Refresh unit price and stock info in case it changed
        cartItems[existingItemIndex].price = unitPrice
        cartItems[existingItemIndex].currency = product.baseCurrency || 'SAR'
        cartItems[existingItemIndex].maxStock = product.stockQty
      } else {
        // Add new item to cart
        cartItems.push({
          id: product._id,
          name: product.name,
          price: unitPrice,
          currency: product.baseCurrency || 'SAR',
          image: product.images?.[0] || '',
          quantity: addQty,
          maxStock: product.stockQty
        })
      }
      
      // Save updated cart to localStorage
      localStorage.setItem('shopping_cart', JSON.stringify(cartItems))
      try { localStorage.setItem('last_added_product', String(product._id)) } catch {}
      
      // Track add to cart event
      trackAddToCart(product._id, product.name, unitPrice, addQty)
      
      // Dispatch custom event to update cart count in header
      window.dispatchEvent(new CustomEvent('cartUpdated'))
      
      // Show success message
      toast.success(`Added ${addQty} × ${product.name} to cart`)
      if (typeof onAddToCart === 'function') {
        try { onAddToCart(product) } catch {}
      }
    } catch (error) {
      console.error('Error adding to cart:', error)
    }
  }

  // Prefer the first image from the images array, but fall back to single imagePath if needed
  const images = Array.isArray(product?.images) && product.images.length > 0
    ? product.images
    : (product?.imagePath ? [product.imagePath] : [])
  const mainImagePath = images[0] || ''
  const hoverImagePath = images[1] || images[0] || ''

  return (
    <div className={`${selected ? 'ring-2 ring-orange-200 border-orange-500' : 'border-gray-200'} bg-white rounded-xl shadow-sm border overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer`}
         onClick={handleProductClick}>
      {/* Product Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        {/* Primary */}
        <img
          src={getImageUrl(mainImagePath)}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => { e.target.src = '/placeholder-product.svg' }}
        />
        {/* Hover swap (second image) */}
        {hoverImagePath && hoverImagePath !== mainImagePath && (
          <img
            src={getImageUrl(hoverImagePath)}
            alt={`${product.name} alt`}
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        )}
        {product.discount && product.discount > 0 && (
          <div className="absolute top-3 left-3 bg-gradient-to-r from-red-500 to-red-600 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-lg">
            -{product.discount}%
          </div>
        )}
        {selectionEnabled && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect && onToggleSelect() }}
            className={`absolute top-3 right-3 h-7 w-7 rounded-md border-2 flex items-center justify-center shadow-sm ${selected ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-300 text-transparent'}`}
            aria-pressed={selected}
            aria-label={selected ? 'Deselect product' : 'Select product'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}
        {/* Mini thumbnails indicator */}
        {images.length > 1 && (
          <div className="absolute bottom-2 right-2 flex gap-1 bg-white/70 backdrop-blur-sm rounded px-1.5 py-1 shadow-sm">
            {images.slice(0,3).map((img, i) => (
              <span key={i} className="block h-2 w-2 rounded-full" style={{ background: i===0? '#fb923c' : '#cbd5e1' }} />
            ))}
          </div>
        )}
        {(!product.inStock || product.stockQty === 0) && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="bg-white text-gray-900 px-3 py-1 rounded-full text-sm font-semibold">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-3 sm:p-4">
        {/* Product Name */}
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors text-sm sm:text-base leading-tight">
          {product.name}
        </h3>

        {/* Rating */}
        {product.rating && (
          <div className="flex items-center mb-2">
            <div className="flex items-center">
              {renderStars(product.rating)}
            </div>
            <span className="ml-1.5 text-xs sm:text-sm text-gray-600">
              ({product.reviewCount || 0})
            </span>
          </div>
        )}

        {/* Price */}
        <div className="mb-3">
          {product.discount && product.discount > 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1">
              <span className="text-lg sm:text-xl font-bold text-red-600">
                {formatPrice(getConvertedPrice(product.price * (1 - product.discount / 100)), getDisplayCurrency())}
              </span>
              <span className="text-xs sm:text-sm text-gray-500 line-through">
                {formatPrice(getConvertedPrice(product.price), getDisplayCurrency())}
              </span>
            </div>
          ) : (
            <span className="text-lg sm:text-xl font-bold text-gray-900">
              {formatPrice(getConvertedPrice(product.price), getDisplayCurrency())}
            </span>
          )}
        </div>

        {/* Stock Status */}
        <div className="mb-3">
          {product.inStock && product.stockQty > 0 ? (
            <span className="text-xs sm:text-sm text-green-600 font-medium flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              In Stock ({product.stockQty} available)
            </span>
          ) : (
            <span className="text-xs sm:text-sm text-red-600 font-medium flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              Out of Stock
            </span>
          )}
        </div>

        {/* Add to Cart Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-gray-300 rounded-lg h-9 overflow-hidden">
            <button
              className={`h-full w-9 flex items-center justify-center transition-colors ${qty <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
              onClick={(e) => { e.stopPropagation(); if (qty > 1) setQty(qty - 1) }}
              disabled={qty <= 1}
              aria-label="Decrease quantity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="px-3 text-sm font-medium min-w-[2.5rem] text-center select-none">{qty}</span>
            <button
              className={`h-full w-9 flex items-center justify-center transition-colors ${Number(product.stockQty) > 0 && qty >= Number(product.stockQty) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
              onClick={(e) => {
                e.stopPropagation()
                const max = Number(product.stockQty)
                if (max > 0 && qty >= max) return
                setQty(qty + 1)
              }}
              disabled={Number(product.stockQty) > 0 && qty >= Number(product.stockQty)}
              aria-label="Increase quantity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={!product.inStock || product.stockQty === 0}
            className="flex-1 min-w-[120px] sm:min-w-[140px] h-9 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
          >
            {!product.inStock || product.stockQty === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}