import React from 'react'
import { Link } from 'react-router-dom'
import Header from '../../components/layout/Header'
import { categories } from '../../components/ecommerce/CategoryFilter'

export default function Categories(){
  const cats = categories.filter(c => c.id !== 'all')
  return (
    <div className="min-h-screen bg-gray-50">
      <Header onCartClick={()=>{}} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-6">Categories</h1>
        <p className="text-gray-600 mb-8">Browse products by category. Click a category to view matching products.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {cats.map(cat => (
            <Link key={cat.id} to={`/catalog?category=${encodeURIComponent(cat.id)}`} className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col items-center gap-3 hover:shadow-md transition">
              <span className="text-3xl">{cat.icon}</span>
              <span className="font-semibold text-gray-900 text-center">{cat.name}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
