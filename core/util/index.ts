export function removeQuotesAndEscapes(output: string): string {
  output = output.trim();

  // Replace smart quotes
  output = output.replace("“", '"');
  output = output.replace("”", '"');
  output = output.replace("‘", "'");
  output = output.replace("’", "'");

  // Remove escapes
  output = output.replace('\\"', '"');
  output = output.replace("\\'", "'");
  output = output.replace("\\n", "\n");
  output = output.replace("\\t", "\t");
  output = output.replace("\\\\", "\\");
  if (
    (output.startsWith('"') && output.endsWith('"')) ||
    (output.startsWith("'") && output.endsWith("'"))
  ) {
    output = output.slice(1, -1);
  }

  return output;
}

export function proxyFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!(window as any)._fetch) {
    throw new Error("Proxy fetch not initialized");
  }

  const headers = new Headers(init?.headers);
  headers.append("x-continue-url", url);

  return (window as any)._fetch("http://localhost:65433", {
    ...init,
    headers,
  });
}
