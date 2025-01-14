import { readUsePlatform } from "../util/paths";
import { usePlatform } from "./flags";

interface ControlPlaneEnv {
  DEFAULT_CONTROL_PLANE_PROXY_URL: string;
  CONTROL_PLANE_URL: string;
  AUTH_TYPE: string;
  WORKOS_CLIENT_ID: string;
  APP_URL: string;
}

export const EXTENSION_NAME = "continue";

const WORKOS_CLIENT_ID_PRODUCTION = "client_01J0FW6XN8N2XJAECF7NE0Y65J";
const WORKOS_CLIENT_ID_STAGING = "client_01J0FW6XCPMJMQ3CG51RB4HBZQ";

const WORKOS_ENV_ID_PRODUCTION = "continue";
const WORKOS_ENV_ID_STAGING = "continue-staging";

const PRODUCTION_ENV: ControlPlaneEnv = {
  DEFAULT_CONTROL_PLANE_PROXY_URL:
    "https://control-plane-api-service-i3dqylpbqa-uc.a.run.app/",
  CONTROL_PLANE_URL:
    "https://control-plane-api-service-i3dqylpbqa-uc.a.run.app/",
  AUTH_TYPE: WORKOS_ENV_ID_PRODUCTION,
  WORKOS_CLIENT_ID: WORKOS_CLIENT_ID_PRODUCTION,
  APP_URL: "https://app.continue.dev/",
};

const STAGING_ENV: ControlPlaneEnv = {
  DEFAULT_CONTROL_PLANE_PROXY_URL:
    "https://control-plane-api-service-537175798139.us-central1.run.app/",
  CONTROL_PLANE_URL:
    "https://control-plane-api-service-537175798139.us-central1.run.app/",
  AUTH_TYPE: WORKOS_CLIENT_ID_STAGING,
  WORKOS_CLIENT_ID: WORKOS_CLIENT_ID_STAGING,
  APP_URL: "https://app-preview.continue.dev/",
};

const TEST_ENV: ControlPlaneEnv = {
  DEFAULT_CONTROL_PLANE_PROXY_URL: "https://api-test.continue.dev/",
  CONTROL_PLANE_URL: "https://api-test.continue.dev/",
  AUTH_TYPE: WORKOS_ENV_ID_STAGING,
  WORKOS_CLIENT_ID: WORKOS_CLIENT_ID_STAGING,
  APP_URL: "https://app-test.continue.dev/",
};

const LOCAL_ENV: ControlPlaneEnv = {
  DEFAULT_CONTROL_PLANE_PROXY_URL: "http://localhost:3001/",
  CONTROL_PLANE_URL: "http://localhost:3001/",
  AUTH_TYPE: WORKOS_ENV_ID_STAGING,
  WORKOS_CLIENT_ID: WORKOS_CLIENT_ID_STAGING,
  APP_URL: "http://localhost:3000/",
};

function getControlPlaneEnv(): ControlPlaneEnv {
  const usePlatformFileEnv = readUsePlatform();
  const env = usePlatformFileEnv || process.env.CONTROL_PLANE_ENV;

  return env === "local"
    ? LOCAL_ENV
    : env === "staging"
      ? STAGING_ENV
      : env === "test" || usePlatform()
        ? TEST_ENV
        : PRODUCTION_ENV;
}

export const controlPlaneEnv = getControlPlaneEnv();
