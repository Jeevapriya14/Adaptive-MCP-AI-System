import React, { useState } from 'react';
import JsonEditor from '../components/JsonEditor';
import ResponseCard from '../components/ResponseCard';

function RequestConsole() {
  const [instruction, setInstruction] = useState('');
  const [payload, setPayload] = useState('{}');
  const [sessionId, setSessionId] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSendRequest = async () => {
    setLoading(true);
    setResponse(null);

    try {
      const parsedPayload = JSON.parse(payload);

      const requestBody = {
        instruction,
        payload: parsedPayload,
        context: {}
      };

      if (sessionId) {
        requestBody.session_id = sessionId;
      }

      const res = await fetch('/mcp/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      setResponse(data);

      // Update session ID if returned
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
      }
    } catch (error) {
      setResponse({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">MCP Request Console</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session ID (optional)
            </label>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Leave empty to auto-generate"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instruction
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Enter your instruction here..."
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payload (JSON)
            </label>
            <JsonEditor value={payload} onChange={setPayload} />
          </div>

          <button
            onClick={handleSendRequest}
            disabled={loading || !instruction}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? 'Sending...' : 'Send Request'}
          </button>
        </div>

        {/* Response Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Response</h2>
          {response ? (
            <ResponseCard data={response} />
          ) : (
            <div className="bg-gray-100 rounded-lg p-8 text-center text-gray-500">
              No response yet. Send a request to see results.
            </div>
          )}
        </div>
      </div>

      {/* Examples */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Example Instructions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => {
              setInstruction('Analyze the sentiment of this review');
              setPayload(JSON.stringify({ text: 'This product is amazing! I love it!' }, null, 2));
            }}
            className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 text-left transition-colors"
          >
            <div className="font-medium text-gray-900">Sentiment Analysis</div>
            <div className="text-sm text-gray-600 mt-1">Route to PyTorch model</div>
          </button>

          <button
            onClick={() => {
              setInstruction('Classify this image');
              setPayload(JSON.stringify({ image_base64: '' }, null, 2));
            }}
            className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 text-left transition-colors"
          >
            <div className="font-medium text-gray-900">Image Classification</div>
            <div className="text-sm text-gray-600 mt-1">Route to TensorFlow model</div>
          </button>

          <button
            onClick={() => {
              setInstruction('Explain quantum computing in simple terms');
              setPayload('{}');
            }}
            className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 text-left transition-colors"
          >
            <div className="font-medium text-gray-900">General Query</div>
            <div className="text-sm text-gray-600 mt-1">Route to Gemini model</div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default RequestConsole;
