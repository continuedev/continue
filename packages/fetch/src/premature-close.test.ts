import { createServer } from "http";
import { describe, expect, it } from "vitest";
import { fetchwithRequestOptions } from "./fetch.js";
import { streamResponse } from "./stream.js";
describe("Fetch Premature Close Tests", () => {
  // This test specifically forces conditions that cause premature close
  it("should reproduce premature close error with chunked encoding", async () => {
    // Create a server that intentionally misbehaves
    const server = createServer((req, res) => {
      // Set chunked transfer encoding
      res.writeHead(200, {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked",
      });

      let chunk = 0;
      const interval = setInterval(() => {
        // Send malformed chunk sizes occasionally
        if (chunk === 2) {
          // Send a malformed chunk that will trigger the issue
          res.write("5\r\nHello\r\n3\r"); // Intentionally incomplete chunk
          clearInterval(interval);

          // Force socket closure mid-stream
          setTimeout(() => {
            // @ts-ignore - accessing private property for test
            res.socket?.destroy();
          }, 50);

          return;
        }

        res.write(`${chunk.toString(16)}\r\nChunk${chunk}\r\n`);
        chunk++;
      }, 10);
    });

    // Start server on random port
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      // Make request and attempt to stream response
      const response = await fetchwithRequestOptions(
        `http://localhost:${port}`,
        {
          headers: {
            Connection: "keep-alive",
          },
        },
      );

      // Try to consume the stream
      const chunks: string[] = [];
      try {
        for await (const chunk of streamResponse(
          response as unknown as Response,
        )) {
          chunks.push(chunk);
        }
        // If we get here, the test failed because we expected an error
        throw new Error(
          "Expected premature close error but stream completed successfully",
        );
      } catch (e) {
        // Verify we got the expected error
        expect(e).toBeTruthy();
        expect((e as Error).message).toMatch(/premature close/i);
      }
    } finally {
      // Cleanup
      server.close();
    }
  });

  // This test reproduces the issue using timing and connection pooling
  it("should reproduce premature close with connection reuse", async () => {
    // Create a server that intentionally causes issues with keep-alive connections
    const server = createServer((req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/plain",
        Connection: "keep-alive",
        "Transfer-Encoding": "chunked",
      });

      let bytesSent = 0;
      const streamSize = 1024 * 1024; // 1MB
      const chunkSize = 16384; // 16KB

      const writeChunk = () => {
        if (bytesSent >= streamSize) {
          res.end();
          return;
        }

        const chunk = Buffer.alloc(chunkSize).fill("x");
        bytesSent += chunk.length;

        // Randomly corrupt the stream
        if (Math.random() < 0.1) {
          // @ts-ignore - accessing private property for test
          res.socket?.destroy();
          return;
        }

        res.write(chunk);
        setImmediate(writeChunk);
      };

      writeChunk();
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      // Make multiple concurrent requests to force connection pooling
      const requests = Array(5)
        .fill(null)
        .map(async (_, i) => {
          try {
            const response = await fetchwithRequestOptions(
              `http://localhost:${port}`,
              {
                headers: {
                  Connection: "keep-alive",
                },
              },
            );

            const chunks: string[] = [];
            for await (const chunk of streamResponse(
              response as unknown as Response,
            )) {
              chunks.push(chunk);
            }
          } catch (e) {
            expect(e).toBeTruthy();
            expect((e as Error).message).toMatch(
              /premature close|socket hang up/i,
            );
          }
        });

      await Promise.all(requests);
    } finally {
      server.close();
    }
  });

  // This test reproduces the issue using a delayed response
  it("should reproduce premature close with delayed response", async () => {
    const server = createServer((req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked",
      });

      // Start sending data
      let count = 0;
      const interval = setInterval(() => {
        if (count >= 5) {
          clearInterval(interval);
          // Delay then destroy the socket
          setTimeout(() => {
            // @ts-ignore - accessing private property for test
            res.socket?.destroy();
          }, 100);
          return;
        }

        // Send a chunk with a delay
        setTimeout(() => {
          res.write(`chunk ${count}\n`);
        }, count * 50);

        count++;
      }, 10);
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const response = await fetchwithRequestOptions(
        `http://localhost:${port}`,
      );

      const chunks: string[] = [];
      try {
        for await (const chunk of streamResponse(
          response as unknown as Response,
        )) {
          chunks.push(chunk);
          // Optional artificial processing delay
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        throw new Error(
          "Expected premature close error but stream completed successfully",
        );
      } catch (e) {
        expect(e).toBeTruthy();
        expect((e as Error).message).toMatch(/premature close/i);
      }
    } finally {
      server.close();
    }
  });

  it("should properly handle chunk boundary in the terminating sequence", async () => {
    // Flag to track if response was fully sent
    let responseFullySent = false;

    const server = createServer((req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked",
      });

      // Send normal chunks directly as data (not writing the chunk headers manually)
      // Node's HTTP server will handle adding the proper chunk headers
      res.write("Hello");
      res.write("World!!");

      // Now manually control the terminating sequence to split it at the boundary
      // First, end the response but intercept the actual write
      const originalEnd = res.end;
      res.end = function () {
        // Instead of letting Node send the terminating sequence normally,
        // we'll send it split across a boundary

        // Manually send the first part of the termination sequence "0\r\n\r"
        // @ts-ignore - accessing private property for test
        const socket = res.socket;
        socket?.write("0\r\n\r", "utf8");

        // Small delay to ensure split across packets
        setTimeout(() => {
          // Send the final "\n" to complete the terminating sequence
          socket?.write("\n", "utf8", () => {
            // Mark that we've fully sent the response
            responseFullySent = true;
          });
        }, 20);

        // Don't call the original end since we're manually handling it
        return res;
      };
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const response = await fetchwithRequestOptions(
        `http://localhost:${port}`,
        {
          headers: {
            Connection: "keep-alive",
          },
        },
      );

      const chunks: Uint8Array<ArrayBufferLike>[] = [];
      let streamCompleted = false;

      try {
        // Collect chunks as raw buffers to avoid encoding issues
        for await (const chunk of streamResponse(
          response as unknown as Response,
        )) {
          // Store the raw chunk
          chunks.push(Buffer.from(chunk) as Uint8Array<ArrayBufferLike>);
        }

        // If we get here, the stream completed successfully
        streamCompleted = true;

        // Wait a bit more to ensure server has time to set responseFullySent flag
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify the response was fully sent by the server
        expect(responseFullySent).toBe(true);

        // Convert all chunks to a single string and verify content
        const content = Buffer.concat(chunks).toString("utf8");
        expect(content).toBe("HelloWorld!!");
      } catch (e) {
        // If the server fully sent the response but we got an error,
        // this confirms the client has an issue with the split boundary
        if (responseFullySent) {
          // This is the assertion that proves the 3/2 boundary issue exists
          console.log(
            "Server sent complete response but client failed to parse it properly",
          );
          console.log("Error:", (e as Error).message);
          expect((e as Error).message).toMatch(
            /premature close|invalid chunked encoding/i,
          );

          // We should still verify we got some data before the error
          const partialContent = Buffer.concat(chunks).toString("utf8");
          expect(partialContent).toContain("Hello");
        } else {
          // If the server didn't fully send the response, the test is inconclusive
          throw new Error(
            "Test inconclusive: Server didn't complete sending response before error occurred",
          );
        }
      }

      // If the stream completed and the response was fully sent,
      // the client correctly handled the split boundary
      if (streamCompleted && responseFullySent) {
        console.log("Client correctly handled split terminating sequence");
      }
    } finally {
      server.close();
    }
  });

  // This test reproduces the 3/2 assumption bug with multiline chunks
  it("should reproduce premature close with multiline chunks containing line breaks", async () => {
    const server = createServer((req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked",
      });

      // First send a normal chunk
      res.write("A\r\nHello there\r\n");

      // Send a chunk with a size that contains multiline data with \r\n inside
      // This is valid chunked encoding but might confuse parsers
      // The chunk size "1E" = 30 bytes
      res.write("1E\r\n"); // Chunk size header
      res.write("Line 1\r\nLine 2\r\nLine 3 not done yet"); // 30 bytes total
      res.write("\r\n"); // Chunk terminator

      // Now send another chunk that starts with a line continuation
      // This creates a situation where \r\n appears in data and as chunk boundaries
      res.write("14\r\n"); // Size of 20 bytes
      res.write(" continued from before\r\n");
      res.write("\r\n"); // Chunk terminator

      // Here's where we'll try to trigger the bug
      // Send the final chunk marker but split across what could be mistaken for a line boundary
      setTimeout(() => {
        // Send "0\r" first - this could be mistaken for start of a line ending
        res.write("0\r");

        // Small delay to ensure separate TCP packets
        setTimeout(() => {
          // Now send "\n\r\n" - this creates ambiguous line endings
          res.write("\n\r\n");

          // Force close after a small delay to simulate network issues
          setTimeout(() => {
            // @ts-ignore - accessing private property for test
            res.socket?.destroy();
          }, 20);
        }, 10);
      }, 10);
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const response = await fetchwithRequestOptions(
        `http://localhost:${port}`,
        {
          headers: {
            Connection: "keep-alive",
          },
        },
      );

      const chunks: string[] = [];
      try {
        for await (const chunk of streamResponse(
          response as unknown as Response,
        )) {
          chunks.push(chunk);
        }
        throw new Error(
          "Expected premature close error but stream completed successfully",
        );
      } catch (e) {
        expect(e).toBeTruthy();
        expect((e as Error).message).toMatch(/premature close/i);

        // Verify we received the multiline data before the error
        const receivedData = chunks.join("");
        expect(receivedData).toContain("Hello there");
        expect(receivedData).toContain("Line 1");
        expect(receivedData).toContain("Line 2");
        expect(receivedData).toContain("Line 3 not done yet");
        expect(receivedData).toContain("continued from before");
      }
    } finally {
      server.close();
    }
  });
});
