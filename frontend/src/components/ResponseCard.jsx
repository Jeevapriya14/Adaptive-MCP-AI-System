import React from 'react';

function ResponseCard({ data }) {
  const getModelColor = (model) => {
    if (model?.includes('gemini')) return 'bg-blue-100 text-blue-800';
    if (model?.includes('tensorflow')) return 'bg-green-100 text-green-800';
    if (model?.includes('pytorch')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Response</h3>
          {data.model_used && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getModelColor(data.model_used)}`}>
              {data.model_used}
            </span>
          )}
        </div>
        {data.session_id && (
          <div className="mt-2 text-sm text-gray-600">
            Session: <code className="bg-gray-200 px-2 py-1 rounded">{data.session_id}</code>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-6">
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>

      {/* Result Highlights */}
      {data.result && (
        <div className="px-6 pb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Key Results</h4>
          <div className="space-y-2">
            {data.result.response && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-xs font-medium text-blue-600 mb-1">Response</div>
                <div className="text-sm text-gray-900">{data.result.response}</div>
              </div>
            )}
            {data.result.sentiment && (
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-xs font-medium text-purple-600 mb-1">Sentiment</div>
                <div className="text-sm text-gray-900 capitalize">
                  {data.result.sentiment} ({data.result.confidence * 100}% confidence)
                </div>
              </div>
            )}
            {data.result.predictions && (
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-xs font-medium text-green-600 mb-1">Top Prediction</div>
                <div className="text-sm text-gray-900">
                  {data.result.top_prediction?.description} ({Math.round(data.result.top_prediction?.confidence * 100)}%)
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ResponseCard;
