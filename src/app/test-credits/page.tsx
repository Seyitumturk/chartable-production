'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TestCreditsPage() {
  const [credits, setCredits] = useState(5000);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const storedPref = localStorage.getItem('isDarkMode');
    if (storedPref !== null) {
      setIsDarkMode(storedPref === 'true');
    }
  }, []);

  const handleTestCredits = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/stripe/test-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credits }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add test credits');
      }

      setResult(data);
    } catch (error) {
      console.error('Error adding test credits:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Test Credits System</h1>
          <Link href="/projects" className={`px-4 py-2 rounded ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}>
            Back to Projects
          </Link>
        </div>

        <div className={`max-w-md mx-auto p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className="text-xl font-semibold mb-4">Add Test Credits</h2>
          <p className="mb-4 text-sm opacity-70">
            This page lets you test adding credits directly to your account without going through Stripe.
            It will help diagnose if there's an issue with the database or Stripe webhook.
          </p>
          
          <div className="mb-4">
            <label className="block mb-2 text-sm font-medium">
              Credits to Add
            </label>
            <input
              type="number"
              value={credits}
              onChange={(e) => setCredits(parseInt(e.target.value) || 0)}
              className={`w-full p-2 rounded border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
              min="1"
              max="100000"
            />
          </div>
          
          <button
            onClick={handleTestCredits}
            disabled={loading}
            className={`w-full py-2 px-4 rounded font-medium ${
              loading
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {loading ? 'Processing...' : 'Add Test Credits'}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-4 p-4 rounded border border-green-500/50 bg-green-500/20">
              <h3 className="font-medium mb-2">Success!</h3>
              <div className="text-sm space-y-1">
                <p><span className="opacity-70">Previous Balance:</span> {result.user.oldBalance.toLocaleString()}</p>
                <p><span className="opacity-70">Credits Added:</span> {result.user.added.toLocaleString()}</p>
                <p><span className="opacity-70">New Balance:</span> {result.user.newBalance.toLocaleString()}</p>
              </div>
              <div className="mt-4 text-xs opacity-70">
                <p>User ID: {result.user.id}</p>
                <p>Clerk ID: {result.user.clerkId}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 