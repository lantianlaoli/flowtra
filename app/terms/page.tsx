import Header from '@/components/layout/Header';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms of Service</h1>
          
          <div className="text-sm text-gray-500 mb-8">
            Last updated: January 2025
          </div>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              By accessing and using Flowtra (&quot;the Service&quot;), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Flowtra is an AI-powered platform that generates professional advertisement content including cover images and video advertisements from product photos. The service uses artificial intelligence to analyze products and create marketing materials.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. User Accounts and Registration</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              To use certain features of the Service, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Credits and Payment</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              New users receive 100 free credits upon registration. Additional credits can be purchased through our pricing plans. Credits are non-refundable and do not expire. All payments are processed securely through our payment partners.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Content and Intellectual Property</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              You retain ownership of the content you upload to our Service. By using the Service, you grant us a license to process your content to provide the AI generation services. Generated content is owned by you, subject to our platform rights.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibent text-gray-900 mb-4">6. Prohibited Uses</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              You may not use the Service for any illegal, harmful, or abusive purposes. This includes but is not limited to generating content that violates intellectual property rights, contains explicit material, or promotes harmful activities.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Limitation of Liability</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Flowtra shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Privacy</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Your privacy is important to us. Please refer to our Privacy Policy for information about how we collect, use, and disclose your personal information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Changes to Terms</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              We reserve the right to modify these terms at any time. We will notify users of significant changes via email or through the Service. Your continued use of the Service after such modifications constitutes acceptance of the updated terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Contact Information</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              If you have any questions about these Terms of Service, please contact us at legal@flowtra.com.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600">
            <p>&copy; 2024 Flowtra. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}