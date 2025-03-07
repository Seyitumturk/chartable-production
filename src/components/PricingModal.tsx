import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe
const stripePromise = loadStripe('pk_live_51QHQyyJrIw0vuTAiVo4Lr92EKKA38XTXbZrCYapZbObdoe3YkYFjIdFxiGCIqqoJV3CN3V5inNMvCZtorn3SHNqr00x0PCu1wU');

// Define pricing tiers
const pricingTiers = [
  {
    id: 'free',
    name: 'Starter',
    credits: 5000,
    price: 0,
    priceId: 'price_starter',
    features: ['Basic diagrams', 'Export as PNG', 'Save up to 3 projects'],
    recommended: false
  },
  {
    id: 'plus',
    name: 'Plus',
    credits: 50000,
    price: 4.99,
    priceId: 'price_plus',
    features: ['Advanced diagrams', 'Export in multiple formats', 'Unlimited projects', 'Priority support'],
    recommended: true
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 150000,
    price: 9.99,
    priceId: 'price_pro',
    features: ['All Plus features', 'Team collaboration', 'Custom themes', 'API access'],
    recommended: false
  },
  {
    id: 'test',
    name: 'Test Plan',
    credits: 5000,
    price: 0.50,
    priceId: 'price_1Qzo1PJrIw0vuTAiNebDjhul',
    features: ['Test checkout functionality', 'Quick credit boost', 'For testing only'],
    recommended: false,
    isTestProduct: true
  }
];

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
  isDarkMode: boolean;
}

export default function PricingModal({ isOpen, onClose, currentCredits, isDarkMode }: PricingModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async (priceId: string) => {
    try {
      setIsLoading(priceId);
      setError(null);
      
      // Call your API to create a checkout session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      const { error } = await stripe!.redirectToCheckout({ sessionId: data.sessionId });

      if (error) {
        console.error('Error redirecting to checkout:', error);
        setError('Error redirecting to checkout. Please try again.');
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      
      {/* Modal */}
      <div className={`relative w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden ${
        isDarkMode ? 'bg-[#181818] text-white' : 'bg-white text-gray-900'
      }`}>
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-200/20 transition-colors z-10"
          aria-label="Close pricing modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Admin Notice - Only visible in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className={`mx-6 mt-6 p-4 rounded-lg text-sm ${
            isDarkMode ? 'bg-amber-400/10 text-amber-200' : 'bg-amber-50 text-amber-800'
          }`}>
            <div className="font-bold mb-1">⚠️ Stripe Setup Required</div>
            <p>You need to create products and prices in your Stripe dashboard and update the price IDs in:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li><code>src/app/api/stripe/create-checkout-session/route.ts</code></li>
              <li><code>src/components/PricingModal.tsx</code></li>
            </ul>
            <p className="mt-2">Replace <code>price_starter</code>, <code>price_plus</code>, and <code>price_pro</code> with your actual price IDs from Stripe.</p>
          </div>
        )}

        {/* Header */}
        <div className="px-6 pt-8 pb-6 text-center">
          <h2 className="text-3xl font-bold mb-2">Upgrade Your Credits</h2>
          <p className={isDarkMode ? "text-gray-300" : "text-gray-600"}>
            Choose a plan to increase your available credits and unlock more features.
          </p>
          <div className="mt-3 inline-block px-4 py-2 rounded-full bg-primary/10 text-primary font-medium">
            Current Credits: {currentCredits.toLocaleString()}
          </div>
        </div>

        {/* Custom Horizontal Pricing Table */}
        <div className="px-6 pb-8">
          {error && (
            <div className={`mb-6 p-4 rounded-lg ${
              isDarkMode ? 'bg-red-900/20 text-red-200' : 'bg-red-50 text-red-700'
            }`}>
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}
          
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            {pricingTiers.map((tier) => (
              <div 
                key={tier.id} 
                className={`flex-1 rounded-xl border overflow-hidden transition-all ${
                  isDarkMode 
                    ? 'bg-[#222] border-gray-700 hover:border-gray-600' 
                    : 'bg-white border-gray-200 hover:border-gray-300'
                } ${
                  tier.recommended 
                    ? (isDarkMode ? 'border-primary ring-1 ring-primary' : 'border-primary ring-1 ring-primary') 
                    : ''
                } ${
                  tier.isTestProduct
                    ? (isDarkMode ? 'border-blue-500 ring-1 ring-blue-500' : 'border-blue-500 ring-1 ring-blue-500')
                    : ''
                }`}
              >
                {tier.recommended && (
                  <div className="bg-primary text-white text-center py-1 text-sm font-medium">
                    Most Popular
                  </div>
                )}
                
                {tier.isTestProduct && (
                  <div className="bg-blue-500 text-white text-center py-1 text-sm font-medium">
                    Test Product
                  </div>
                )}
                
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                  
                  <div className="flex items-baseline mb-4">
                    <span className="text-3xl font-bold">${tier.price.toFixed(2)}</span>
                    {tier.price > 0 && <span className={`ml-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>one-time</span>}
                  </div>
                  
                  <div className={`rounded-lg p-3 mb-4 ${
                    tier.isTestProduct 
                      ? 'bg-blue-500/10' 
                      : 'bg-primary/10'
                  }`}>
                    <span className={
                      tier.isTestProduct 
                        ? 'text-blue-500 font-medium' 
                        : 'text-primary font-medium'
                    }>
                      {tier.credits.toLocaleString()} credits
                    </span>
                  </div>
                  
                  <ul className={`mb-6 space-y-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-5 w-5 mr-2 text-primary flex-shrink-0" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <button
                    onClick={() => handlePurchase(tier.priceId)}
                    disabled={isLoading === tier.priceId}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
                      tier.recommended
                        ? 'bg-primary hover:bg-primary-dark text-white'
                        : tier.isTestProduct
                          ? 'bg-blue-500 hover:bg-blue-600 text-white'
                          : isDarkMode
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    }`}
                  >
                    {isLoading === tier.priceId ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : tier.isTestProduct ? 'Test Checkout' : tier.price === 0 ? 'Get Started' : 'Purchase'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 