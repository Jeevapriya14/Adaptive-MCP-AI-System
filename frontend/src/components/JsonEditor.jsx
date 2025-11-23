import React from 'react';

function JsonEditor({ value, onChange }) {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(value);
      onChange(JSON.stringify(parsed, null, 2));
    } catch (error) {
      alert('Invalid JSON: ' + error.message);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          onClick={formatJson}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Format JSON
        </button>
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        rows="8"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder='{"key": "value"}'
      />
    </div>
  );
}

export default JsonEditor;
