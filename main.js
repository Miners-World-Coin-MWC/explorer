if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(() => console.log('Service Worker Registered!'))
      .catch(err => console.error('SW registration failed:', err));
  }
  