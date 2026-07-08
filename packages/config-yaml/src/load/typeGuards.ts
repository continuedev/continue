import * as z from "zod";
import { blockItemWrapperSchema } from "../schemas/index.js";

export const isBlockItemWrapper = (
  block: unknown,
): block is z.infer<
  ReturnType<typeof blockItemWrapperSchema<z.AnyZodObject>>
> => {
  const baseSchema = z.object({});
  const schema = blockItemWrapperSchema(baseSchema);

  return schema.safeParse(block).success;
};
