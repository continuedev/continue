export async function* streamResponse(response: Response): AsyncGenerator<any> {
  if (response.status !== 200) {
    throw new Error(await response.text());
  }

  if (!response.body) {
    throw new Error(`No response body returned.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (value) {
      yield decoder.decode(value);
    }
  }
}
