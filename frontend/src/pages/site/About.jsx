import React from 'react'
import Header from '../../components/layout/Header'

export default function About(){
  return (
    <div className="min-h-screen bg-gray-50">
      <Header onCartClick={()=>{}} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-6">About Buysial</h1>
        <div className="prose prose-lg max-w-none">
          <p>
            At Buysial, we believe that self-care is not a luxury — it’s a lifestyle. Our mission is to empower
            individuals to look and feel their best through high-quality, effective, and affordable skincare and
            haircare solutions.
          </p>
          <p>
            Founded with a passion for wellness and beauty, Buysial brings together nature-inspired ingredients and
            modern science to create products that truly care for you. Each formula is carefully crafted to nourish,
            protect, and enhance your natural beauty — because healthy skin and hair are the foundation of confidence.
          </p>
          <p>
            We’re committed to transparency, quality, and sustainability. From sourcing pure ingredients to using
            eco-friendly packaging, every step reflects our dedication to a better, more beautiful world.
          </p>
          <p>
            Whether you’re refreshing your skincare routine or finding the perfect solution for your hair, Buysial is
            here to help you glow inside and out.
          </p>

          <h2>✨ Our Promise:</h2>
          <ul>
            <li>Dermatologist-tested, cruelty-free formulations</li>
            <li>Safe and effective for all skin and hair types</li>
            <li>Clean ingredients — no harsh chemicals or toxins</li>
            <li>Sustainable and ethical practices</li>
          </ul>

          <p>
            Join us on the journey to authentic beauty and discover the Buysial difference — where care meets
            confidence.
          </p>
        </div>
      </main>
    </div>
  )
}
