import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import RequestConsole from './pages/RequestConsole';
import StreamingConsole from './pages/StreamingConsole';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between h-16">
              <div className="flex space-x-8">
                <Link to="/" className="flex items-center text-gray-700 hover:text-blue-600 font-medium">
                  🤖 MCP Request
                </Link>
                <Link to="/streaming" className="flex items-center text-gray-700 hover:text-blue-600 font-medium">
                  📡 Streaming
                </Link>
                <Link to="/dashboard" className="flex items-center text-gray-700 hover:text-blue-600 font-medium">
                  📊 Dashboard
                </Link>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-600">Adaptive MCP-AI System</span>
              </div>
            </div>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<RequestConsole />} />
          <Route path="/streaming" element={<StreamingConsole />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
