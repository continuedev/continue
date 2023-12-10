// Install a service worker
self.addEventListener("install", (event) => {
  console.log("Service worker installed");
});

// Activate the service worker
self.addEventListener("activate", (event) => {
  console.log("Service worker activated");
});

self.addEventListener("fetch", function (event: any) {
  console.log("CALLED SERVICE WORKER");
  const url = new URL("http://localhost:65433");
  var newHeaders = new Headers(event.request.headers);
  newHeaders.append("X-Continue-Url", event.request.url);

  let newRequest = new Request(url, {
    method: event.request.method,
    headers: event.request.headers,
    mode: event.request.mode === "navigate" ? "cors" : event.request.mode,
    credentials: event.request.credentials,
    redirect: event.request.redirect,
  });

  event.respondWith(fetch(newRequest));
});
