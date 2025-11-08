import React from 'react'
import Header from '../../components/layout/Header'

export default function About(){
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Header onCartClick={()=>{}} />
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-orange-500 via-orange-400 to-amber-500 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
              About Buysial
            </h1>
            <p className="text-xl sm:text-2xl text-white/90 leading-relaxed max-w-3xl mx-auto">
              Your trusted marketplace for quality products at unbeatable prices across the Gulf region
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent"></div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {[
            { number: '10,000+', label: 'Products', icon: '📦' },
            { number: '50,000+', label: 'Monthly Orders', icon: '🛒' },
            { number: '500+', label: 'Active Brands', icon: '⭐' },
            { number: '10+', label: 'Countries', icon: '🌍' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white rounded-2xl shadow-lg p-6 text-center hover:shadow-xl transition-shadow border border-gray-100">
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className="text-3xl sm:text-4xl font-bold text-orange-600 mb-1">{stat.number}</div>
              <div className="text-sm sm:text-base text-gray-600 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Our Story */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="grid gap-16">
          
          {/* Mission & Vision */}
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-3xl p-8 lg:p-10 border border-orange-100 shadow-sm">
              <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Mission</h2>
              <p className="text-gray-700 leading-relaxed text-lg">
                To empower businesses and individuals across the Gulf region with access to quality products at competitive prices. We bridge the gap between buyers and suppliers, making wholesale and retail shopping simple, transparent, and reliable.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 lg:p-10 border border-blue-100 shadow-sm">
              <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Vision</h2>
              <p className="text-gray-700 leading-relaxed text-lg">
                To become the leading e-commerce platform in the Gulf region, known for our vast product selection, competitive pricing, and exceptional customer service. We envision a marketplace where every transaction builds trust and long-term relationships.
              </p>
            </div>
          </div>

          {/* Why Choose Us */}
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Choose Buysial?</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12">
              We're committed to providing the best shopping experience for businesses and individuals
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {title:'Verified Quality', desc:'All products verified and quality-checked', icon:'✓', color:'emerald'},
                {title:'Best Prices', desc:'Competitive wholesale and retail pricing', icon:'💰', color:'amber'},
                {title:'Fast Delivery', desc:'Quick and reliable shipping across the region', icon:'🚚', color:'blue'},
                {title:'24/7 Support', desc:'Always here to help with your orders', icon:'💬', color:'purple'},
              ].map((it,idx)=> (
                <div key={idx} className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all hover:-translate-y-1 border border-gray-100">
                  <div className={`w-16 h-16 bg-${it.color}-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl`}>
                    {it.icon}
                  </div>
                  <h3 className="font-bold text-xl text-gray-900 mb-2">{it.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{it.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Core Values */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-10 lg:p-16 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500 rounded-full filter blur-3xl opacity-20"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500 rounded-full filter blur-3xl opacity-20"></div>
            <div className="relative">
              <h2 className="text-4xl font-bold mb-4 text-center">Our Core Values</h2>
              <p className="text-xl text-gray-300 text-center mb-12 max-w-3xl mx-auto">
                The principles that guide everything we do
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="text-center">
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20">
                    <svg className="w-10 h-10 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-xl mb-2">Trust</h3>
                  <p className="text-gray-300">Building lasting relationships through transparency and reliability</p>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20">
                    <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-xl mb-2">Excellence</h3>
                  <p className="text-gray-300">Commitment to quality in every product and service</p>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20">
                    <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-xl mb-2">Innovation</h3>
                  <p className="text-gray-300">Continuously improving to serve you better</p>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20">
                    <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-xl mb-2">Customer First</h3>
                  <p className="text-gray-300">Your satisfaction is our top priority</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl p-12 text-center text-white shadow-2xl">
            <h2 className="text-4xl font-bold mb-4">Ready to Start Shopping?</h2>
            <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto">
              Explore thousands of quality products from trusted brands at unbeatable prices
            </p>
            <a href="/catalog" className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white text-orange-600 font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Explore Products Now
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
