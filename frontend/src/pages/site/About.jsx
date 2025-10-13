import React from 'react'
import Header from '../../components/layout/Header'

export default function About(){
  return (
    <div className="min-h-screen bg-gray-50">
      <Header onCartClick={()=>{}} />
      {/* Hero */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">About Buysial</h1>
              <p className="text-lg text-gray-600 leading-relaxed">
                At Buysial, we believe that self-care is not a luxury — it’s a lifestyle. Our mission is to empower
                individuals to look and feel their best through high-quality, effective, and affordable skincare and
                haircare solutions.
              </p>
            </div>
            <div className="hidden md:block">
              <img src="/about-hero.jpg" alt="Buysial Care" onError={(e)=>{e.currentTarget.style.display='none'}} className="rounded-2xl shadow-lg w-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-10">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Story</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Founded with a passion for wellness and beauty, Buysial brings together nature-inspired ingredients and
              modern science to create products that truly care for you. Each formula is carefully crafted to nourish,
              protect, and enhance your natural beauty — because healthy skin and hair are the foundation of confidence.
            </p>
            <p className="text-gray-700 leading-relaxed">
              We’re committed to transparency, quality, and sustainability. From sourcing pure ingredients to using
              eco-friendly packaging, every step reflects our dedication to a better, more beautiful world. Whether you’re
              refreshing your skincare routine or finding the perfect solution for your hair, Buysial is here to help you
              glow inside and out.
            </p>
          </div>

          {/* Promise badges */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Promise</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {title:'Dermatologist‑tested & Cruelty‑free', icon:'🧪'},
                {title:'Safe for all skin & hair types', icon:'✨'},
                {title:'Clean ingredients — no harsh chemicals', icon:'🌿'},
                {title:'Sustainable & ethical practices', icon:'♻️'},
              ].map((it,idx)=> (
                <div key={idx} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-3">
                  <span className="text-2xl" aria-hidden>{it.icon}</span>
                  <div className="font-semibold text-gray-900">{it.title}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Values */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">What We Value</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Transparency</h3>
                <p className="text-gray-700">Clear labels, honest claims, and results you can feel.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Quality</h3>
                <p className="text-gray-700">Clinically inspired formulas with nature-first ingredients.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Accessibility</h3>
                <p className="text-gray-700">Premium care without the premium price tag.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Care for the Planet</h3>
                <p className="text-gray-700">Thoughtful packaging and responsible sourcing.</p>
              </div>
            </div>
          </div>

          {/* Sustainability callout */}
          <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="text-2xl">🌍</div>
              <div className="text-emerald-900">
                <div className="font-extrabold text-xl mb-1">Sustainable by Design</div>
                <p>We choose recyclable or reusable materials whenever possible and continuously optimize our footprint.</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <a href="/catalog" className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-orange-500 text-white font-semibold shadow hover:bg-orange-600">Explore Products</a>
          </div>
        </div>
      </main>
    </div>
  )
}
