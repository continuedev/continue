// Valid config tab names
export type ConfigTab =
  | "models"
  | "rules"
  | "tools"
  | "configs"
  | "organizations"
  | "indexing"
  | "settings"
  | "help";

// TODO: Move all the routes here
export const ROUTES = {
  HOME: "/",
  HOME_INDEX: "/index.html",
  CONFIG: "/config",
  THEME: "/theme",
  STATS: "/stats",
  // EXAMPLE_ROUTE_WITH_PARAMS: (params: ParamsType) => `/route/${params}`,
};

// Helper function to build config URLs with tabs
export const buildConfigRoute = (tab?: ConfigTab): string => {
  return tab ? `${ROUTES.CONFIG}?tab=${tab}` : ROUTES.CONFIG;
};

// Typed config route builders for common tabs
export const CONFIG_ROUTES = {
  MODELS: buildConfigRoute("models"),
  RULES: buildConfigRoute("rules"),
  TOOLS: buildConfigRoute("tools"),
  CONFIGS: buildConfigRoute("configs"),
  ORGANIZATIONS: buildConfigRoute("organizations"),
  INDEXING: buildConfigRoute("indexing"),
  SETTINGS: buildConfigRoute("settings"),
  HELP: buildConfigRoute("help"),
} as const;
