import React, { useState, useEffect } from 'react';
import LogViewer from '../components/LogViewer';

function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    gemini: 0,
    tensorflow: 0,
    pytorch: 0
  });

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/logs?limit=50');
      const data = await response.json();
      setLogs(data.logs);
      const total = data.logs.length;
      const gemini = data.logs.filter(log => log.model_selected === 'gemini').length;
      const tensorflow = data.logs.filter(log => log.model_selected === 'tensorflow').length;
      const pytorch = data.logs.filter(log => log.model_selected === 'pytorch').length;

      setStats({ total, gemini, tensorflow, pytorch });
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm font-medium mb-2">Total Requests</div>
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
        </div>

        <div className="bg-blue-50 rounded-lg shadow p-6">
          <div className="text-blue-600 text-sm font-medium mb-2">Gemini</div>
          <div className="text-3xl font-bold text-blue-900">{stats.gemini}</div>
          <div className="text-sm text-blue-600 mt-1">
            {stats.total > 0 ? Math.round((stats.gemini / stats.total) * 100) : 0}%
          </div>
        </div>

        <div className="bg-green-50 rounded-lg shadow p-6">
          <div className="text-green-600 text-sm font-medium mb-2">TensorFlow</div>
          <div className="text-3xl font-bold text-green-900">{stats.tensorflow}</div>
          <div className="text-sm text-green-600 mt-1">
            {stats.total > 0 ? Math.round((stats.tensorflow / stats.total) * 100) : 0}%
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg shadow p-6">
          <div className="text-purple-600 text-sm font-medium mb-2">PyTorch</div>
          <div className="text-3xl font-bold text-purple-900">{stats.pytorch}</div>
          <div className="text-sm text-purple-600 mt-1">
            {stats.total > 0 ? Math.round((stats.pytorch / stats.total) * 100) : 0}%
          </div>
        </div>
      </div>

      {}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Recent Routing Logs</h2>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading logs...</div>
          ) : (
            <LogViewer logs={logs} />
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
