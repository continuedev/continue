import { z } from "zod";

export const baseDevDataAllSchema = z.object({
  eventName: z.string(),
  schemaVersion: z.string(),
  createdAt: z.string(),
  userId: z.string(),
  userAgent: z.string(),
  selectedProfileId: z.string(),
  // gitCommitHash: z.string(),
});
