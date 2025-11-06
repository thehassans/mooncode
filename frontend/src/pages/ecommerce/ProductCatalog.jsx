import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ProductCard from '../../components/ecommerce/ProductCard'
import Header from '../../components/layout/Header'
import ShoppingCart from '../../components/ecommerce/ShoppingCart'
import { useToast } from '../../ui/Toast'
import { trackPageView, trackSearch, trackFilterUsage, trackSortUsage } from '../../utils/analytics'
import { apiGet } from '../../api'
import { detectCountryCode } from '../../utils/geo'
import CategoryFilter from '../../components/ecommerce/CategoryFilter'
import SearchBar from '../../components/ecommerce/SearchBar'
import CountrySelector, { countries } from '../../components/ecommerce/CountrySelector'

function BannerCarousel({ images=[] }){
  const [index, setIndex] = useState(0)
  const touchStartX = useRef(0)
  const slides = (Array.isArray(images) && images.length) ? images : ['/banners/banner1.jpg.png','/banners/banner2.jpg.png','/banners/banner3.jpg.png']
  const N = slides.length
  useEffect(()=>{
    const id = setInterval(()=> setIndex(i => (i+1)%N), 5000)
    return ()=> clearInterval(id)
  }, [N])
  const prev = ()=> setIndex(i => (i-1+N)%N)
  const next = ()=> setIndex(i => (i+1)%N)
  const onTouchStart = (e)=>{ try{ touchStartX.current = e.touches[0].clientX }catch{} }
  const onTouchEnd = (e)=>{ try{ const dx = e.changedTouches[0].clientX - touchStartX.current; if (Math.abs(dx) > 40){ if (dx < 0) next(); else prev(); } }catch{} }
  const fallback = '/BuySial2.png'
  return (
    <div className="relative rounded-xl overflow-hidden shadow-sm group select-none" role="region" aria-label="Promotions">
      {/* Fixed aspect ratio to keep uniform size across images */}
      <div className="relative w-full aspect-[16/7] bg-gray-200">
        {slides.map((src, i)=> (
          <img
            key={i}
            src={src}
            alt={`Banner ${i+1}`}
            onError={(e)=>{ if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback }}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${i===index? 'opacity-100':'opacity-0'}`}
            draggable={false}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          />
        ))}
      </div>
      {/* Arrows */}
      <button onClick={prev} aria-label="Previous banner" className="hidden sm:inline-flex absolute left-3 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white text-gray-700 w-9 h-9 rounded-full items-center justify-center shadow">
        ‹
      </button>
      <button onClick={next} aria-label="Next banner" className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white text-gray-700 w-9 h-9 rounded-full items-center justify-center shadow">
        ›
      </button>
      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {slides.map((_, i)=> (
          <button key={i} onClick={()=> setIndex(i)} aria-label={`Go to banner ${i+1}`} className={`w-2.5 h-2.5 rounded-full ${i===index? 'bg-white':'bg-white/60'}`}></button>
        ))}
      </div>
    </div>
  )
}

export default function ProductCatalog() {
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [categoryCounts, setCategoryCounts] = useState({})
  const [bannerImages, setBannerImages] = useState([])
  
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

  // Multi-select add-to-cart
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  const toggleSelectionMode = () => {
    setSelectionMode(prev => {
      const next = !prev
      if (!next) setSelectedIds(new Set())
      return next
    })
  }

  // Load category usage counts (public)
  useEffect(() => {
    let alive = true
    ;(async()=>{
      try{
        const res = await apiGet('/api/products/public/categories-usage')
        const counts = res?.counts || {}
        if (alive) setCategoryCounts(counts)
      }catch{
        if (alive) setCategoryCounts({})
      }
    })()
    return ()=>{ alive = false }
  }, [])
  
  // Load banners from API
  useEffect(() => {
    let alive = true
    ;(async()=>{
      try{
        const res = await apiGet('/api/settings/website/banners')
        const banners = res?.banners || []
        const activeBanners = banners.filter(b => b.active)
        if (alive && activeBanners.length > 0) {
          setBannerImages(activeBanners.map(b => b.imageUrl))
        } else {
          // Fallback to default banners if no banners uploaded
          if (alive) setBannerImages(['/banners/banner1.jpg.png','/banners/banner2.jpg.png','/banners/banner3.jpg.png'])
        }
      }catch{
        // Fallback to default banners on error
        if (alive) setBannerImages(['/banners/banner1.jpg.png','/banners/banner2.jpg.png','/banners/banner3.jpg.png'])
      }
    })()
    return ()=>{ alive = false }
  }, [])
  const toggleSelectFor = (id) => {
    setSelectedIds(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }
  const isSelected = (id) => selectedIds.has(id)
  const selectedCount = selectedIds.size

 // Load products when filters change
  useEffect(() => {
    loadProducts()
    // Track page view
    trackPageView('/products', 'Product Catalog')
  }, [selectedCategory, searchQuery, sortBy, currentPage, selectedCountry])

  // Read initial category/search from URL (and on URL change)
  useEffect(() => {
    const sp = new URLSearchParams(location.search)
    const cat = sp.get('category') || 'all'
    const q = sp.get('search') || ''
    if (cat !== selectedCategory) setSelectedCategory(cat)
    if (q !== searchQuery) setSearchQuery(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  // Keep URL in sync when user changes filters
  useEffect(() => {
    const sp = new URLSearchParams(location.search)
    let changed = false
    const currCat = sp.get('category') || 'all'
    const currQ = sp.get('search') || ''
    if ((selectedCategory || 'all') !== currCat){
      if (selectedCategory && selectedCategory !== 'all') sp.set('category', selectedCategory)
      else sp.delete('category')
      changed = true
    }
    if ((searchQuery || '') !== currQ){
      if (searchQuery && searchQuery.trim()) sp.set('search', searchQuery.trim())
      else sp.delete('search')
      changed = true
    }
    if (changed){
      navigate(`/catalog?${sp.toString()}`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchQuery])

  // Persist selected country for use on product detail/cart
  useEffect(() => {
    try { localStorage.setItem('selected_country', selectedCountry) } catch {}
  }, [selectedCountry])

  // On first visit: auto-detect country if none saved
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const getProductCounts = () => categoryCounts

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

  const addSelectedToCart = () => {
    try {
      let cartItems = []
      const saved = localStorage.getItem('shopping_cart')
      if (saved) cartItems = JSON.parse(saved)

      const ids = Array.from(selectedIds)
      if (ids.length === 0) { toast.info('No products selected'); return }
      let lastId = ''
      ids.forEach(id => {
        const p = products.find(pp => pp._id === id)
        if (!p) return
        const basePrice = Number(p?.price) || 0
        const discounted = Number(p?.discount) > 0 ? basePrice * (1 - Number(p.discount) / 100) : basePrice
        const unitPrice = Number(p?.onSale && (p?.salePrice ?? null) != null ? p.salePrice : discounted) || 0
        const max = Number(p?.stockQty || 0)
        const qty = 1
        const idx = cartItems.findIndex(ci => ci.id === id)
        if (idx >= 0) {
          const current = Number(cartItems[idx].quantity || 0)
          const candidate = current + qty
          cartItems[idx].quantity = max > 0 && candidate > max ? max : candidate
          cartItems[idx].price = unitPrice
          cartItems[idx].currency = p.baseCurrency || 'SAR'
          cartItems[idx].maxStock = p.stockQty
        } else {
          cartItems.push({
            id,
            name: p.name,
            price: unitPrice,
            currency: p.baseCurrency || 'SAR',
            image: (Array.isArray(p.images) && p.images.length ? p.images[0] : (p.imagePath || '')),
            quantity: Math.max(1, Math.min(max > 0 ? max : qty, qty)),
            maxStock: p.stockQty
          })
        }
        lastId = id
      })

      localStorage.setItem('shopping_cart', JSON.stringify(cartItems))
      try { localStorage.setItem('last_added_product', String(lastId)) } catch {}
      window.dispatchEvent(new CustomEvent('cartUpdated'))
      toast.success(`Added ${ids.length} product${ids.length>1?'s':''} to cart`)
      setIsCartOpen(true)
      setSelectionMode(false)
      setSelectedIds(new Set())
    } catch (e) {
      console.error('Failed to add selected to cart', e)
      toast.error('Failed to add selected items')
    }
  }

  // Calculate pagination for display
  const totalPages = pagination?.pages || 1
  const totalProducts = pagination?.total || 0

  const paginate = (pageNumber) => setCurrentPage(pageNumber)

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
        {/* Top Banner */}
        <div className="mb-6">
          <BannerCarousel images={bannerImages} />
          <div className="mt-3 flex items-center justify-end">
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
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectionMode}
                  className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${selectionMode ? 'bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  {selectionMode ? 'Done Selecting' : 'Select Multiple'}
                </button>
                {selectionMode && (
                  <button
                    onClick={() => setSelectedIds(new Set(products.map(p=>p._id)))}
                    className="px-3 py-2 rounded-md text-sm font-medium border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  >
                    Select All
                  </button>
                )}
              </div>
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
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-6 mb-8">
                  {products.map((product) => (
                    <ProductCard
                      key={product._id}
                      product={product}
                      selectedCountry={selectedCountry}
                      onAddToCart={handleAddToCart}
                      selectionEnabled={selectionMode}
                      selected={isSelected(product._id)}
                      onToggleSelect={() => toggleSelectFor(product._id)}
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

      {/* Sticky selection bar */}
      {selectionMode && (
        <div className="fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-[env(safe-area-inset-bottom)]">
            <div className="bg-white border-t border-gray-200 shadow-lg rounded-t-2xl p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">Selected</div>
                  <div className="text-sm font-semibold text-gray-900">{selectedCount} item{selectedCount!==1?'s':''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium"
                  >
                    Clear
                  </button>
                  <button
                    onClick={addSelectedToCart}
                    disabled={selectedCount === 0}
                    className={`px-4 py-2 rounded-lg text-white text-sm font-semibold shadow ${selectedCount===0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}
                  >
                    Add Selected to Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shopping Cart Sidebar */}
      <ShoppingCart 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
      />
    </div>
  )
}