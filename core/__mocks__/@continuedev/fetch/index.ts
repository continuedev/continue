import { vi } from "vitest";

export const fetchwithRequestOptions = vi.fn(
  async (url, options, requestOptions) => {
    console.log("Mocked fetch called with:", url, options, requestOptions);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
    };
  },
);

export const streamSse = vi.fn(function* () {
  yield "";
});
