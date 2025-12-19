import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './app/App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // React.StrictMode is double-invoking effects in dev, which is fine, 
  // but for workers it might spawn double. We handle cleanup.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
