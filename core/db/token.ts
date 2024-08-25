import { createClient, SupabaseClient, Session } from "@supabase/supabase-js";
import { jwtDecode, JwtPayload } from "jwt-decode";
import { SERVER_URL } from "../util/parameters";

let supabase: SupabaseClient | null = null;

async function initializeSupabase() {
    const supabaseTokens = await requestTokens();
    supabase = createClient(
      supabaseTokens.supabaseUrl,
      supabaseTokens.supabaseKey,
    );
}

interface DecodedToken extends JwtPayload {
  exp: number;
}

function isTokenExpired(token: string): boolean {
  const decodedToken: DecodedToken = jwtDecode<DecodedToken>(token);
  const currentTime: number = Date.now() / 1000;
  return decodedToken.exp < currentTime;
}

async function requestTokens(): Promise<{
  supabaseUrl: string;
  supabaseKey: string;
}> {
  const response = await fetch(`${SERVER_URL}/supabase-tokens`, {
    method: "GET",
  });
  const supabaseTokens = await response.json();
  return supabaseTokens;
}

export async function checkTokens(
  accessToken: string | undefined,
  refreshToken: string | undefined,
): Promise<{ accessToken: string; refreshToken: string }> {

  if (!supabase) {
    await initializeSupabase();
  }

  if (!accessToken) {
    return Promise.reject("Access token is not available");
  }

  if (!refreshToken) {
    return Promise.reject("Refresh token is not available");
  }

  if (isTokenExpired(accessToken)) {
    console.log("Access token is expired, attempting to refresh");

    const { data, error } = await supabase!.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data) {
      console.log("Error refreshing token, redirecting to login:", error);
      window.location.href = "/login";
      return Promise.reject("Error refreshing token");
    }

    accessToken = data.session?.access_token ?? "";
    refreshToken = data.session?.refresh_token ?? "";

    console.log("New access token:", accessToken);
    console.log("New refresh token:", refreshToken);
  } else {
    console.log("Access token is still valid");
  }

  return { accessToken, refreshToken };
}
