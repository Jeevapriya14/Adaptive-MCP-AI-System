import React, { useState, useRef, useEffect } from 'react';
import JsonEditor from '../components/JsonEditor';

function StreamingConsole() {
  const [instruction, setInstruction] = useState('');
  const [payload, setPayload] = useState('{}');
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const sid = sessionId || `session_${Date.now()}`;
    setSessionId(sid);
    setConnecting(true);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/${sid}`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      setConnected(true);
      setConnecting(false);
      setMessages(prev => [...prev, { type: 'system', content: 'Connected to WebSocket' }]);
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev, { type: 'response', content: data }]);
    };

    wsRef.current.onerror = (error) => {
      setMessages(prev => [...prev, { type: 'error', content: 'WebSocket error occurred' }]);
      setConnected(false);
      setConnecting(false);
    };

    wsRef.current.onclose = () => {
      setConnected(false);
      setConnecting(false);
      setMessages(prev => [...prev, { type: 'system', content: 'Disconnected from WebSocket' }]);
    };
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const sendMessage = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('Please connect WebSocket first');
      return;
    }

    try {
      const parsedPayload = JSON.parse(payload);
      const message = {
        instruction,
        payload: parsedPayload,
        context: {}
      };

      wsRef.current.send(JSON.stringify(message));
      setMessages(prev => [...prev, { type: 'sent', content: message }]);
      setInstruction('');
      setPayload('{}');
    } catch (error) {
      alert('Invalid JSON payload: ' + error.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">WebSocket Streaming Console</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="Auto-generated on connect"
                disabled={connected}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
              {!connected ? (
                <button
                  onClick={connectWebSocket}
                  disabled={connecting}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
                >
                  {connecting ? 'Connecting...' : 'Connect'}
                </button>
              ) : (
                <button
                  onClick={disconnectWebSocket}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium text-gray-700">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instruction
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Enter your instruction..."
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
            onClick={sendMessage}
            disabled={!connected || !instruction}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            Send via WebSocket
          </button>

          <button
            onClick={() => setMessages([])}
            className="w-full bg-gray-600 text-white py-2 px-6 rounded-lg hover:bg-gray-700 font-medium"
          >
            Clear Messages
          </button>
        </div>

        {}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Messages</h2>
          <div className="bg-gray-900 rounded-lg p-4 h-[600px] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                No messages yet. Connect and send a request.
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded ${
                      msg.type === 'sent'
                        ? 'bg-blue-900 text-blue-100'
                        : msg.type === 'response'
                        ? 'bg-green-900 text-green-100'
                        : msg.type === 'error'
                        ? 'bg-red-900 text-red-100'
                        : 'bg-gray-800 text-gray-300'
                    }`}
                  >
                    <div className="text-xs font-semibold mb-1 uppercase">
                      {msg.type}
                    </div>
                    <pre className="text-sm whitespace-pre-wrap break-words">
                      {JSON.stringify(msg.content, null, 2)}
                    </pre>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StreamingConsole;
