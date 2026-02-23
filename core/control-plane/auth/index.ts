import { v4 as uuidv4 } from "uuid";
import { IdeSettings } from "../..";
import { isHubEnv } from "../AuthTypes";
import { getControlPlaneEnv } from "../env";

export async function getAuthUrlForTokenPage(
  ideSettingsPromise: Promise<IdeSettings>,
  useOnboarding: boolean,
): Promise<string> {
  const env = await getControlPlaneEnv(ideSettingsPromise);

  if (!isHubEnv(env)) {
    throw new Error("Sign in disabled");
  }

  const url = new URL("https://api.workos.com/user_management/authorize");
  const params = {
    response_type: "code",
    client_id: env.WORKOS_CLIENT_ID,
    redirect_uri: `${env.APP_URL}tokens/${useOnboarding ? "onboarding-" : ""}callback`,
    // redirect_uri: "http://localhost:3000/tokens/callback",
    state: uuidv4(),
    provider: "authkit",
  };
  Object.keys(params).forEach((key) =>
    url.searchParams.append(key, params[key as keyof typeof params]),
  );
  return url.toString();
}
