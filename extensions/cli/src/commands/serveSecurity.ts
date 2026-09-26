import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

export function getServeHost(options: { host?: string }): string {
  return options.host || process.env.CONTINUE_SERVER_HOST || "127.0.0.1";
}

export function getServeAuthToken(options: {
  noAuth?: boolean;
  authToken?: string;
}): string | null {
  if (options.noAuth || process.env.CONTINUE_ALLOW_UNAUTHENTICATED === "true") {
    return null;
  }
  return (
    options.authToken ||
    process.env.CONTINUE_SERVER_TOKEN ||
    process.env.CONTINUE_API_KEY ||
    crypto.randomBytes(24).toString("hex")
  );
}

export function createAuthMiddleware(authToken: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : (req.headers["x-continue-token"] as string | undefined) ||
        (req.query.token as string | undefined);

    if (!bearerToken || bearerToken !== authToken) {
      return res.status(401).json({
        error: "Unauthorized: Invalid or missing authentication token",
      });
    }
    next();
  };
}
