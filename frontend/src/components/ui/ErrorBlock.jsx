import React from 'react';

export default function ErrorBlock({ title = 'Error', description = 'Something went wrong', onRetry }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <div className="font-semibold text-red-800">{title}</div>
      <div className="mt-1 text-sm text-red-600">{description}</div>
      {onRetry && (
        <button 
          onClick={onRetry} 
          className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}
