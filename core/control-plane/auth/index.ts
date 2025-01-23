import { v4 as uuidv4 } from "uuid";

import { controlPlaneEnv } from "../env";

export async function getAuthUrlForTokenPage(): Promise<string> {
  const url = new URL("https://api.workos.com/user_management/authorize");
  const params = {
    response_type: "code",
    client_id: controlPlaneEnv.WORKOS_CLIENT_ID,
    redirect_uri: `${controlPlaneEnv.APP_URL}tokens/callback`,
    // redirect_uri: "http://localhost:3000/tokens/callback",
    state: uuidv4(),
    provider: "authkit",
  };
  Object.keys(params).forEach((key) =>
    url.searchParams.append(key, params[key as keyof typeof params]),
  );
  return url.toString();
}
