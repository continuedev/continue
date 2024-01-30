import cors from "cors";
import express from "express";
import { http, https } from "follow-redirects";

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
    res.status(response.statusCode || 500);
    for (let i = 1; i < response.rawHeaders.length; i += 2) {
      if (
        response.rawHeaders[i - 1].toLowerCase() ===
        "access-control-allow-origin"
      ) {
        continue;
      }
      res.setHeader(response.rawHeaders[i - 1], response.rawHeaders[i]);
    }
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
    // console.log("Proxy server already running on port 65433");
  });
}
