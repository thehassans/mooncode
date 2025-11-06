import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../../components/layout/Header'

export default function Categories(){
  const navigate = useNavigate()
  
  // Complete category list with professional icons
  const allCategories = [
    { name: 'Electronics', color: '#3b82f6', desc: 'Phones, laptops, gadgets & more' },
    { name: 'Fashion', color: '#8b5cf6', desc: 'Clothing, shoes & apparel' },
    { name: 'Home', color: '#f59e0b', desc: 'Furniture & home decor' },
    { name: 'Beauty', color: '#ec4899', desc: 'Cosmetics & beauty products' },
    { name: 'Sports', color: '#14b8a6', desc: 'Fitness & sports equipment' },
    { name: 'Books', color: '#6366f1', desc: 'Books & educational materials' },
    { name: 'Toys', color: '#f97316', desc: 'Toys & games for kids' },
    { name: 'Automotive', color: '#ef4444', desc: 'Car parts & accessories' },
    { name: 'Food', color: '#10b981', desc: 'Groceries & snacks' },
    { name: 'Jewelry', color: '#a855f7', desc: 'Jewelry & accessories' },
    { name: 'Health', color: '#ec4899', desc: 'Health & wellness products' },
    { name: 'Office', color: '#64748b', desc: 'Office supplies & stationery' },
    { name: 'Garden', color: '#10b981', desc: 'Garden & outdoor products' },
    { name: 'Pets', color: '#f59e0b', desc: 'Pet supplies & accessories' },
    { name: 'Tools', color: '#64748b', desc: 'Tools & hardware' },
    { name: 'Music', color: '#8b5cf6', desc: 'Music & entertainment' },
    { name: 'Skincare', color: '#ec4899', desc: 'Skincare & personal care' },
    { name: 'Other', color: '#6b7280', desc: 'Other products' },
  ]

  const getCategoryIcon = (name) => {
    const iconProps = { className: "w-10 h-10 sm:w-12 sm:h-12", strokeWidth: 1.5 }
    const categoryLower = name.toLowerCase()
    
    if (categoryLower.includes('electronic')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
    }
    if (categoryLower.includes('fashion') || categoryLower.includes('clothing')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
    }
    if (categoryLower.includes('home') || categoryLower.includes('furniture')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    }
    if (categoryLower.includes('beauty') || categoryLower.includes('cosmetic') || categoryLower.includes('skin')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
    }
    if (categoryLower.includes('sport') || categoryLower.includes('fitness')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10M7 3h10M5 7v10M19 7v10M9 7v10M15 7v10M3 9v6M21 9v6" /></svg>
    }
    if (categoryLower.includes('book') || categoryLower.includes('education')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
    }
    if (categoryLower.includes('toy') || categoryLower.includes('kid')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>
    }
    if (categoryLower.includes('automotive') || categoryLower.includes('vehicle')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/></svg>
    }
    if (categoryLower.includes('food') || categoryLower.includes('grocery')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    }
    if (categoryLower.includes('jewelry') || categoryLower.includes('accessori')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
    }
    if (categoryLower.includes('health') || categoryLower.includes('medical')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
    }
    if (categoryLower.includes('office') || categoryLower.includes('stationery')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    }
    if (categoryLower.includes('garden') || categoryLower.includes('outdoor')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    }
    if (categoryLower.includes('pet') || categoryLower.includes('animal')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v.01M8.5 8.5l-.01-.01m8.01.01l-.01-.01M9.5 13.5a4.5 4.5 0 005 0M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    }
    if (categoryLower.includes('tool') || categoryLower.includes('hardware')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    }
    if (categoryLower.includes('music') || categoryLower.includes('entertainment')) {
      return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
    }
    return <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
  }

  const handleCategoryClick = (categoryName) => {
    navigate(`/catalog?category=${encodeURIComponent(categoryName)}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Header onCartClick={()=>{}} />
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
              Browse Categories
            </h1>
            <p className="text-xl sm:text-2xl text-white/90 leading-relaxed max-w-3xl mx-auto">
              Explore our wide range of product categories and find exactly what you need
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent"></div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        
        {/* Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {allCategories.map((category, idx) => (
            <button
              key={idx}
              onClick={() => handleCategoryClick(category.name)}
              className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 hover:-translate-y-1 border border-gray-100 group"
            >
              <div 
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto mb-4 flex items-center justify-center transition-all group-hover:scale-110"
                style={{ 
                  backgroundColor: category.color + '15',
                  color: category.color
                }}
              >
                {getCategoryIcon(category.name)}
              </div>
              <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-2 text-center">
                {category.name}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 text-center leading-relaxed">
                {category.desc}
              </p>
            </button>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-16 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-12 text-center text-white shadow-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Can't Find What You're Looking For?</h2>
          <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto">
            Use our search feature to find specific products across all categories
          </p>
          <Link 
            to="/catalog" 
            className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white text-purple-600 font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          >
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Browse All Products
          </Link>
        </div>
      </main>
    </div>
  )
}
