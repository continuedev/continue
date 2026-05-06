import * as fs from "node:fs";
import { IdeSettings } from "..";
import {
  getLocalEnvironmentDotFilePath,
  getStagingEnvironmentDotFilePath,
} from "../util/paths";
import { AuthType, ControlPlaneEnv } from "./AuthTypes";
import { getBrandEnv, isHubDisabled } from "./brandEnv";
import { getLicenseKeyData } from "./mdm/mdm";

export const EXTENSION_NAME = "yutoagentic";

function buildHubEnv(
  authType: AuthType.WorkOsProd | AuthType.WorkOsStaging,
): ControlPlaneEnv {
  const brand = getBrandEnv();
  return {
    DEFAULT_CONTROL_PLANE_PROXY_URL: brand.apiUrl,
    CONTROL_PLANE_URL: brand.apiUrl,
    AUTH_TYPE: authType,
    WORKOS_CLIENT_ID: brand.workosClientId,
    APP_URL: brand.appUrl,
  };
}

const LOCAL_ENV: ControlPlaneEnv = {
  DEFAULT_CONTROL_PLANE_PROXY_URL: "http://localhost:3001/",
  CONTROL_PLANE_URL: "http://localhost:3001/",
  AUTH_TYPE: AuthType.WorkOsStaging,
  WORKOS_CLIENT_ID: "",
  APP_URL: "http://localhost:3000/",
};

export async function enableHubContinueDev() {
  return !isHubDisabled();
}

export async function getControlPlaneEnv(
  ideSettingsPromise: Promise<IdeSettings>,
): Promise<ControlPlaneEnv> {
  const ideSettings = await ideSettingsPromise;
  return getControlPlaneEnvSync(ideSettings.continueTestEnvironment);
}

export function getControlPlaneEnvSync(
  ideTestEnvironment: IdeSettings["continueTestEnvironment"],
): ControlPlaneEnv {
  // MDM override
  const licenseKeyData = getLicenseKeyData();
  if (licenseKeyData?.unsignedData?.apiUrl) {
    const { apiUrl } = licenseKeyData.unsignedData;
    return {
      AUTH_TYPE: AuthType.OnPrem,
      DEFAULT_CONTROL_PLANE_PROXY_URL: apiUrl,
      CONTROL_PLANE_URL: apiUrl,
      APP_URL: getBrandEnv().appUrl,
    };
  }

  // Note .local overrides .staging
  if (fs.existsSync(getLocalEnvironmentDotFilePath())) {
    return LOCAL_ENV;
  }

  if (fs.existsSync(getStagingEnvironmentDotFilePath())) {
    return buildHubEnv(AuthType.WorkOsStaging);
  }

  const env =
    ideTestEnvironment === "production"
      ? "hub"
      : ideTestEnvironment === "staging"
        ? "staging"
        : ideTestEnvironment === "local"
          ? "local"
          : process.env.CONTROL_PLANE_ENV;

  if (env === "local") {
    return LOCAL_ENV;
  }
  if (env === "staging" || env === "test") {
    return buildHubEnv(AuthType.WorkOsStaging);
  }
  return buildHubEnv(AuthType.WorkOsProd);
}

export async function useHub(
  ideSettingsPromise: Promise<IdeSettings>,
): Promise<boolean> {
  const ideSettings = await ideSettingsPromise;
  return ideSettings.continueTestEnvironment !== "none";
}
