importScripts('dataFetcher.js');

self.addEventListener('error', (event) => {
  console.error('Worker error:', event.error);
  self.postMessage({ error: 'Loading error: ' + event.error.message });
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Worker unhandled rejection:', event.reason);
  self.postMessage({ error: 'Loading error: ' + event.reason });
  event.preventDefault();
});