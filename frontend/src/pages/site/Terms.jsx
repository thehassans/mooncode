import React from 'react'
import Header from '../../components/layout/Header'

export default function Terms() {
  const updated = 'November 16, 2025'
  const company = 'BuySial'
  const legalEmail = 'support@buysial.com'
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <Header onCartClick={() => {}} />

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Terms & Conditions</h1>
          <p className="mt-2 text-slate-600">Last updated: {updated}</p>
        </header>

        <section className="prose prose-slate max-w-none">
          <p>
            Welcome to {company}. These Terms & Conditions ("Terms") govern your access to and use
            of our website, mobile applications, products, and services (collectively, the
            "Services"). By accessing or using the Services, you agree to be bound by these Terms.
            If you do not agree, do not use the Services.
          </p>

          <h2>1. Eligibility and Account</h2>
          <p>
            You must be at least 18 years old or the age of majority in your jurisdiction to use the
            Services. You are responsible for maintaining the confidentiality of your account
            credentials and for all activities that occur under your account. You must provide
            accurate, complete information and promptly update it as needed.
          </p>

          <h2>2. Use of the Services</h2>
          <ul>
            <li>Use the Services only for lawful purposes and in accordance with these Terms.</li>
            <li>
              Do not attempt to interfere with, disrupt, or compromise the integrity or performance
              of the Services.
            </li>
            <li>
              Do not copy, reverse engineer, or create derivative works from the Services except as
              permitted by law.
            </li>
          </ul>

          <h2>3. Orders, Pricing, and Availability</h2>
          <p>
            All orders are subject to acceptance and availability. We may limit or cancel quantities
            purchased per person, per account, or per order. Prices, discounts, and promotions are
            subject to change without notice. If an error in pricing or availability is discovered,
            we may cancel the order and refund any amounts paid.
          </p>

          <h2>4. Payments</h2>
          <p>
            By submitting an order, you authorize us and our payment processors to charge your
            selected payment method. You represent that you are authorized to use the payment method
            and that the payment information is accurate.
          </p>

          <h2>5. Shipping, Delivery, and Risk of Loss</h2>
          <p>
            Estimated delivery dates are not guaranteed. Title and risk of loss pass to you upon our
            delivery to the carrier. You are responsible for any customs duties, taxes, or import
            fees, where applicable.
          </p>

          <h2>6. Returns and Refunds</h2>
          <p>
            Return eligibility, timeframes, and procedures are described on the relevant product or
            policy pages. Items must be returned in their original condition, with all accessories
            and packaging, unless otherwise stated.
          </p>

          <h2>7. Prohibited Conduct</h2>
          <ul>
            <li>Fraudulent or deceptive activity, including payment fraud and identity theft.</li>
            <li>Posting or transmitting unlawful, infringing, or harmful content.</li>
            <li>
              Interfering with other users’ enjoyment of the Services or attempting to gain
              unauthorized access.
            </li>
          </ul>

          <h2>8. Intellectual Property</h2>
          <p>
            The Services and all content therein—including text, images, trademarks, logos, and
            software—are owned by
            {company} or our licensors, and are protected by intellectual property laws. You are
            granted a limited, non-exclusive, non-transferable license to access and use the
            Services for personal or business use in accordance with these Terms.
          </p>

          <h2>9. User Content</h2>
          <p>
            If you submit reviews, comments, or other content ("User Content"), you grant {company}{' '}
            a worldwide, royalty-free, perpetual, irrevocable, sublicensable license to use,
            reproduce, modify, publish, translate, and distribute such content in connection with
            the Services. You represent that you own or have the necessary rights to submit the User
            Content.
          </p>

          <h2>10. Third-Party Links and Services</h2>
          <p>
            Our Services may contain links to third-party websites or services that are not owned or
            controlled by us. We are not responsible for the content, policies, or practices of
            third parties, and you use them at your own risk.
          </p>

          <h2>11. Disclaimer of Warranties</h2>
          <p>
            To the fullest extent permitted by law, the Services are provided "as is" and "as
            available" without warranties of any kind, express or implied, including but not limited
            to merchantability, fitness for a particular purpose, and non-infringement. We do not
            warrant that the Services will be uninterrupted, error-free, secure, or that defects
            will be corrected.
          </p>

          <h2>12. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, in no event shall {company} be liable for any
            indirect, incidental, special, consequential, exemplary, or punitive damages, or for any
            loss of profits, revenues, data, or goodwill arising out of or related to your use of
            the Services, whether based in contract, tort, strict liability, or otherwise, even if
            we have been advised of the possibility of such damages.
          </p>

          <h2>13. Indemnification</h2>
          <p>
            You agree to defend, indemnify, and hold harmless {company}, its affiliates, and their
            respective officers, directors, employees, and agents from any claims, liabilities,
            damages, losses, and expenses arising out of or related to your use of the Services,
            your violation of these Terms, or your violation of any rights of a third party.
          </p>

          <h2>14. Governing Law and Disputes</h2>
          <p>
            These Terms and any dispute or claim (including non-contractual disputes or claims)
            arising out of or in connection with them shall be governed by and construed in
            accordance with the laws of the United Arab Emirates (UAE), without regard to conflict
            of law principles. You agree to the exclusive jurisdiction and venue of the courts
            located in the UAE for the resolution of any disputes.
          </p>

          <h2>15. Changes to the Terms</h2>
          <p>
            We may update these Terms from time to time. We will post the updated Terms with a new
            “Last updated” date. Your continued use of the Services after the changes become
            effective constitutes acceptance of the updated Terms.
          </p>

          <h2>16. Contact</h2>
          <p>
            If you have any questions about these Terms, please contact us at{' '}
            <a href={`mailto:${legalEmail}`}>{legalEmail}</a>.
          </p>
        </section>
      </main>
    </div>
  )
}
