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
    priceId: 'price_1QzLeZJrIw0vuTAi0GfokpSI',
    features: ['Basic diagrams', 'Export as PNG', 'Save up to 3 projects'],
    recommended: false
  },
  {
    id: 'plus',
    name: 'Premium',
    credits: 50000,
    price: 4.99,
    priceId: 'price_1QzLd1JrIw0vuTAi7vKQjn9L',
    features: ['Advanced diagrams', 'Export in multiple formats', 'Unlimited projects', 'Priority support'],
    recommended: true
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 150000,
    price: 9.99,
    priceId: 'price_1QzLdXJrIw0vuTAiJ2Nw6P5w',
    features: ['All Plus features', 'Team collaboration', 'Custom themes', 'API access'],
    recommended: false
  }
];

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
  isDarkMode: boolean;
  hasPurchasedStarter?: boolean;
}

export default function PricingModal({ isOpen, onClose, currentCredits, isDarkMode, hasPurchasedStarter = false }: PricingModalProps) {
  const router = useRouter();
  const [purchasingTier, setPurchasingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async (priceId: string) => {
    try {
      // Find the tier that matches this price
      const tier = pricingTiers.find(t => t.priceId === priceId);
      if (!tier) return;

      // Don't allow purchasing the Starter plan if already purchased
      if (tier.id === 'free' && hasPurchasedStarter) {
        return;
      }
      
      // Reset any previous errors
      setError(null);
      
      // Set loading state
      setPurchasingTier(tier.id);
      
      // Initialize Stripe checkout
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();

      if (response.ok) {
        // If successful, redirect to Stripe Checkout
        const stripe = await stripePromise;
        if (stripe) {
          const { error } = await stripe.redirectToCheckout({
            sessionId: data.sessionId,
          });

          if (error) {
            setError(`Payment Error: ${error.message}`);
          }
        }
      } else {
        setError(`Error: ${data.error || 'Failed to create checkout session'}`);
      }
    } catch (err: any) {
      console.error('Error creating checkout session:', err);
      setError(`Error: ${err.message || 'Something went wrong'}`);
    } finally {
      setPurchasingTier(null);
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
            <code className="block bg-gray-800 p-2 rounded text-sm overflow-x-auto my-2">
              src/components/PricingModal.tsx
            </code>
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
                }`}
              >
                {tier.recommended && (
                  <div className="bg-primary text-white text-center py-1 text-sm font-medium">
                    Most Popular
                  </div>
                )}
                
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                  
                  <div className="flex items-baseline mb-4">
                    <span className="text-3xl font-bold">${tier.price.toFixed(2)}</span>
                    {tier.price > 0 && <span className={`ml-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>one-time</span>}
                  </div>
                  
                  <div className={`rounded-lg p-3 mb-4 ${
                    'bg-primary/10'
                  }`}>
                    <span className={
                      'text-primary font-medium'
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
                    disabled={purchasingTier !== null || (tier.id === 'free' && hasPurchasedStarter)}
                    className={`w-full mt-4 py-2 px-4 rounded-lg transition-colors ${
                      tier.recommended
                        ? 'bg-primary hover:bg-primary-dark text-white'
                        : isDarkMode
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                    } ${
                      purchasingTier !== null || (tier.id === 'free' && hasPurchasedStarter) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {purchasingTier === tier.id ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : tier.id === 'free' && hasPurchasedStarter ? 'Current Plan' : tier.price === 0 ? 'Get Started' : 'Purchase'}
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