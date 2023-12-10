import cors from "cors";
import express from "express";
import http from "http";

const PROXY_PORT = 65433;
const app = express();
app.use(cors());

app.use((req, res, next) => {
  // Proxy the request
  const { origin, ...headers } = req.headers;
  const proxy = http.request(
    req.headers["x-continue-url"] as string,
    {
      method: req.method,
      headers: headers,
    },
    (response) => {
      // Pipe the response stream directly to the client
      response.pipe(res);
    }
  );

  // Pipe the request stream directly to the proxy
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

export function startProxy() {
  app.listen(PROXY_PORT, () => {
    console.log(`Proxy server is running on port ${PROXY_PORT}`);
  });
}
