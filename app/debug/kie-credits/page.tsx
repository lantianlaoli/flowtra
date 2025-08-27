'use client';

import { useState, useEffect } from 'react';

interface CreditCheckResult {
  success: boolean;
  sufficient: boolean;
  currentCredits?: number;
  threshold?: number;
  error?: string;
}

export default function KieCreditDebug() {
  const [result, setResult] = useState<CreditCheckResult | null>(null);
  const [loading, setLoading] = useState(false);

  const checkCredits = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/check-kie-credits');
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        sufficient: false,
        error: 'Network error: ' + (error as Error).message
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    checkCredits();
  }, []);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">KIE Credits Debug</h1>
      
      <button
        onClick={checkCredits}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 mb-4"
      >
        {loading ? 'Checking...' : 'Check KIE Credits'}
      </button>

      {result && (
        <div className="bg-gray-100 p-4 rounded-lg">
          <h3 className="font-medium mb-2">API Response:</h3>
          <pre className="text-sm overflow-auto whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
          
          {result.success && (
            <div className="mt-4 p-4 border rounded">
              <div className="flex justify-between items-center">
                <span>Current Credits:</span>
                <span className="font-bold">{result.currentCredits}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Threshold:</span>
                <span className="font-bold">{result.threshold}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Status:</span>
                <span className={`font-bold ${result.sufficient ? 'text-green-600' : 'text-red-600'}`}>
                  {result.sufficient ? 'SUFFICIENT' : 'INSUFFICIENT - SHOULD SHOW MAINTENANCE'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}