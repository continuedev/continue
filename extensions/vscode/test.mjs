import fetch from "node-fetch";

fetch(`http://localhost:11434/api/chat`, {
  method: "POST",
  body: JSON.stringify({
    messages: [{ role: "user", content: "Tell a story" }],
    stream: true,
    // max_tokens: 1000,
    model: "codellama:7b",
  }),
})
  .then((response) => {
    if (response.ok) {
      return response.body;
    }
    throw new Error("Network response was not ok.");
  })
  .then(async (stream) => {
    let i = 0;
    let c = "";
    for await (const chunk of stream) {
      i++;
      try {
        c += JSON.parse(chunk.toString()).message.content;

        console.clear();
        console.log(c);

        if (i > 40) {
          break;
        }
      } catch {
        console.log("error");
      }
    }
  })
  .catch((error) => {
    console.error("There has been a problem with your fetch operation:", error);
  });
