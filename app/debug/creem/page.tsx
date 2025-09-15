'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

interface CreemConfig {
  environment: string;
  isDevMode: boolean;
  apiUrls: {
    dev: string;
    prod: string;
    current: string;
  };
  apiKeys: {
    dev: string;
    prod: string;
    current: string;
  };
  productIds: {
    [key: string]: {
      dev: string;
      prod: string;
      current: string;
    };
  };
}

interface ConfigResponse {
  success: boolean;
  config: CreemConfig;
  issues: string[];
  isConfigValid: boolean;
}

export default function CreemDebugPage() {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      fetchConfig();
    } else if (isLoaded && !user) {
      setError('Please log in to access this debug page');
      setLoading(false);
    }
  }, [isLoaded, user]);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/creem-config');
      const data = await response.json();

      if (data.success) {
        setConfig(data);
      } else {
        setError(data.error || 'Failed to fetch configuration');
      }
    } catch (err) {
      setError('Network error while fetching configuration');
      console.error('Config fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading configuration...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">
          Error: {error}
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">No configuration data available</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Creem Configuration Debug</h1>

        {/* Status Overview */}
        <div className={`mb-6 p-4 rounded-lg ${config.isConfigValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          <h2 className="font-semibold mb-2">Configuration Status</h2>
          <p>{config.isConfigValid ? '✅ All configurations are valid' : '❌ Configuration issues detected'}</p>
        </div>

        {/* Issues */}
        {config.issues.length > 0 && (
          <div className="mb-6 bg-yellow-100 text-yellow-800 p-4 rounded-lg">
            <h2 className="font-semibold mb-2">Issues Found:</h2>
            <ul className="list-disc list-inside">
              {config.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Environment Info */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Environment Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium">Environment Variable:</span>
              <span className="ml-2 font-mono bg-gray-100 px-2 py-1 rounded">
                {config.config.environment || 'NOT SET'}
              </span>
            </div>
            <div>
              <span className="font-medium">Mode:</span>
              <span className="ml-2 font-mono bg-gray-100 px-2 py-1 rounded">
                {config.config.isDevMode ? 'DEVELOPMENT' : 'PRODUCTION'}
              </span>
            </div>
          </div>
        </div>

        {/* API Configuration */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">API Configuration</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">URLs</h3>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex justify-between">
                  <span>Development:</span>
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">
                    {config.config.apiUrls.dev || 'NOT SET'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Production:</span>
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">
                    {config.config.apiUrls.prod || 'NOT SET'}
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Current (Active):</span>
                  <span className="font-mono bg-blue-100 px-2 py-1 rounded text-sm">
                    {config.config.apiUrls.current || 'NOT SET'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-700 mb-2">API Keys</h3>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex justify-between">
                  <span>Development:</span>
                  <span className={`font-mono px-2 py-1 rounded text-sm ${
                    config.config.apiKeys.dev === 'CONFIGURED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {config.config.apiKeys.dev}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Production:</span>
                  <span className={`font-mono px-2 py-1 rounded text-sm ${
                    config.config.apiKeys.prod === 'CONFIGURED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {config.config.apiKeys.prod}
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Current (Active):</span>
                  <span className={`font-mono px-2 py-1 rounded text-sm ${
                    config.config.apiKeys.current === 'CONFIGURED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {config.config.apiKeys.current}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product IDs */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Product IDs</h2>
          <div className="space-y-6">
            {Object.entries(config.config.productIds).map(([packageName, ids]) => (
              <div key={packageName}>
                <h3 className="font-medium text-gray-700 mb-2 capitalize">{packageName} Package</h3>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex justify-between">
                    <span>Development:</span>
                    <span className={`font-mono px-2 py-1 rounded text-sm ${
                      ids.dev === 'CONFIGURED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {ids.dev}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Production:</span>
                    <span className={`font-mono px-2 py-1 rounded text-sm ${
                      ids.prod === 'CONFIGURED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {ids.prod}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Current (Active):</span>
                    <span className={`font-mono px-2 py-1 rounded text-sm ${
                      ids.current === 'CONFIGURED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {ids.current}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={fetchConfig}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh Configuration
          </button>
        </div>
      </div>
    </div>
  );
}