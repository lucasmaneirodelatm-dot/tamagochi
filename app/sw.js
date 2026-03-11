self.addEventListener("install", event => {
  console.log("Service Worker activo");
});

self.addEventListener("fetch", event => {
  // Este sw.js no hace caching todavía, solo es para cumplir PWA
});
