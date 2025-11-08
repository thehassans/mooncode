import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../../components/layout/Header'
import { apiGet } from '../../api'
import ProductCard from '../../components/ecommerce/ProductCard'
import ShoppingCart from '../../components/ecommerce/ShoppingCart'
import { categories } from '../../components/ecommerce/CategoryFilter'
import { detectCountryCode } from '../../utils/geo'
import { countries } from '../../components/ecommerce/CountrySelector'

export default function Home(){
  const [featured, setFeatured] = useState([])
  const [loading, setLoading] = useState(true)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [categoryCounts, setCategoryCounts] = useState({})
  const [selectedCountry, setSelectedCountry] = useState(() => {
    try { return localStorage.getItem('selected_country') || 'SA' } catch { return 'SA' }
  })

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{
        setLoading(true)
        // Try to fetch newest products; fallback to any
        const qs = new URLSearchParams()
        qs.set('page','1'); qs.set('limit','8'); qs.set('sort','newest')
        const res = await apiGet(`/api/products/public?${qs.toString()}`)
        let list = Array.isArray(res?.products)? res.products: []
        // Filter products by selected country availability
        try{
          const selectedCountryName = countries.find(c => c.code === selectedCountry)?.name
          list = list.filter(p => {
            if (!Array.isArray(p.availableCountries) || p.availableCountries.length === 0) return true
            return selectedCountryName ? p.availableCountries.includes(selectedCountryName) : true
          })
        }catch{}
        if (alive) setFeatured(list.slice(0,8))
      }catch{
        if (alive) setFeatured([])
      }finally{ if (alive) setLoading(false) }
    })()
    return ()=>{ alive = false }
  },[selectedCountry])

  // Persist selected country
  useEffect(()=>{
    try { localStorage.setItem('selected_country', selectedCountry) } catch {}
  },[selectedCountry])

  // On first visit, auto-detect country if none saved
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

  // Load category usage counts for hiding empty categories
  useEffect(() => {
    let alive = true
    ;(async()=>{
      try{
        const res = await apiGet('/api/products/public/categories-usage')
        if (alive) setCategoryCounts(res?.counts || {})
      }catch{
        if (alive) setCategoryCounts({})
      }
    })()
    return ()=>{ alive = false }
  }, [])

  const topCategories = categories
    .filter(c => c.id !== 'all')
    .filter(c => (categoryCounts?.[c.id] || 0) > 0)
    .slice(0, 8)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Header onCartClick={() => setIsCartOpen(true)} />

      {/* Premium Hero Section */}
      <section className="relative bg-gradient-to-br from-orange-500 via-orange-400 to-amber-500 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full filter blur-3xl opacity-10"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-300 rounded-full filter blur-3xl opacity-10"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center max-w-5xl mx-auto">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
              Discover Quality Products at Unbeatable Prices
            </h1>
            <p className="text-xl sm:text-2xl text-white/90 leading-relaxed max-w-4xl mx-auto mb-10">
              Your trusted marketplace for wholesale and retail shopping across the Gulf region
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/catalog" 
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white text-orange-600 font-bold text-lg shadow-2xl hover:shadow-3xl hover:scale-105 transition-all"
              >
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                Shop Products
              </Link>
              <Link 
                to="/about" 
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white/10 backdrop-blur-sm text-white font-bold text-lg border-2 border-white/30 hover:bg-white/20 transition-all"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent"></div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10 mb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {[
            { number: '10,000+', label: 'Products', icon: '📦', color: 'from-orange-500 to-orange-600' },
            { number: '50,000+', label: 'Monthly Orders', icon: '🛒', color: 'from-blue-500 to-blue-600' },
            { number: '500+', label: 'Active Brands', icon: '⭐', color: 'from-purple-500 to-purple-600' },
            { number: '10+', label: 'Countries', icon: '🌍', color: 'from-green-500 to-green-600' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white rounded-2xl shadow-xl p-6 text-center hover:shadow-2xl transition-all hover:-translate-y-1 border border-gray-100">
              <div className="text-4xl mb-3">{stat.icon}</div>
              <div className={`text-3xl sm:text-4xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent mb-1`}>
                {stat.number}
              </div>
              <div className="text-sm text-gray-600 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories Section */}
      <section className="bg-gradient-to-br from-gray-50 to-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Shop by Category</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Browse through our diverse range of product categories
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6">
            {topCategories.map(cat => (
              <Link 
                key={cat.id} 
                to={`/catalog?category=${encodeURIComponent(cat.id)}`} 
                className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-200 hover:-translate-y-1 border border-gray-100 group text-center"
              >
                <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform">{cat.icon}</div>
                <span className="font-bold text-lg text-gray-900">{cat.name}</span>
              </Link>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link 
              to="/categories" 
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all"
            >
              View All Categories
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">New Arrivals</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover our latest products fresh from top brands
            </p>
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-orange-500"></div>
            </div>
          ) : featured.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No products available</h3>
              <p className="text-gray-600 mb-6">Check back soon for new arrivals!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {featured.map(p => (
                <ProductCard key={p._id} product={p} selectedCountry={selectedCountry} onAddToCart={() => setIsCartOpen(true)} />
              ))}
            </div>
          )}
          <div className="text-center mt-12">
            <Link 
              to="/catalog" 
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all"
            >
              Browse All Products
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 py-20 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500 rounded-full filter blur-3xl opacity-10"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500 rounded-full filter blur-3xl opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why Shop With Us?</h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Experience the best in e-commerce with our premium services
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: '✓', title: 'Verified Quality', desc: 'All products quality-checked and verified' },
              { icon: '🚚', title: 'Fast Delivery', desc: 'Quick shipping across the Gulf region' },
              { icon: '💰', title: 'Best Prices', desc: 'Competitive wholesale & retail pricing' },
              { icon: '💬', title: '24/7 Support', desc: 'Always here to help with your orders' },
            ].map((feature, idx) => (
              <div key={idx} className="text-center">
                <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/20 text-4xl">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-300 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shopping Cart Sidebar */}
      <ShoppingCart 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
      />
    </div>
  )
}
