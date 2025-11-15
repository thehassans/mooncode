import React from 'react'
import Header from '../../components/layout/Header'

export default function Privacy() {
  const updated = 'November 16, 2025'
  const company = 'BuySial'
  const legalEmail = 'privacy@buysial.com'
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <Header onCartClick={() => {}} />

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-2 text-slate-600">Last updated: {updated}</p>
        </header>

        <section className="prose prose-slate max-w-none">
          <p>
            This Privacy Policy explains how {company} ("we", "us", or "our") collects, uses,
            discloses, and protects your information when you use our website, mobile applications,
            products, and services (collectively, the "Services"). By using the Services, you
            consent to the practices described in this policy.
          </p>

          <h2>1. Information We Collect</h2>
          <ul>
            <li>
              <strong>Account Information:</strong> name, email, phone number, address, and login
              credentials.
            </li>
            <li>
              <strong>Transactional Data:</strong> orders, payment status, delivery details, and
              support history.
            </li>
            <li>
              <strong>Technical Data:</strong> device identifiers, IP address, browser type, pages
              visited, and cookies.
            </li>
            <li>
              <strong>Communications:</strong> messages, reviews, and other content you submit.
            </li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>Provide, operate, and improve the Services.</li>
            <li>Process and fulfill orders and payments.</li>
            <li>Communicate with you about your account, orders, and promotions.</li>
            <li>Detect, prevent, and investigate fraud and abuse.</li>
            <li>Comply with legal obligations and enforce our Terms.</li>
          </ul>

          <h2>3. Cookies and Tracking</h2>
          <p>
            We use cookies and similar technologies to enable core functionality, remember your
            preferences, analyze usage, and personalize content. You can control cookies through
            your browser settings; however, disabling cookies may affect certain features of the
            Services.
          </p>

          <h2>4. Sharing of Information</h2>
          <p>
            We may share your information with service providers (e.g., payment processors,
            logistics partners) who assist in delivering the Services; with business partners for
            integrations you authorize; to comply with law or respond to legal requests; or in
            connection with a merger, acquisition, or asset sale.
          </p>

          <h2>5. Your Rights and Choices</h2>
          <ul>
            <li>
              Access, correct, or delete certain personal information from your account settings,
              where available.
            </li>
            <li>Opt out of marketing emails by using the unsubscribe link in those emails.</li>
            <li>Contact us to exercise applicable data protection rights.</li>
          </ul>

          <h2>6. Data Retention</h2>
          <p>
            We retain information for as long as needed to provide the Services, comply with legal
            obligations, resolve disputes, and enforce agreements. Retention periods vary depending
            on the type of data and applicable laws.
          </p>

          <h2>7. Security</h2>
          <p>
            We implement reasonable administrative, technical, and physical safeguards to protect
            your information. No method of transmission or storage is 100% secure, and we cannot
            guarantee absolute security.
          </p>

          <h2>8. International Transfers</h2>
          <p>
            Your information may be processed and stored in countries other than your own. Where
            required, we implement appropriate safeguards to protect your information in accordance
            with applicable law.
          </p>

          <h2>9. Children</h2>
          <p>
            Our Services are not directed to children under the age of 13 (or the applicable age of
            digital consent in your jurisdiction). We do not knowingly collect personal information
            from children without appropriate consent.
          </p>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will post the updated policy
            with a new “Last updated” date. Your continued use of the Services after the changes
            become effective constitutes your acceptance of the updates.
          </p>

          <h2>11. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at{' '}
            <a href={`mailto:${legalEmail}`}>{legalEmail}</a>.
          </p>
        </section>
      </main>
    </div>
  )
}
