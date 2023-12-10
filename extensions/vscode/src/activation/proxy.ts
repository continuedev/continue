import cors from "cors";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const PROXY_PORT = 65433;
const app = express();
app.use(cors());

app.use("/", (req, res, next) => {
  // Extract the target from the request URL
  //   const { protocol, host } = url.parse(req.url);
  //   const target = `${protocol}//${host}`;
  const target = "http://localhost:11434";

  // Create a new proxy middleware for this request
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    pathRewrite: {
      "^/": "/api/generate",
    },
  });

  // Call the middleware
  proxy(req, res, next);
});

export function startProxy() {
  console.log("Starting proxy");
  app.listen(PROXY_PORT, () => {
    console.log(`Proxy server is running on port ${PROXY_PORT}`);
  });
}
