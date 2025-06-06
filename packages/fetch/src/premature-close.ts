export function getPrematureCloseErrorMessage(chunks: number): string {
  if (chunks === 0) {
    return "Connection was closed before any data was received (Premature close). Try again.";
  } else {
    return (
      "Stream was cancelled mid-stream. This can happen for various reasons, including:\n" +
      "- Malformed chunks of data received from the server\n" +
      "- The server closed the connection before sending the complete response\n" +
      "- Long delays from the server during streaming\n" +
      "- 'Keep alive' header being used in combination with an http agent and a set, low number of maxSockets\n" +
      "The underlying node fetch error is 'Premature Close'"
    );
  }
}
