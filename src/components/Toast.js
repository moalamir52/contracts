import React from 'react';

// Toast component for copy notifications
export default function Toast({ message, show }) {
  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#28a745',
      color: 'white',
      padding: '12px 24px',
      borderRadius: '8px',
      zIndex: 10000,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      transition: 'opacity 0.5s',
    }}>
      {message}
    </div>
  );
}
