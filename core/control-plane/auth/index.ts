import { v4 as uuidv4 } from "uuid";

const CLIENT_ID = "client_01J0FW6XN8N2XJAECF7NE0Y65J";
// const CLIENT_ID = "client_01J0FW6XCPMJMQ3CG51RB4HBZQ"; // Staging

export async function getAuthUrlForTokenPage(): Promise<string> {
  const url = new URL("https://api.workos.com/user_management/authorize");
  const params = {
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: "https://app.continue.dev/tokens/callback",
    // redirect_uri: "http://localhost:3000/tokens/callback",
    state: uuidv4(),
    provider: "authkit",
  };
  Object.keys(params).forEach((key) =>
    url.searchParams.append(key, params[key as keyof typeof params]),
  );
  return url.toString();
}
