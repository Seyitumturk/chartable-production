'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

// Component that safely uses useSearchParams within Suspense
function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(true);

  useEffect(() => {
    const storedPref = localStorage.getItem('isDarkMode');
    if (storedPref !== null) {
      setIsDarkMode(storedPref === 'true');
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Refresh user data when component mounts
  useEffect(() => {
    const refreshUserData = async () => {
      try {
        // Force refresh user data from the server
        const response = await fetch('/api/users', {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        
        if (response.ok) {
          console.log('User data refreshed successfully');
        } else {
          console.error('Failed to refresh user data');
        }
      } catch (error) {
        console.error('Error refreshing user data:', error);
      } finally {
        setIsRefreshing(false);
      }
    };

    refreshUserData();
  }, []);

  // Auto-redirect countdown - only start after data is refreshed
  useEffect(() => {
    if (isRefreshing) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Force a hard refresh of the /projects page to ensure latest data
          window.location.href = '/projects';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRefreshing]);

  return (
    <main className={`min-h-screen flex flex-col ${
      isDarkMode 
        ? "bg-[#181818] text-white" 
        : "bg-[#f5f5f5] text-gray-900"
    }`}>
      <nav className={`sticky top-0 z-10 backdrop-blur-xl ${
        isDarkMode 
          ? "bg-[#201c1c]/80 border-b border-[#281c1c]/50" 
          : "bg-[#e8dccc]/80 border-b border-[#e8dccc]/50"
      }`}>
        <div className="container h-full mx-auto px-6 flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-all">
              <Image src="/logo-green.svg" alt="Chartable Logo" width={32} height={32} className="h-8 w-8" />
              <span className={`text-xl font-bold font-geist hidden md:block ${isDarkMode ? "text-white" : "text-gray-900"}`}>Chartable</span>
            </Link>
          </div>
        </div>
      </nav>
      
      <div className="w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />

      <div className="flex-grow flex items-center justify-center p-4">
        <div className={`max-w-md w-full rounded-2xl p-8 ${
          isDarkMode ? 'bg-[#202020] shadow-xl' : 'bg-white shadow-lg'
        }`}>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h1 className="text-3xl font-bold mb-4">Payment Successful!</h1>
            
            <p className={`mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Your credits have been added to your account. You can now continue using Chartable with your new credits.
            </p>
            
            <div className="flex flex-col space-y-4">
              <Link 
                href="/projects" 
                className="w-full py-3 px-4 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors shadow-lg shadow-primary/20 flex items-center justify-center"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = '/projects';
                }}
              >
                Return to Projects
              </Link>
              
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {isRefreshing ? 'Updating your credits...' : `Redirecting in ${countdown} seconds...`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// Main component that wraps SuccessContent in Suspense
export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-white text-lg">Loading payment confirmation...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
} 