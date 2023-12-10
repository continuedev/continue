import cors from "cors";
import express from "express";
import http from "http";
import https from "https";

const PROXY_PORT = 65433;
const app = express();
app.use(cors());

app.use((req, res, next) => {
  // Don't proxy the /sw route
  if (req.path === "/sw" || req.path === "/service-worker.js") {
    return next();
  }

  if (!req.headers["x-continue-url"]) {
    // Just let the request through
    return next();
  }

  // Proxy the request
  const { origin, ...headers } = req.headers;
  const url = req.headers["x-continue-url"] as string;
  const protocolString = url.split("://")[0];
  const protocol = protocolString === "https" ? https : http;
  const proxy = protocol.request(url, {
    method: req.method,
    headers: headers,
  });

  proxy.on("response", (response) => {
    response.pipe(res);
  });

  proxy.on("error", (error) => {
    console.error(error);
    res.sendStatus(500);
  });

  req.pipe(proxy);
});

// http-middleware-proxy
// app.use("/", (req, res, next) => {
//   // Extract the target from the request URL
//   const target = req.headers["x-continue-url"] as string;
//   const { origin, ...headers } = req.headers;

//   // Create a new proxy middleware for this request
//   const proxy = createProxyMiddleware({
//     target,
//     ws: true,
//     headers: {
//       origin: "",
//     },
//   });

//   // Call the middleware
//   proxy(req, res, next);
// });

app.get("/sw", (req, res) => {
  // Send a script that will register the service worker
  res.send(
    `<html><body><script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(function(registration) {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(function(error) {
          console.log('Service Worker registration failed:', error);
        });
    }
    
    </script></body></html>`
  );
});

app.get("/service-worker.js", (req, res) => {
  // Send the service worker script
  res.sendFile("/service-worker.js", { root: __dirname });
});

export function startProxy() {
  app.listen(PROXY_PORT, () => {
    console.log(`Proxy server is running on port ${PROXY_PORT}`);
  });
}
