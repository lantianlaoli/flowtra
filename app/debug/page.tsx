'use client';

import { useState } from 'react';

export default function DebugPage() {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const callMonitorTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/monitor-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">调试面板</h1>
      
      <div className="space-y-4">
        <button
          onClick={callMonitorTasks}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '执行中...' : '手动触发任务监控'}
        </button>

        {result && (
          <div className="bg-gray-100 p-4 rounded-lg">
            <h3 className="font-medium mb-2">结果:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}