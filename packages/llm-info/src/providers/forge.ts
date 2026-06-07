import { ModelProvider } from "../types.js";

export const Forge: ModelProvider = {
  models: [
    {
      model: "forge-turbo",
      displayName: "Forge Turbo",
      recommendedFor: ["embed"],
    },
    {
      model: "forge-pro",
      displayName: "Forge Pro",
      recommendedFor: ["embed"],
    },
    {
      model: "forge-ultra-4k",
      displayName: "Forge Ultra 4K",
      recommendedFor: ["embed"],
    },
  ],
  id: "forge",
  displayName: "Forge",
};
