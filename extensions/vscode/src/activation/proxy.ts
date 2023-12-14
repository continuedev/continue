import cors from "cors";
import express from "express";
import http from "http";
import https from "https";

const PROXY_PORT = 65433;
const app = express();
app.use(cors());

app.use((req, res, next) => {
  // Proxy the request
  const { origin, host, ...headers } = req.headers;
  const url = req.headers["x-continue-url"] as string;
  const parsedUrl = new URL(url);
  const protocolString = url.split("://")[0];
  const protocol = protocolString === "https" ? https : http;
  const proxy = protocol.request(url, {
    method: req.method,
    headers: {
      ...headers,
      host: parsedUrl.host,
    },
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

export function startProxy() {
  const server = app.listen(PROXY_PORT, () => {
    console.log(`Proxy server is running on port ${PROXY_PORT}`);
  });
  server.on("error", (e) => {
    console.log("Proxy server already running on 65433: ", e.message);
  });
}
