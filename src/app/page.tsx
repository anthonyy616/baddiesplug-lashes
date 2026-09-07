import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-2xl font-bold text-burgundy">
              The Baddies Plug
            </Link>
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/services" className="text-gray-700 dark:text-gray-300 hover:text-burgundy dark:hover:text-burgundy transition-colors">
                Services
              </Link>
              <Link href="/contact" className="text-gray-700 dark:text-gray-300 hover:text-burgundy dark:hover:text-burgundy transition-colors">
                Contact
              </Link>
              <Link href="/policies" className="text-gray-700 dark:text-gray-300 hover:text-burgundy dark:hover:text-burgundy transition-colors">
                Policies
              </Link>
              <Link href="/booking" className="bg-burgundy text-white px-4 py-2 rounded-md hover:bg-burgundy/90 transition-colors">
                Book Now
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-burgundy/5 to-transparent" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6 animate-fade-in">
            Elevate Your Beauty
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
            Premium lash extensions & eyebrow services tailored to enhance your natural beauty
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/services"
              className="bg-burgundy text-white px-8 py-4 rounded-lg font-semibold hover:bg-burgundy/90 transition-all hover:scale-105"
            >
              Explore Services
            </Link>
            <Link
              href="/booking"
              className="border-2 border-burgundy text-burgundy px-8 py-4 rounded-lg font-semibold hover:bg-burgundy hover:text-white transition-all hover:scale-105"
            >
              Book Appointment
            </Link>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-burgundy/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-burgundy/10 rounded-full blur-3xl" />
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Why Choose The Baddies Plug
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Experience luxury beauty services in a comfortable, professional environment
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-burgundy/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-burgundy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Luxury Experience</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Premium services delivered with care and attention to detail
              </p>
            </div>
            <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-burgundy/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-burgundy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Easy Booking</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Simple online booking with flexible scheduling options
              </p>
            </div>
            <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-burgundy/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-burgundy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Safe & Secure</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your data and privacy are always protected
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-burgundy">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Look?
          </h2>
          <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            Book your appointment today and experience the difference
          </p>
          <Link
            href="/booking"
            className="inline-block bg-white text-burgundy px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Book Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 dark:bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <span className="text-2xl font-bold text-white">The Baddies Plug</span>
              <p className="text-gray-400 mt-2">
                Luxury lash & beauty services
              </p>
            </div>
            <div className="flex space-x-6">
              <Link href="/services" className="text-gray-400 hover:text-white transition-colors">
                Services
              </Link>
              <Link href="/contact" className="text-gray-400 hover:text-white transition-colors">
                Contact
              </Link>
              <Link href="/policies" className="text-gray-400 hover:text-white transition-colors">
                Policies
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-500">
            <p>&copy; {new Date().getFullYear()} The Baddies Plug. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
