import dotenv from "dotenv";

dotenv.config();

export const env = {
  apiBase: process.env.CONTINUE_API_BASE ?? "https://api.continue.dev",
  workOsClientId: "client_01J0FW6XN8N2XJAECF7NE0Y65J",
  appUrl: "https://hub.continue.dev",
};
