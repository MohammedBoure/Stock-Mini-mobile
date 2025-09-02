// js/script.js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker مسجل بنجاح:', registration);
      })
      .catch(error => {
        console.error('فشل تسجيل Service Worker:', error);
      });
  });
}