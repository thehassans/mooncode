import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ProductCard from '../../components/ecommerce/ProductCard'
import Header from '../../components/layout/Header'
import ShoppingCart from '../../components/ecommerce/ShoppingCart'
import EditMode from '../../components/ecommerce/EditMode'
import { useToast } from '../../ui/Toast'
import { trackPageView, trackSearch, trackFilterUsage, trackSortUsage } from '../../utils/analytics'
import { apiGet } from '../../api'
import { detectCountryCode } from '../../utils/geo'
import CategoryFilter from '../../components/ecommerce/CategoryFilter'
import SearchBar from '../../components/ecommerce/SearchBar'
import CountrySelector, { countries } from '../../components/ecommerce/CountrySelector'

// Professional Stats and Categories Section
function StatsAndCategories({ categoryCount = 0, categoryCounts = {}, selectedCategory = 'all', onCategoryClick }) {
  // Category icon components with premium SVG designs
  const getCategoryIcon = (name) => {
    const iconProps = { className: "w-10 h-10 sm:w-12 sm:h-12", strokeWidth: 1.5 }
    const categoryLower = name.toLowerCase()
    
    // Electronics - Smartphone icon
    if (categoryLower.includes('electronic')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
    }
    // Fashion/Clothing - Shopping bag icon
    if (categoryLower.includes('fashion') || categoryLower.includes('clothing') || categoryLower.includes('apparel')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
    }
    // Home/Furniture - House icon
    if (categoryLower.includes('home') || categoryLower.includes('furniture')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    }
    // Beauty/Cosmetics/Skincare - Sparkle icon
    if (categoryLower.includes('beauty') || categoryLower.includes('cosmetic') || categoryLower.includes('skincare') || categoryLower.includes('skin')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
    }
    // Sports/Fitness - Dumbbell icon  
    if (categoryLower.includes('sport') || categoryLower.includes('fitness') || categoryLower.includes('gym')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10M7 3h10M5 7v10M19 7v10M9 7v10M15 7v10M3 9v6M21 9v6" /><rect x="7" y="7" width="2" height="10" fill="currentColor" opacity="0.3"/><rect x="15" y="7" width="2" height="10" fill="currentColor" opacity="0.3"/></svg>
    }
    // Books/Education - Open book icon
    if (categoryLower.includes('book') || categoryLower.includes('education') || categoryLower.includes('learning')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
    }
    // Toys/Kids - Puzzle piece icon
    if (categoryLower.includes('toy') || categoryLower.includes('kid') || categoryLower.includes('children')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>
    }
    // Automotive/Vehicles - Car icon
    if (categoryLower.includes('automotive') || categoryLower.includes('vehicle') || categoryLower.includes('car')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/></svg>
    }
    // Food/Grocery - Shopping cart icon
    if (categoryLower.includes('food') || categoryLower.includes('grocery') || categoryLower.includes('snack')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    }
    // Jewelry/Accessories - Diamond icon
    if (categoryLower.includes('jewelry') || categoryLower.includes('jewellery') || categoryLower.includes('accessori') || categoryLower.includes('watch')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
    }
    // Health/Medical - Heart icon
    if (categoryLower.includes('health') || categoryLower.includes('medical') || categoryLower.includes('wellness')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
    }
    // Office/Stationery - Document icon
    if (categoryLower.includes('office') || categoryLower.includes('stationery') || categoryLower.includes('supplies')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    }
    // Garden/Outdoor - Globe with plant icon
    if (categoryLower.includes('garden') || categoryLower.includes('outdoor') || categoryLower.includes('plant')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    }
    // Pet/Animals - Paw icon
    if (categoryLower.includes('pet') || categoryLower.includes('animal')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v.01M8.5 8.5l-.01-.01m8.01.01l-.01-.01M9.5 13.5a4.5 4.5 0 005 0M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><circle cx="9" cy="9" r="1.5" fill="currentColor"/><circle cx="15" cy="9" r="1.5" fill="currentColor"/></svg>
    }
    // Tools/Hardware - Wrench icon
    if (categoryLower.includes('tool') || categoryLower.includes('hardware') || categoryLower.includes('repair')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    }
    // Music/Entertainment - Music note icon
    if (categoryLower.includes('music') || categoryLower.includes('entertainment') || categoryLower.includes('audio')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
    }
    // Default/Other - Grid icon (premium)
    return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
  }

  const getCategoryColor = (name) => {
    const colors = {
      electronics: '#3b82f6',
      fashion: '#8b5cf6',
      clothing: '#8b5cf6',
      apparel: '#8b5cf6',
      home: '#f59e0b',
      furniture: '#84cc16',
      beauty: '#ec4899',
      cosmetics: '#ec4899',
      sports: '#14b8a6',
      fitness: '#14b8a6',
      books: '#6366f1',
      education: '#6366f1',
      toys: '#f97316',
      kids: '#f97316',
      automotive: '#ef4444',
      vehicles: '#ef4444',
      food: '#10b981',
      grocery: '#10b981',
      jewelry: '#a855f7',
      accessories: '#a855f7',
      health: '#ec4899',
      medical: '#ec4899',
      office: '#64748b',
      stationery: '#64748b',
      garden: '#10b981',
      outdoor: '#10b981'
    }
    return colors[name.toLowerCase()] || '#6b7280'
  }

  // Define available categories (removed: Beauty, Sports, Books, Automotive, Food, Garden, Pets, Music)
  const allCategories = [
    'Electronics', 'Fashion', 'Home', 'Toys', 'Jewelry',
    'Health', 'Office', 'Tools', 'Skincare', 'Other'
  ]
  
  // Show all categories (not filtering by product count)
  const availableCategories = allCategories

  return (
    <div className="bg-gradient-to-br from-orange-50 via-white to-blue-50 rounded-2xl shadow-lg overflow-hidden mb-8">
      {/* Stats Section */}
      <div className="p-6 sm:p-8 lg:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left: Headline */}
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 leading-tight">
              Discover quality products at unbeatable prices
            </h2>
            <p className="text-base sm:text-lg text-gray-600">
              Your trusted marketplace for wholesale and retail shopping across the Gulf region
            </p>
          </div>

          {/* Right: Stats Grid */}
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent mb-1">
                10,000+
              </div>
              <div className="text-sm sm:text-base text-gray-600 font-medium">Products</div>
            </div>
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent mb-1">
                50,000+
              </div>
              <div className="text-sm sm:text-base text-gray-600 font-medium">Monthly Orders</div>
            </div>
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-purple-500 to-purple-600 bg-clip-text text-transparent mb-1">
                500+
              </div>
              <div className="text-sm sm:text-base text-gray-600 font-medium">Active Brands</div>
            </div>
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-green-500 to-green-600 bg-clip-text text-transparent mb-1">
                10+
              </div>
              <div className="text-sm sm:text-base text-gray-600 font-medium">Countries</div>
            </div>
          </div>
        </div>

        {/* Categories Section - Show all categories */}
        {availableCategories.length > 0 && (
          <div className="mt-10">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-6 text-center">Shop by Category</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
              {availableCategories.map((categoryName, index) => {
                const color = getCategoryColor(categoryName)
                return (
                  <button
                    key={index}
                    onClick={() => onCategoryClick(categoryName)}
                    className="flex flex-col items-center gap-3 p-3 transition-all duration-200 hover:scale-105 group cursor-pointer"
                  >
                    <div 
                      className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center bg-white shadow-sm group-hover:shadow-md transition-all ${
                        selectedCategory === categoryName 
                          ? 'border-2 border-orange-500 shadow-md' 
                          : 'border border-gray-100'
                      }`}
                      style={{ 
                        color: selectedCategory === categoryName ? '#ea580c' : '#4a5568'
                      }}
                    >
                      {getCategoryIcon(categoryName)}
                    </div>
                    <div className="text-center">
                      <span className={`text-xs sm:text-sm font-medium block leading-tight ${
                        selectedCategory === categoryName ? 'text-orange-600' : 'text-gray-700'
                      }`}>
                        {categoryName}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
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
  
  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [pageContent, setPageContent] = useState({})
  const [editState, setEditState] = useState({ canSave: false, elementCount: 0, saving: false, handleSave: null })
  
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
  
  // Load banners from API (filter by page='catalog')
  useEffect(() => {
    let alive = true
    ;(async()=>{
      try{
        const res = await apiGet('/api/settings/website/banners?page=catalog')
        const banners = res?.banners || []
        if (alive && banners.length > 0) {
          setBannerImages(banners.map(b => b.imageUrl))
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
  
  // Load page content for edit mode
  useEffect(() => {
    let alive = true
    ;(async()=>{
      try{
        const res = await apiGet('/api/settings/website/content?page=catalog')
        if (alive && res.content && res.content.elements) {
          setPageContent(res.content)
          applyPageContent(res.content.elements)
        }
      }catch(err){
        console.error('Failed to load page content:', err)
      }
    })()
    return ()=>{ alive = false }
  }, [])
  
  // Check URL for edit mode parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('edit') === 'true') {
      setEditMode(true)
    }
  }, [location.search])
  
  function applyPageContent(elements) {
    elements.forEach(el => {
      const domElement = document.getElementById(el.id) || 
                        document.querySelector(`[data-editable-id="${el.id}"]`)
      if (domElement) {
        if (el.text) domElement.innerText = el.text
        if (el.styles) {
          Object.keys(el.styles).forEach(style => {
            domElement.style[style] = el.styles[style]
          })
        }
      }
    })
  }
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
      <EditMode 
        page="catalog" 
        isActive={editMode} 
        onExit={() => setEditMode(false)} 
        onSave={setEditState}
      />
      
      <Header 
        onCartClick={() => setIsCartOpen(true)} 
        editMode={editMode}
        editState={editState}
        onExitEdit={() => setEditMode(false)}
      />
      
      {/* Premium Country Selector Bar - Top of Page */}
      <div className="bg-gradient-to-r from-orange-50 via-white to-blue-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 font-medium">Select your region for localized pricing</p>
            <CountrySelector
              selectedCountry={selectedCountry}
              onCountryChange={(country) => setSelectedCountry(country.code)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 editable-area">
        {/* Premium Stats and Categories Section */}
        <div className="mb-8">
          <StatsAndCategories 
            categoryCount={Object.keys(categoryCounts).length} 
            categoryCounts={categoryCounts}
            selectedCategory={selectedCategory}
            onCategoryClick={(category) => {
              setSelectedCategory(category)
              setCurrentPage(1)
              // Scroll to products section
              setTimeout(() => {
                const productsSection = document.querySelector('.product-grid-section')
                if (productsSection) {
                  productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }, 100)
            }}
          />
        </div>
        {/* Premium Filters Bar */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 sm:p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Category Filter */}
            <div className="w-full sm:w-56">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white font-medium text-gray-700 transition-all"
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
            <div className="w-full sm:w-56">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value)
                  trackSortUsage(e.target.value)
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white font-medium text-gray-700 transition-all"
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

            {/* Premium Results Summary */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div>
                <p className="text-sm text-gray-500 mb-1">Results</p>
                <p className="text-lg font-semibold text-gray-900">
                  {products.length} of {totalProducts} products
                  {selectedCategory !== 'all' && <span className="text-orange-600 ml-1">in {selectedCategory}</span>}
                  {searchQuery && <span className="text-gray-500 ml-1">matching "{searchQuery}"</span>}
                </p>
              </div>
            </div>

            {/* Products Grid */}
            <div className="product-grid-section">
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
      </div>

      {/* Key Features Section */}
      <div className="bg-gray-50 py-16">
        {/* Premium Why Choose Us Section */}
        <div className="mt-16 mb-12">
          <div className="text-center mb-12">
            <h2 data-editable-id="why-choose-title" className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent mb-4">Why Choose Us</h2>
            <p data-editable-id="why-choose-subtitle" className="text-lg text-gray-600 max-w-2xl mx-auto">Experience the best shopping with our premium services</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Free Shipping */}
            <div className="text-center group hover:scale-105 transition-transform duration-300">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-shadow">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 data-editable-id="feature-shipping-title" className="text-xl font-semibold text-gray-900 mb-2">Free Shipping</h3>
              <p data-editable-id="feature-shipping-desc" className="text-gray-600">Free delivery across all GCC countries</p>
            </div>

            {/* Quality Product */}
            <div className="text-center group hover:scale-105 transition-transform duration-300">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-shadow">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 data-editable-id="feature-quality-title" className="text-xl font-semibold text-gray-900 mb-2">Quality Product</h3>
              <p data-editable-id="feature-quality-desc" className="text-gray-600">Premium quality products sourced from trusted manufacturers</p>
            </div>

            {/* Secure Payment */}
            <div className="text-center group hover:scale-105 transition-transform duration-300">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-shadow">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 data-editable-id="feature-payment-title" className="text-xl font-semibold text-gray-900 mb-2">Secure Payment</h3>
              <p data-editable-id="feature-payment-desc" className="text-gray-600">Your payment information is protected with bank-level security</p>
            </div>

            {/* 24/7 Support */}
            <div className="text-center group hover:scale-105 transition-transform duration-300">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-shadow">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 109.75 9.75A9.75 9.75 0 0012 2.25z" />
                </svg>
              </div>
              <h3 data-editable-id="feature-support-title" className="text-xl font-semibold text-gray-900 mb-2">24/7 Support</h3>
              <p data-editable-id="feature-support-desc" className="text-gray-600">Round-the-clock customer support to help you anytime</p>
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