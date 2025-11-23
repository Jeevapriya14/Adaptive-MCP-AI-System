import React from 'react';

function LogViewer({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No routing logs available yet.
      </div>
    );
  }

  const getModelBadge = (model) => {
    const colors = {
      gemini: 'bg-blue-100 text-blue-800',
      tensorflow: 'bg-green-100 text-green-800',
      pytorch: 'bg-purple-100 text-purple-800'
    };
    return colors[model] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Timestamp
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Instruction
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Model
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Session ID
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {logs.map((log, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {new Date(log.timestamp).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                {log.instruction}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getModelBadge(log.model_selected)}`}>
                  {log.model_selected}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                {log.session_id?.substring(0, 8)}...
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default LogViewer;
