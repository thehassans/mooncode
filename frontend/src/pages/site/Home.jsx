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
    <div className="min-h-screen bg-gray-50">
      <Header onCartClick={() => setIsCartOpen(true)} />

      {/* Hero */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4">Care that lets you glow</h1>
              <p className="text-gray-600 text-lg mb-6">High-quality skincare and haircare, crafted with clean ingredients and modern science — at prices you’ll love.</p>
              <div className="flex gap-3">
                <Link to="/catalog" className="px-5 py-3 rounded-lg bg-orange-500 text-white font-semibold shadow hover:bg-orange-600">Shop Products</Link>
                <Link to="/about" className="px-5 py-3 rounded-lg border border-gray-300 text-gray-800 font-semibold bg-white hover:bg-gray-50">About Us</Link>
              </div>
            </div>
            <div className="hidden md:block">
              <img src="/hero-beauty.jpg" alt="Buysial" onError={(e)=>{e.currentTarget.style.display='none'}} className="rounded-xl shadow-lg w-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Shop by Category</h2>
            <Link to="/categories" className="text-orange-600 font-semibold hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {topCategories.map(cat => (
              <Link key={cat.id} to={`/catalog?category=${encodeURIComponent(cat.id)}`} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3 hover:shadow-md transition">
                <span className="text-2xl">{cat.icon}</span>
                <span className="font-medium text-gray-900">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured/New Products */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">New Arrivals</h2>
            <Link to="/catalog" className="text-orange-600 font-semibold hover:underline">Browse all</Link>
          </div>
          {loading ? (
            <div className="text-gray-600">Loading…</div>
          ) : featured.length === 0 ? (
            <div className="text-gray-600">No products found.</div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {featured.map(p => (
                <ProductCard key={p._id} product={p} selectedCountry={selectedCountry} onAddToCart={() => setIsCartOpen(true)} />
              ))}
            </div>
          )}
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
