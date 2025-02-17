import { quickEditEventAllSchema } from "./index.js";

export const quickEditEventSchema_0_1_0 = quickEditEventAllSchema.pick({
  prompt: true,
  path: true,
  label: true,
  diffs: true,
  model: true,
});

export const quickEditEventSchema_0_1_0_noPII = quickEditEventSchema_0_1_0.omit(
  {
    prompt: true,
    path: true,
    diffs: true,
  },
);
