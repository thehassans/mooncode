import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductCard from '../../components/ecommerce/ProductCard'
import Header from '../../components/layout/Header'
import ShoppingCart from '../../components/ecommerce/ShoppingCart'
import { useToast } from '../../ui/Toast'
import { trackPageView, trackSearch, trackFilterUsage, trackSortUsage } from '../../utils/analytics'
import { apiGet } from '../../api'
import CategoryFilter from '../../components/ecommerce/CategoryFilter'
import SearchBar from '../../components/ecommerce/SearchBar'
import CountrySelector, { countries } from '../../components/ecommerce/CountrySelector'

export default function ProductCatalog() {
  const toast = useToast()
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  
  // Filter states
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState(() => {
    try { return localStorage.getItem('selected_country') || 'SA' } catch { return 'SA' }
  }) // Default to KSA
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const productsPerPage = 12
  const [isCartOpen, setIsCartOpen] = useState(false)
  // Multi-select state
  const [selectedMap, setSelectedMap] = useState({}) // { [productId]: product }

 // Load products when filters change
  useEffect(() => {
    loadProducts()
    // Track page view
    trackPageView('/products', 'Product Catalog')
  }, [selectedCategory, searchQuery, sortBy, currentPage, selectedCountry])

  // Persist selected country for use on product detail/cart
  useEffect(() => {
    try { localStorage.setItem('selected_country', selectedCountry) } catch {}
  }, [selectedCountry])

  // Filter and sort products when dependencies change
  useEffect(() => {
    // Reset to first page when filters change
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [selectedCategory, searchQuery, sortBy, selectedCountry])

  const loadProducts = async () => {
    try {
      setLoading(true)
      
      // Build query parameters
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') params.append('category', selectedCategory)
      if (searchQuery.trim()) params.append('search', searchQuery.trim())
      if (sortBy) params.append('sort', sortBy)
      params.append('page', currentPage.toString())
      params.append('limit', '12')
      
      const response = await apiGet(`/api/products/public?${params.toString()}`)
      if (response?.products) {
        // Filter products by selected country availability
        const selectedCountryName = countries.find(c => c.code === selectedCountry)?.name
        const filteredByCountry = response.products.filter(product => {
          // If product has no availableCountries array, show it (backward compatibility)
          if (!product.availableCountries || product.availableCountries.length === 0) {
            return true
          }
          // Check if the selected country is in the product's available countries
          return product.availableCountries.includes(selectedCountryName)
        })
        
        setProducts(filteredByCountry)
        // Update pagination to reflect filtered results
        const filteredPagination = {
          ...response.pagination,
          total: filteredByCountry.length,
          pages: Math.ceil(filteredByCountry.length / 12)
        }
        setPagination(filteredPagination)
      }
    } catch (error) {
      console.error('Failed to load products:', error)
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortProducts = () => {
    let filtered = [...products]

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.brand?.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
      )
    }

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'price':
          return (a.onSale ? a.salePrice : a.price) - (b.onSale ? b.salePrice : b.price)
        case 'price-desc':
          return (b.onSale ? b.salePrice : b.price) - (a.onSale ? a.salePrice : a.price)
        case 'rating':
          return (b.rating || 0) - (a.rating || 0)
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt)
        case 'featured':
          return (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
        default:
          return 0
      }
    })

    setFilteredProducts(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }

  const getProductCounts = () => {
    const counts = {}
    products.forEach(product => {
      counts[product.category] = (counts[product.category] || 0) + 1
    })
    return counts
  }

  const handleCategoryChange = (category) => {
    setSelectedCategory(category)
    setCurrentPage(1)
    // Track filter usage
    trackFilterUsage('category', category)
  }

  const handleSearch = (query) => {
    setSearchQuery(query)
    setCurrentPage(1)
    // Track search event
    trackSearch(query, filteredProducts.length)
  }

  const handleAddToCart = (product) => {
    // ProductCard stores item in localStorage; just open cart panel
    setIsCartOpen(true)
  }

  // Calculate pagination for display
  const totalPages = pagination?.pages || 1
  const totalProducts = pagination?.total || 0

  const paginate = (pageNumber) => setCurrentPage(pageNumber)

  // Currency helpers and multi-select utilities (component scope)
  const RATES = {
    SAR: { SAR: 1, AED: 0.98, OMR: 0.10, BHD: 0.10 },
    AED: { SAR: 1.02, AED: 1, OMR: 0.10, BHD: 0.10 },
    OMR: { SAR: 9.78, AED: 9.58, OMR: 1, BHD: 0.98 },
    BHD: { SAR: 9.94, AED: 9.74, OMR: 1.02, BHD: 1 },
  }
  const COUNTRY_TO_CURRENCY = { AE: 'AED', OM: 'OMR', SA: 'SAR', BH: 'BHD' }
  const getDisplayCurrency = () => COUNTRY_TO_CURRENCY[selectedCountry] || 'SAR'
  const convertPrice = (value, fromCurrency, toCurrency) => {
    const v = Number(value || 0)
    if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return v
    const rate = RATES[fromCurrency]?.[toCurrency]
    return rate ? v * rate : v
  }
  const formatPrice = (price, currency = 'SAR') => new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(price||0))
  const effectiveUnit = (p) => {
    const base = Number(p?.price) || 0
    const discounted = Number(p?.discount) > 0 ? base * (1 - Number(p.discount)/100) : base
    return (p?.onSale && (p?.salePrice ?? null) != null) ? Number(p.salePrice)||discounted : discounted
  }
  const selectedList = Object.values(selectedMap)
  const selectedCount = selectedList.length
  const selectedTotal = selectedList.reduce((sum, p) => {
    const unit = effectiveUnit(p)
    const from = p.baseCurrency || 'SAR'
    return sum + convertPrice(unit, from, getDisplayCurrency())
  }, 0)
  const toggleSelect = (product) => {
    setSelectedMap(prev => {
      const next = { ...prev }
      if (next[product._id]) delete next[product._id]
      else next[product._id] = product
      return next
    })
  }
  const clearSelected = () => setSelectedMap({})
  const addSelectedToCart = () => {
    if (selectedCount === 0) return
    try {
      const savedCart = localStorage.getItem('shopping_cart')
      let cartItems = []
      if (savedCart) cartItems = JSON.parse(savedCart)
      selectedList.forEach((p, idx) => {
        const unit = effectiveUnit(p)
        const id = p._id
        const existingIndex = cartItems.findIndex(it => it.id === id)
        const max = Number(p?.stockQty || 0)
        const addQty = 1
        if (existingIndex >= 0) {
          const current = Number(cartItems[existingIndex].quantity || 0)
          const candidate = current + addQty
          cartItems[existingIndex].quantity = (max > 0 && candidate > max) ? max : candidate
          cartItems[existingIndex].price = unit
          cartItems[existingIndex].currency = p.baseCurrency || 'SAR'
          cartItems[existingIndex].maxStock = p.stockQty
        } else {
          cartItems.push({
            id,
            name: p.name,
            price: unit,
            currency: p.baseCurrency || 'SAR',
            image: (Array.isArray(p.images) && p.images.length ? p.images[0] : (p.imagePath || '')),
            quantity: Math.max(1, Math.min(max > 0 ? max : addQty, addQty)),
            maxStock: p.stockQty
          })
        }
        if (idx === selectedList.length - 1) {
          try { localStorage.setItem('last_added_product', String(id)) } catch {}
        }
      })
      localStorage.setItem('shopping_cart', JSON.stringify(cartItems))
      try { window.dispatchEvent(new CustomEvent('cartUpdated')) } catch {}
      toast.success(`Added ${selectedCount} item(s) to cart`)
      setIsCartOpen(true)
      clearSelected()
    } catch (e) {
      console.error('Bulk add failed', e)
      toast.error('Failed to add selected items')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onCartClick={() => setIsCartOpen(true)} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Products</h1>
            <p className="text-gray-600">Discover our amazing collection of products</p>
          </div>
          <div className="flex items-center gap-4">
            <CountrySelector 
              selectedCountry={selectedCountry}
              onCountryChange={(country) => setSelectedCountry(country.code)}
            />
          </div>
        </div>
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            {/* Search */}
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 text-gray-500"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Category Filter */}
            <div className="w-full sm:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {Object.keys(getProductCounts()).map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Sort */}
            <div className="w-full sm:w-48">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value)
                  // Track sort usage
                  trackSortUsage(e.target.value)
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="name">Name (A → Z)</option>
                <option value="name-desc">Name (Z → A)</option>
                <option value="price">Price (Low → High)</option>
                <option value="price-desc">Price (High → Low)</option>
                <option value="rating">Rating (High → Low)</option>
                <option value="newest">Newest</option>
                <option value="featured">Featured</option>
              </select>
            </div>
          </div>
        </div>

        {/* Mobile Filter Toggle */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center justify-between bg-white border border-gray-300 rounded-lg px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707v4.586a1 1 0 01-.293.707L9 19.414V13.414a1 1 0 00-.293-.707L2.293 6.293A1 1 0 012 5.586V4z" />
              </svg>
              <span className="font-medium text-gray-900">Filters & Categories</span>
            </div>
            <svg 
              className={`w-5 h-5 text-gray-500 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div className="flex gap-8">
          {/* Sidebar - Categories */}
          <div className={`w-64 flex-shrink-0 ${showFilters ? 'block' : 'hidden'} lg:block`}>
            <div className="sticky top-4">
              <CategoryFilter
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                productCounts={getProductCounts()}
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <p className="text-red-700">{error}</p>
                <button
                  onClick={loadProducts}
                  className="mt-2 text-red-600 hover:text-red-800 font-medium"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Results Summary */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-600">
                Showing {products.length} of {totalProducts} products
                {selectedCategory !== 'all' && ` in ${selectedCategory}`}
                {searchQuery && ` matching "${searchQuery}"`}
              </p>
            </div>

            {/* Products Grid */}
            {products.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📦</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600">
                  {searchQuery || selectedCategory !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'No products available at the moment'
                  }
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-6 mb-24">
                  {products.map((product) => (
                    <ProductCard
                      key={product._id}
                      product={product}
                      selectedCountry={selectedCountry}
                      onAddToCart={handleAddToCart}
                      isSelected={!!selectedMap[product._id]}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center">
                    <nav className="flex items-center gap-1 sm:gap-2">
                      <button
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-2 sm:px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                      >
                        <span className="hidden sm:inline">Previous</span>
                        <span className="sm:hidden">‹</span>
                      </button>
                      
                      {/* Mobile: Show fewer page numbers */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(number => {
                          // On mobile, show first, last, current, and adjacent pages
                          if (window.innerWidth < 640) {
                            return number === 1 || 
                                   number === totalPages || 
                                   Math.abs(number - currentPage) <= 1
                          }
                          return true
                        })
                        .map((number, index, array) => {
                          // Add ellipsis for gaps
                          const showEllipsis = index > 0 && number - array[index - 1] > 1
                          return (
                            <React.Fragment key={number}>
                              {showEllipsis && (
                                <span className="px-2 py-2 text-gray-500">...</span>
                              )}
                              <button
                                onClick={() => paginate(number)}
                                className={`px-2 sm:px-3 py-2 rounded-md border text-sm sm:text-base ${
                                  currentPage === number
                                    ? 'bg-orange-500 text-white border-orange-500'
                                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {number}
                              </button>
                            </React.Fragment>
                          )
                        })}
                      
                      <button
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-2 sm:px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <span className="sm:hidden">›</span>
                      </button>
                    </nav>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Key Features Section */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Us</h2>
            <p className="text-lg text-gray-600">Experience the best shopping with our premium services</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Free Shipping */}
            <div className="text-center">
              <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Free Shipping</h3>
              <p className="text-gray-600">Free delivery on orders over 100 SAR across all GCC countries</p>
            </div>

            {/* Quality Product */}
            <div className="text-center">
              <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Quality Product</h3>
              <p className="text-gray-600">Premium quality products sourced from trusted manufacturers</p>
            </div>

            {/* Secure Payment */}
            <div className="text-center">
              <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Secure Payment</h3>
              <p className="text-gray-600">Your payment information is protected with bank-level security</p>
            </div>

            {/* 24/7 Support */}
            <div className="text-center">
              <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 109.75 9.75A9.75 9.75 0 0012 2.25z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">24/7 Support</h3>
              <p className="text-gray-600">Round-the-clock customer support to help you anytime</p>
            </div>
          </div>
        </div>
      </div>

      {/* Shopping Cart Sidebar */}
      <ShoppingCart 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
      />

      {/* Sticky Add Selected Bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl">
          <div className="bg-white border border-gray-200 shadow-xl rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-orange-100 text-orange-700 font-semibold">
                {selectedCount}
              </span>
              <div>
                <div className="text-sm font-semibold text-gray-900">{selectedCount} selected</div>
                <div className="text-xs text-gray-500">{formatPrice(selectedTotal, getDisplayCurrency())} total</div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium w-full sm:w-auto"
                onClick={clearSelected}
              >
                Clear
              </button>
              <button
                className="flex-1 sm:flex-none px-5 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 font-semibold shadow-md"
                onClick={addSelectedToCart}
              >
                Add Selected to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )