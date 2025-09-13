// worker لجلب البيانات ومعالجتها
importScripts('dataFetcher.js');

self.onmessage = function(event) {
  // إعادة توجيه الرسالة إلى dataFetcher.js
  self.dispatchEvent(new MessageEvent('message', { data: event.data }));
};
