// This is a simple Express server to serve Swagger UI
import express from "express";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";

// ES Module handling for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the OpenAPI spec
const openApiYaml = fs.readFileSync(
  path.join(__dirname, "openapi.yaml"),
  "utf8",
);
const openApiSpec = yaml.load(openApiYaml);

const app = express();
const port = process.env.PORT || 3002;

// Serve the Swagger UI at the root URL
app.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    swaggerOptions: {
      docExpansion: "list", // or 'full' or 'none'
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  }),
);

// Start the server
app.listen(port, () => {
  console.log(`Swagger UI is running at http://localhost:${port}`);
  console.log(`Press Ctrl+C to stop the server`);
});
