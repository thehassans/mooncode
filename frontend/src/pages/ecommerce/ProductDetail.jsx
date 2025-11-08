import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiGet, API_BASE } from '../../api'
import { detectCountryCode } from '../../utils/geo'
import { useToast } from '../../ui/Toast'
import Header from '../../components/layout/Header'
import ShoppingCart from '../../components/ecommerce/ShoppingCart'
import { trackPageView, trackProductView, trackAddToCart } from '../../utils/analytics'
import { getCurrencyConfig, convert as fxConvert } from '../../util/currency'

const ProductDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('description')
  const [zoomedImage, setZoomedImage] = useState(null)
  const [reviews, setReviews] = useState([])
  const [newReview, setNewReview] = useState({ rating: 5, comment: '', name: '' })
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [ccyCfg, setCcyCfg] = useState(null)

  // Country selection (persisted from catalog via localStorage)
  const [selectedCountry, setSelectedCountry] = useState(() => {
    try { return localStorage.getItem('selected_country') || 'SA' } catch { return 'SA' }
  })
  useEffect(() => {
    try {
      const s = localStorage.getItem('selected_country')
      if (s) setSelectedCountry(s)
    } catch {}
  }, [])

  // On first visit: auto-detect if no selection persisted
  useEffect(() => {
    (async () => {
      try {
        const saved = localStorage.getItem('selected_country')
        if (!saved) {
          const code = await detectCountryCode()
          setSelectedCountry(code)
          try { localStorage.setItem('selected_country', code) } catch {}
        }
      } catch {}
    })()
  }, [])

  // Load currency config
  useEffect(()=>{ let alive=true; getCurrencyConfig().then(cfg=>{ if(alive) setCcyCfg(cfg) }).catch(()=>{}); return ()=>{alive=false} },[])

  const COUNTRY_TO_CURRENCY = { AE: 'AED', OM: 'OMR', SA: 'SAR', BH: 'BHD', IN: 'INR', KW: 'KWD', QA: 'QAR' }
  const getDisplayCurrency = () => COUNTRY_TO_CURRENCY[selectedCountry] || 'SAR'
  const convertPrice = (value, fromCurrency, toCurrency) => fxConvert(value, fromCurrency||'SAR', toCurrency||getDisplayCurrency(), ccyCfg)
  const formatPrice = (price, currency = 'SAR') => new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(price||0))

  useEffect(() => {
    if (id) {
      loadProduct()
      loadReviews()
    }
  }, [id])

  useEffect(() => {
    if (product) {
      // Track page view and product view
      trackPageView(`/product/${id}`, `Product: ${product.name}`)
      trackProductView(product.id, product.name, product.category, product.price)
      
      // Initialize variants if available
      if (product.variants) {
        const initialVariants = {}
        Object.keys(product.variants).forEach(variantType => {
          if (product.variants[variantType].length > 0) {
            initialVariants[variantType] = product.variants[variantType][0]
          }
        })
        setSelectedVariants(initialVariants)
      }
    }
  }, [product, id])

  const loadProduct = async () => {
    try {
      setLoading(true)
      const response = await apiGet(`/api/products/public/${id}`)
      if (response?.product) {
        // Enhance product data without variants
        const enhancedProduct = {
          ...response.product,
          images: response.product.images || [response.product.imagePath || '/placeholder-product.svg']
        }
        setProduct(enhancedProduct)
      } else {
        toast.error('Product not found')
        navigate('/products')
      }
    } catch (error) {
      console.error('Error loading product:', error)
      toast.error('Failed to load product')
      navigate('/products')
    } finally {
      setLoading(false)
    }
  }

  const loadReviews = async () => {
    try {
      // Mock reviews data - in a real app, this would be an API call
      const mockReviews = [
        {
          id: 1,
          name: 'Sarah Johnson',
          rating: 5,
          comment: 'Excellent product! Great quality and fast shipping.',
          date: '2024-01-15',
          verified: true
        },
        {
          id: 2,
          name: 'Mike Chen',
          rating: 4,
          comment: 'Good value for money. Would recommend to others.',
          date: '2024-01-10',
          verified: true
        },
        {
          id: 3,
          name: 'Emma Wilson',
          rating: 5,
          comment: 'Perfect fit and amazing quality. Exceeded my expectations!',
          date: '2024-01-08',
          verified: false
        }
      ]
      setReviews(mockReviews)
    } catch (error) {
      console.error('Error loading reviews:', error)
    }
  }

  const handleAddToCart = () => {
    if (!product) return
    
    try {
      const savedCart = localStorage.getItem('shopping_cart')
      let cartItems = []
      
      if (savedCart) {
        cartItems = JSON.parse(savedCart)
      }
      
      const existingItemIndex = cartItems.findIndex(item => item.id === product._id)
      const max = Number(product?.stockQty || 0)
      const unitPrice = Number(product?.onSale ? (product?.salePrice ?? product?.price) : product?.price) || 0
      const addQty = Math.max(1, Math.floor(Number(quantity) || 1))
      
      if (existingItemIndex >= 0) {
        const current = Number(cartItems[existingItemIndex].quantity || 0)
        const candidate = current + addQty
        if (max > 0 && candidate > max) {
          cartItems[existingItemIndex].quantity = max
        } else {
          cartItems[existingItemIndex].quantity = candidate
        }
      } else {
        cartItems.push({
          id: product._id,
          name: product.name,
          price: unitPrice,
          currency: product.baseCurrency || 'SAR',
          image: (Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : (product.imagePath || '')),
          quantity: Math.max(1, Math.min(max > 0 ? max : addQty, addQty)),
          maxStock: product.stockQty
        })
      }
      
      localStorage.setItem('shopping_cart', JSON.stringify(cartItems))
      try { localStorage.setItem('last_added_product', String(product._id)) } catch {}
      
      // Track add to cart
      trackAddToCart(product._id, product.name, product.category, unitPrice, addQty)
      
      // Dispatch custom event to update cart count in header
      window.dispatchEvent(new CustomEvent('cartUpdated'))
      
      toast.success(`Added ${addQty} ${product.name} to cart`)
      setIsCartOpen(true)
    } catch (error) {
      console.error('Error adding to cart:', error)
      toast.error('Failed to add item to cart')
    }
  }

  const handleReviewSubmit = (e) => {
    e.preventDefault()
    if (!newReview.name.trim() || !newReview.comment.trim()) {
      toast.error('Please fill in all fields')
      return
    }

    const review = {
      id: reviews.length + 1,
      name: newReview.name,
      rating: newReview.rating,
      comment: newReview.comment,
      date: new Date().toISOString().split('T')[0],
      verified: false
    }

    setReviews(prev => [review, ...prev])
    setNewReview({ rating: 5, comment: '', name: '' })
    setShowReviewForm(false)
    toast.success('Review submitted successfully!')
  }

  const calculateAverageRating = () => {
    if (reviews.length === 0) return 0
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0)
    return (sum / reviews.length).toFixed(1)
  }

  const handleBuyNow = () => {
    handleAddToCart()
    setIsCartOpen(true)
  }

  const renderStars = (rating) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

    // Full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <svg key={`full-${i}`} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
        </svg>
      )
    }

    // Half star
    if (hasHalfStar) {
      stars.push(
        <svg key="half" className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
          <defs>
            <linearGradient id="half">
              <stop offset="50%" stopColor="currentColor"/>
              <stop offset="50%" stopColor="transparent"/>
            </linearGradient>
          </defs>
          <path fill="url(#half)" d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
        </svg>
      )
    }

    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <svg key={`empty-${i}`} className="w-4 h-4 text-gray-300 fill-current" viewBox="0 0 20 20">
          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
        </svg>
      )
    }

    return stars
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-gray-300 rounded-lg h-96"></div>
              <div className="space-y-4">
                <div className="h-8 bg-gray-300 rounded w-3/4"></div>
                <div className="h-6 bg-gray-300 rounded w-1/2"></div>
                <div className="h-10 bg-gray-300 rounded w-1/4"></div>
                <div className="h-12 bg-gray-300 rounded w-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Product not found</h1>
            <p className="mt-2 text-gray-600">The product you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    )
  }

  // Handle multiple image sources with fallbacks and resolve uploaded paths to absolute URLs
  const resolveImageUrl = (u) => {
    if (!u) return '/placeholder-product.svg'
    if (typeof u !== 'string') return '/placeholder-product.svg'
    if (u.startsWith('http')) return u
    if (u.startsWith('/uploads/')) return `${API_BASE}${u}`
    return u
  }
  const images = (product.images && product.images.length > 0 
    ? product.images 
    : (product.imagePath ? [product.imagePath] : ['/placeholder-product.svg'])
  ).map(resolveImageUrl)
  
  const originalPrice = product.onSale ? product.originalPrice : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header onCartClick={() => setIsCartOpen(true)} />
      
      {/* Breadcrumb Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex items-center space-x-2 text-sm text-gray-600">
          <button 
            onClick={() => navigate('/catalog')}
            className="hover:text-blue-600 transition-colors"
          >
            Products
          </button>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 font-medium truncate">{product.name}</span>
        </nav>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Product Images */}
            <div className="p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-gray-50 to-white">
              <div className="sticky top-4">
                <div className="relative aspect-square bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100 mb-4 group">
                  {loading ? (
                    <div className="w-full h-full bg-gray-300 animate-pulse"></div>
                  ) : (
                    <img
                      src={zoomedImage || images[selectedImage] || '/placeholder-product.svg'}
                      alt={product.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300 cursor-zoom-in"
                      onClick={() => setZoomedImage(zoomedImage || images[selectedImage] || '/placeholder-product.svg')}
                      onError={(e) => {
                        console.log('Image failed to load:', e.target.src)
                        e.target.src = '/placeholder-product.svg'
                      }}
                      onLoad={() => {
                        console.log('Image loaded successfully:', images[selectedImage])
                      }}
                    />
                  )}
                  {product.onSale && (
                    <div className="absolute top-4 left-4">
                      <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg">
                        SALE
                      </span>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 flex space-x-2">
                    <button className="p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition-colors">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                    <button className="p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition-colors">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {images.length > 1 && (
                  <div className="flex space-x-3 overflow-x-auto pb-2">
                    {images.map((image, index) => (
                      <button
                        key={index}
                        className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                          selectedImage === index 
                            ? 'border-blue-500 shadow-lg scale-105' 
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                        }`}
                        onClick={() => {
                          setSelectedImage(index)
                          setZoomedImage(image)
                        }}
                      >
                        <img
                          src={image || '/placeholder-product.svg'}
                          alt={`${product.name} ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.log('Thumbnail image failed to load:', e.target.src)
                            e.target.src = '/placeholder-product.svg'
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Product Features */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mt-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Key Features
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center text-gray-700">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Free Shipping
                    </div>
                    <div className="flex items-center text-gray-700">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Secure Payment
                    </div>
                    <div className="flex items-center text-gray-700">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      24/7 Support
                    </div>
                    <div className="flex items-center text-gray-700">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Quality Assured
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Info */}
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
              {/* Brand and SKU */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                {product.brand && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {product.brand}
                  </span>
                )}
                {product.sku && (
                  <span className="text-xs text-gray-500 font-mono">SKU: {product.sku}</span>
                )}
              </div>
              
              {/* Product Name */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                {product.name}
              </h1>
              
              {/* Rating - Hidden for now */}

              {/* Price Section */}
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-3xl sm:text-4xl font-bold text-gray-900">
                      {formatPrice(
                        convertPrice(product.price, product.baseCurrency || 'SAR', getDisplayCurrency()),
                        getDisplayCurrency()
                      )}
                    </span>
                    {originalPrice && (
                      <span className="text-xl text-gray-500 line-through">
                        {formatPrice(
                          convertPrice(originalPrice, product.baseCurrency || 'SAR', getDisplayCurrency()),
                          getDisplayCurrency()
                        )}
                      </span>
                    )}
                  </div>
                  {originalPrice && (
                    <div className="text-right">
                      <p className="text-sm text-green-600 font-semibold">
                        {formatPrice(
                          convertPrice(originalPrice - product.price, product.baseCurrency || 'SAR', getDisplayCurrency()),
                          getDisplayCurrency()
                        )} saved
                      </p>
                      <p className="text-xs text-green-500">
                        {Math.round(((originalPrice - product.price) / originalPrice) * 100)}% off
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Stock Status */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                {product.stockQty > 0 ? (
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                      <span className="text-sm text-green-600 font-semibold">
                        In Stock
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {product.stockQty} available {product.stockQty <= 5 ? '(Low stock)' : ''}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 bg-red-400 rounded-full"></span>
                    <span className="text-sm text-red-600 font-semibold">Out of Stock</span>
                  </div>
                )}
              </div>

              {/* Quantity and Actions */}
              {product.stockQty > 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-lg font-semibold text-gray-900 mb-2">Quantity</label>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="text-xl font-semibold text-gray-900 min-w-[3rem] text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => {
                          const max = Number(product?.stockQty || 0)
                          if (max > 0 && quantity >= max) return
                          setQuantity(quantity + 1)
                        }}
                        className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                        disabled={Number(product?.stockQty || 0) > 0 && quantity >= Number(product.stockQty)}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleAddToCart}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                      <span className="flex items-center justify-center space-x-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 11-4 0v-6m4 0V9a2 2 0 10-4 0v4.01" />
                        </svg>
                        <span>Add to Cart</span>
                      </span>
                    </button>
                    <button
                      onClick={handleBuyNow}
                      className="flex-1 bg-gradient-to-r from-gray-800 to-gray-900 text-white px-6 py-4 rounded-xl font-semibold hover:from-gray-900 hover:to-black focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                      <span className="flex items-center justify-center space-x-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Buy Now</span>
                      </span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Product Details Tabs */}
          <div className="border-t border-gray-200">
            <div className="flex border-b border-gray-200 overflow-x-auto">
              <button
                className={`py-4 px-6 sm:px-8 border-b-2 font-bold text-base whitespace-nowrap transition-all ${
                  activeTab === 'description'
                    ? 'border-orange-500 text-orange-600 bg-gradient-to-t from-orange-50 to-transparent'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('description')}
              >
                Description
              </button>
              <button
                className={`py-4 px-6 sm:px-8 border-b-2 font-bold text-base whitespace-nowrap transition-all ${
                  activeTab === 'reviews'
                    ? 'border-orange-500 text-orange-600 bg-gradient-to-t from-orange-50 to-transparent'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('reviews')}
              >
                Reviews ({reviews.length})
              </button>
            </div>

            <div className="p-4 sm:p-6 lg:p-8">
              {activeTab === 'description' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                      <svg className="w-7 h-7 text-orange-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Product Description
                    </h3>
                    <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 rounded-2xl p-8 border border-orange-100 shadow-sm">
                      <p className="text-gray-800 leading-relaxed text-lg mb-6">{product.description}</p>
                      
                      {/* Additional premium description content */}
                      <div className="grid md:grid-cols-2 gap-6 mt-8 pt-6 border-t border-orange-200">
                        <div>
                          <h4 className="font-bold text-gray-900 mb-3 flex items-center">
                            <svg className="w-5 h-5 text-orange-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Key Benefits
                          </h4>
                          <ul className="space-y-2 text-gray-700">
                            <li className="flex items-start">
                              <span className="text-orange-500 mr-2">•</span>
                              <span>Premium quality product</span>
                            </li>
                            <li className="flex items-start">
                              <span className="text-orange-500 mr-2">•</span>
                              <span>Authentic and verified</span>
                            </li>
                            <li className="flex items-start">
                              <span className="text-orange-500 mr-2">•</span>
                              <span>Fast and secure delivery</span>
                            </li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 mb-3 flex items-center">
                            <svg className="w-5 h-5 text-orange-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                            </svg>
                            Why Choose Us
                          </h4>
                          <ul className="space-y-2 text-gray-700">
                            <li className="flex items-start">
                              <span className="text-orange-500 mr-2">•</span>
                              <span>Trusted by thousands</span>
                            </li>
                            <li className="flex items-start">
                              <span className="text-orange-500 mr-2">•</span>
                              <span>100% customer satisfaction</span>
                            </li>
                            <li className="flex items-start">
                              <span className="text-orange-500 mr-2">•</span>
                              <span>Best price guarantee</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {product.tags && product.tags.length > 0 && (
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-4">Product Tags</h4>
                      <div className="flex flex-wrap gap-3">
                        {product.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 hover:from-orange-200 hover:to-amber-200 transition-all shadow-sm hover:shadow-md"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                      <svg className="w-7 h-7 text-orange-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                      Customer Reviews
                    </h3>
                    <button
                      onClick={() => setShowReviewForm(!showReviewForm)}
                      className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-3 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all flex items-center space-x-2 shadow-lg hover:shadow-xl font-semibold"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span>Write Review</span>
                    </button>
                  </div>

                  {/* Review Summary */}
                  <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 rounded-2xl p-8 border border-orange-100 shadow-sm">
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-gray-900">{calculateAverageRating()}</div>
                        <div className="flex items-center justify-center space-x-1 mt-1">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`w-5 h-5 ${
                                i < Math.floor(calculateAverageRating()) ? 'text-yellow-400' : 'text-gray-300'
                              }`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">{reviews.length} reviews</div>
                      </div>
                      <div className="flex-1">
                        {[5, 4, 3, 2, 1].map((rating) => {
                          const count = reviews.filter(r => r.rating === rating).length
                          const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                          return (
                            <div key={rating} className="flex items-center space-x-2 mb-1">
                              <span className="text-sm text-gray-600 w-8">{rating}★</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-yellow-400 h-2 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-600 w-8">{count}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Review Form */}
                  {showReviewForm && (
                    <form onSubmit={handleReviewSubmit} className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-8 space-y-6 border border-orange-100 shadow-sm">
                      <h4 className="text-xl font-bold text-gray-900">Write a Review</h4>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                        <input
                          type="text"
                          value={newReview.name}
                          onChange={(e) => setNewReview(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter your name"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              type="button"
                              onClick={() => setNewReview(prev => ({ ...prev, rating }))}
                              className={`w-8 h-8 ${
                                rating <= newReview.rating ? 'text-yellow-400' : 'text-gray-300'
                              } hover:text-yellow-400 transition-colors`}
                            >
                              <svg fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Your Review</label>
                        <textarea
                          value={newReview.comment}
                          onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Share your experience with this product..."
                          required
                        />
                      </div>
                      <div className="flex space-x-3">
                        <button
                          type="submit"
                          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-8 py-3 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all font-semibold shadow-lg hover:shadow-xl"
                        >
                          Submit Review
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowReviewForm(false)}
                          className="bg-gray-200 text-gray-700 px-8 py-3 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Reviews List */}
                  <div className="space-y-5">
                    {reviews.length > 0 ? (
                      reviews.map((review) => (
                        <div key={review.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center space-x-2">
                                <h5 className="font-semibold text-gray-900">{review.name}</h5>
                                {review.verified && (
                                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                    Verified Purchase
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-1 mt-1">
                                {[...Array(5)].map((_, i) => (
                                  <svg
                                    key={i}
                                    className={`w-4 h-4 ${
                                      i < review.rating ? 'text-yellow-400' : 'text-gray-300'
                                    }`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                              </div>
                            </div>
                            <span className="text-sm text-gray-500">{review.date}</span>
                          </div>
                          <p className="text-gray-700 leading-relaxed">{review.comment}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-orange-50 rounded-2xl border border-gray-200">
                        <svg className="w-20 h-20 text-orange-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <h4 className="text-xl font-bold text-gray-900 mb-2">No Reviews Yet</h4>
                        <p className="text-gray-600 mb-6">Be the first to review this product!</p>
                        <button
                          onClick={() => setShowReviewForm(true)}
                          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-8 py-3 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all font-semibold shadow-lg hover:shadow-xl inline-flex items-center space-x-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          <span>Write First Review</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Shopping Cart Sidebar */}
      <ShoppingCart 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
      />
    </div>
  )
}

export default ProductDetail