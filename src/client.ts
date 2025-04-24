#!/usr/bin/env node

import { Configuration, DefaultApi } from "@continuedev/sdk";

export const client = new DefaultApi(
  new Configuration({
    basePath: "https://api.continue.dev",
    accessToken: () => "TOKEN", // Replace with your actual token
  })
);
