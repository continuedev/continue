import type * as http from "node:http";
import type * as net from "node:net";

/** Seconds to wait for a TCP connection when `connectTimeout` is not set. */
export const DEFAULT_CONNECT_TIMEOUT_SECONDS = 10;

/**
 * Give a request a connect timeout: when the socket it is given has not
 * connected within `ms`, the request is destroyed with an ETIMEDOUT error.
 *
 * Node's http and https agents have none of their own, so a server whose
 * packets are dropped (a host that is down, a firewall, a VPN that is not
 * up) makes a request wait out the operating system's TCP timeout, about
 * 21 s on Windows, and again for each retry. A reachable server connects in
 * milliseconds, so a few seconds is enough. The `timeout` request option, for
 * the whole response, is unchanged.
 *
 * This watches the request rather than wrapping an agent: in VS Code the
 * extension host can replace the agent for its proxy support, and the
 * request still gets a socket. A socket reused from the keep-alive pool is
 * already connected and is left alone.
 */
export function armConnectTimeout(
  request: http.ClientRequest,
  ms: number | undefined,
): void {
  if (!(ms !== undefined && ms > 0)) return;
  request.once("socket", (socket: net.Socket) => {
    if (!socket.connecting) return;
    const timer = setTimeout(() => {
      const host = (request as { host?: string }).host ?? "";
      const error = Object.assign(
        new Error(
          `connect ETIMEDOUT ${host} (no answer within ${ms / 1000} s)`,
        ),
        { code: "ETIMEDOUT", errno: "ETIMEDOUT", syscall: "connect" },
      );
      request.destroy(error);
    }, ms);
    timer.unref?.();
    const clear = () => clearTimeout(timer);
    socket.once("connect", clear);
    socket.once("close", clear);
  });
}
