'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function TestCreditsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState(5000);
  const { isLoaded, userId } = useAuth();
  const router = useRouter();

  const addTestCredits = async () => {
    if (!userId) {
      setError('You must be logged in to test credits');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log(`[TEST_CREDITS] Sending test credits request: ${credits}`);
      
      const response = await fetch('/api/stripe/test-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credits }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[TEST_CREDITS] Test webhook response:', data);
        setResult(data);
        
        // Refresh user data
        await fetch('/api/users', {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
      } else {
        const errorData = await response.json();
        console.error('[TEST_CREDITS] Test webhook error:', errorData);
        setError(errorData.error || 'Failed to add test credits');
      }
    } catch (err) {
      console.error('[TEST_CREDITS] Error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return <div className="p-8">Loading...</div>;
  }

  if (!userId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Test Credits</h1>
        <p className="text-red-500">You must be logged in to use this page</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Test Credits</h1>
      <p className="mb-6 text-gray-600">
        This page allows you to add test credits directly to your account without going through Stripe.
        It's for testing purposes only.
      </p>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <div className="mb-4">
          <label htmlFor="credits" className="block text-sm font-medium text-gray-700 mb-1">
            Credits to Add
          </label>
          <input
            id="credits"
            type="number"
            value={credits}
            onChange={(e) => setCredits(parseInt(e.target.value) || 0)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>

        <button
          onClick={addTestCredits}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
        >
          {loading ? 'Adding Credits...' : 'Add Test Credits'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-md mb-6">
          <h2 className="text-xl font-semibold text-green-800 mb-2">Credits Added!</h2>
          <div className="text-green-700">
            <p><strong>Old Balance:</strong> {result.user.oldBalance}</p>
            <p><strong>Credits Added:</strong> {result.user.added}</p>
            <p><strong>New Balance:</strong> {result.user.newBalance}</p>
          </div>
          <div className="mt-4">
            <button
              onClick={() => router.push('/projects')}
              className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
            >
              Back to Projects
            </button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Debugging Info</h2>
        <p><strong>User ID:</strong> {userId}</p>
      </div>
    </div>
  );
} 