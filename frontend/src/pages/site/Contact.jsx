import React from 'react'
import Header from '../../components/layout/Header'

export default function Contact(){
  return (
    <div className="min-h-screen bg-gray-50">
      <Header onCartClick={()=>{}} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-6">Contact Us</h1>
        <p className="text-gray-700 text-lg mb-6">
          We’re here to help you with any questions, feedback, or support you may need. Whether you’re looking for
          skincare advice, product information, or order assistance, our team at Buysial is always happy to assist.
        </p>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
          <div className="space-y-4">
            <div>
              <div className="text-gray-500 text-sm">Email</div>
              <a href="mailto:support@buysial.com" className="text-blue-600 font-semibold hover:underline">support@buysial.com</a>
            </div>
            <div>
              <div className="text-gray-500 text-sm">Phone</div>
              <a href="tel:+971585491340" className="text-blue-600 font-semibold hover:underline">+971 58 549 1340</a>
            </div>
            <div>
              <div className="text-gray-500 text-sm">Support Hours</div>
              <div className="text-gray-800 font-medium">Monday to Saturday, 9:00 AM – 7:00 PM (Gulf Standard Time)</div>
            </div>
            <div>
              <div className="text-gray-500 text-sm">Response Time</div>
              <div className="text-gray-800">We aim to respond to all inquiries within 24 hours.</div>
            </div>
          </div>
        </div>

        <p className="text-gray-700 mb-6">
          You can also reach us through our social media channels or the contact form on our website — we’d love to
          hear from you!
        </p>
        <div className="text-gray-900 font-semibold">✨ Buysial — Where Care Meets Confidence.</div>
      </main>
    </div>
  )
}
