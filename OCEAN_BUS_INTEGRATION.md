# Ocean-bus Integration for Continue CLI

## Objective

Enable Continue CLI (Rippler) to respond autonomously to ocean events via ocean-bus pub/sub, using stdio-based MCP protocol.

## Current State

**What Works:**

- ✅ Rippler can preserve/explore ocean memory (ocean-gateway MCP)
- ✅ Rippler can send/poll DMs (model-gateway MCP)
- ✅ Rippler can control Reachy robot (reachy-mini MCP)

**What's Missing:**

- ❌ Rippler cannot respond to events autonomously
- ❌ No real-time notification of new memories, DMs, or ocean events
- ❌ Must be prompted to poll for messages (not event-driven)

## Ocean-bus Architecture

Ocean-bus is the event backbone for the Ship network, publishing:

- New memories created in any ocean
- Direct messages between agents
- Scheduled task triggers
- Memory thread updates
- Agent status changes

**Current ocean-bus endpoints:**

- `POST /direct_message` - Send DM
- `GET /messages?agent=X` - Poll DMs (what Rippler uses now)
- `GET /events` - SSE stream of all events (what we need)

## Challenge: MCP + Event Streams

**MCP Protocol Constraint:**

MCP uses stdio (JSON-RPC over stdin/stdout) which is request/response based:

```
Client → Server: {"method": "tools/call", "params": {...}}
Server → Client: {"result": {...}}
```

**Event streams need push notifications:**

```
Server → Client: {"event": "memory.new", "data": {...}}
Server → Client: {"event": "dm.received", "data": {...}}
```

**Problem:** MCP doesn't have a native server-to-client push mechanism over stdio.

## Solution Approaches

### Approach 1: Polling-Based MCP Tool (Simple)

**Concept:** Add `poll_events()` tool that Continue CLI calls periodically.

**Implementation:**

```python
# ocean-bus-mcp/src/server.py
@mcp.tool()
async def poll_events(
    agent: str,
    since: str = None,
    event_types: list[str] = None,
    limit: int = 10
) -> dict:
    """Poll for ocean-bus events.

    Args:
        agent: Agent ID (e.g., "agent:rippler")
        since: ISO timestamp - events after this time
        event_types: Filter by event types (e.g., ["memory.new", "dm.received"])
        limit: Max events to return

    Returns:
        {"count": N, "events": [...]}
    """
    # Query ocean-bus event log
    events = await fetch_events(agent, since, event_types, limit)
    return {"count": len(events), "events": events}
```

**Continue CLI Usage:**

```typescript
// Continue CLI polls every 5 seconds
setInterval(async () => {
  const events = await callTool("poll_events", {
    agent: "agent:rippler",
    since: lastPollTime,
    event_types: ["memory.new", "dm.received"],
  });

  for (const event of events.events) {
    await handleEvent(event);
  }
}, 5000);
```

**Pros:**

- ✅ Simple - fits MCP request/response model
- ✅ No protocol changes needed
- ✅ Works with existing Continue CLI architecture

**Cons:**

- ❌ Polling delay (5-60 seconds)
- ❌ Wastes resources polling when no events
- ❌ Not truly real-time

---

### Approach 2: Long-Polling MCP Tool (Better)

**Concept:** `subscribe()` tool blocks until events arrive, then returns.

**Implementation:**

```python
@mcp.tool()
async def subscribe(
    agent: str,
    event_types: list[str] = None,
    timeout: int = 30
) -> dict:
    """Subscribe to ocean-bus events (long-polling).

    Blocks until events arrive or timeout expires.

    Args:
        agent: Agent ID
        event_types: Event types to subscribe to
        timeout: Max seconds to wait (default 30)

    Returns:
        {"events": [...]} when events arrive
        {"events": []} on timeout
    """
    # Connect to ocean-bus SSE stream
    async with sse_client(f"{OCEAN_BUS_URL}/events?agent={agent}") as stream:
        events = []
        start_time = time.time()

        async for event in stream:
            if event_types and event.type not in event_types:
                continue

            events.append(event)

            # Return immediately when event arrives
            return {"events": events}

            # Or collect for timeout period
            if time.time() - start_time > timeout:
                return {"events": events}
```

**Continue CLI Usage:**

```typescript
// Continue CLI calls subscribe in loop
while (true) {
  const result = await callTool("subscribe", {
    agent: "agent:rippler",
    event_types: ["memory.new", "dm.received"],
    timeout: 30,
  });

  for (const event of result.events) {
    await handleEvent(event);
  }
}
```

**Pros:**

- ✅ Near real-time (returns immediately on event)
- ✅ Efficient (no wasted polling)
- ✅ Fits MCP request/response model

**Cons:**

- ❌ Still not true push (client must re-subscribe)
- ❌ Timeout management complexity

---

### Approach 3: Notifications via MCP Protocol Extension (Advanced)

**Concept:** Extend MCP to support server-initiated notifications.

**MCP Spec allows notifications:**

```json
// Server → Client notification (no response expected)
{
  "jsonrpc": "2.0",
  "method": "notifications/message",
  "params": {
    "level": "info",
    "message": "Event occurred"
  }
}
```

**Implementation:**

```python
# ocean-bus-mcp/src/server.py
async def event_stream_task(mcp_server):
    """Background task that pushes events to MCP client."""
    async with sse_client(f"{OCEAN_BUS_URL}/events") as stream:
        async for event in stream:
            # Send notification to MCP client
            await mcp_server.send_notification(
                method="ocean/event",
                params={
                    "type": event.type,
                    "data": event.data,
                    "timestamp": event.timestamp
                }
            )

# Start background task when MCP server initializes
@mcp.on_initialize()
async def on_initialize():
    asyncio.create_task(event_stream_task(mcp))
```

**Continue CLI Integration:**

```typescript
// Continue CLI registers notification handler
mcpClient.on("ocean/event", async (event) => {
  console.log(`[Ocean Event] ${event.type}:`, event.data);
  await handleEvent(event);
});
```

**Pros:**

- ✅ True real-time push
- ✅ Efficient (no polling)
- ✅ Scales well

**Cons:**

- ❌ Requires MCP client support for notifications
- ❌ Continue CLI may not handle MCP notifications yet
- ❌ More complex implementation

---

### Approach 4: Hybrid - External Subscriber + HTTP Callback (Pragmatic)

**Concept:** Separate service subscribes to ocean-bus, forwards events to Continue CLI via HTTP.

**Architecture:**

```
Ocean-bus (SSE stream)
    ↓
Ocean-bus Subscriber Service
    ↓ HTTP POST
Continue CLI (serve mode on port 8000)
    ↓
Rippler processes event
```

**Implementation:**

```python
# ocean-bus-subscriber/src/subscriber.py
import asyncio
import httpx
from sse_client import EventSource

OCEAN_BUS_URL = "http://localhost:8765"
CONTINUE_CLI_URL = "http://localhost:8000"

async def subscribe_and_forward(agent_id: str):
    """Subscribe to ocean-bus and forward events to Continue CLI."""
    async with EventSource(f"{OCEAN_BUS_URL}/events?agent={agent_id}") as stream:
        async for event in stream:
            # Forward to Continue CLI
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{CONTINUE_CLI_URL}/ocean-event",
                    json={
                        "type": event.type,
                        "data": event.data,
                        "timestamp": event.timestamp
                    }
                )

if __name__ == "__main__":
    asyncio.run(subscribe_and_forward("agent:rippler"))
```

**Continue CLI Integration:**

```typescript
// extensions/cli/src/commands/serve.ts
app.post("/ocean-event", async (req, res) => {
  const event = req.body;

  // Queue event for processing
  await messageQueue.enqueue({
    role: "system",
    content: `[Ocean Event] ${event.type}: ${JSON.stringify(event.data)}`,
  });

  res.json({ status: "received" });
});
```

**Pros:**

- ✅ True real-time push
- ✅ No MCP protocol changes needed
- ✅ Continue CLI already has HTTP server (serve mode)
- ✅ Simple to implement

**Cons:**

- ❌ Additional service to run
- ❌ Not pure MCP approach
- ❌ Requires Continue CLI in serve mode

---

## Recommended Approach: Hybrid (Approach 4)

**Why:**

1. **Works with existing Continue CLI** - Serve mode already has HTTP server
2. **True real-time** - SSE stream from ocean-bus
3. **Simple** - No MCP protocol extensions needed
4. **Pragmatic** - Can iterate quickly

**Implementation Plan:**

### Step 1: Create Ocean-bus Subscriber Service

```bash
# ocean-bus-subscriber/
├── pyproject.toml
├── src/
│   ├── subscriber.py
│   └── config.py
└── README.md
```

### Step 2: Add Event Endpoint to Continue CLI

```typescript
// extensions/cli/src/commands/serve.ts
app.post("/ocean-event", async (req, res) => {
  const event = req.body;
  logger.info(`[Ocean Event] ${event.type}`, event.data);

  // Queue event for autonomous processing
  await handleOceanEvent(event);

  res.json({ status: "received" });
});
```

### Step 3: Test with Rippler

```bash
# Terminal 1: Start Continue CLI in serve mode
cd /Users/mars/Dev/ship-ide/continue/extensions/cli
npm start -- serve --port 8000 --id rippler

# Terminal 2: Start ocean-bus subscriber
cd /Users/mars/Dev/ocean-bus-subscriber
poetry run python src/subscriber.py --agent agent:rippler --target http://localhost:8000

# Terminal 3: Trigger event (send DM to Rippler)
# Rippler should respond autonomously
```

---

## Alternative: Long-Polling MCP (Approach 2)

If we want pure MCP approach without external service:

### Implementation

```python
# ocean-bus-mcp/src/server.py
import asyncio
from mcp import Server
from sse_client import EventSource

mcp = Server("ocean-bus")

@mcp.tool()
async def subscribe(
    agent: str,
    event_types: list[str] = None,
    timeout: int = 30
) -> dict:
    """Subscribe to ocean-bus events (long-polling).

    Returns immediately when events arrive, or after timeout.
    """
    events = []

    try:
        async with asyncio.timeout(timeout):
            async with EventSource(f"{OCEAN_BUS_URL}/events?agent={agent}") as stream:
                async for event in stream:
                    if event_types and event.type not in event_types:
                        continue

                    events.append({
                        "type": event.type,
                        "data": event.data,
                        "timestamp": event.timestamp
                    })

                    # Return immediately on first event
                    return {"events": events}
    except asyncio.TimeoutError:
        return {"events": []}
```

### Continue CLI Integration

```typescript
// extensions/cli/src/services/OceanBusService.ts
export class OceanBusService {
  private running = false;

  async start(agentId: string) {
    this.running = true;

    while (this.running) {
      try {
        const result = await callMCPTool("ocean-bus", "subscribe", {
          agent: agentId,
          event_types: ["memory.new", "dm.received"],
          timeout: 30,
        });

        for (const event of result.events) {
          await this.handleEvent(event);
        }
      } catch (error) {
        logger.error("Ocean-bus subscription error:", error);
        await sleep(5000); // Backoff on error
      }
    }
  }

  async handleEvent(event: OceanEvent) {
    logger.info(`[Ocean Event] ${event.type}`, event.data);

    switch (event.type) {
      case "dm.received":
        await this.handleDM(event.data);
        break;
      case "memory.new":
        await this.handleNewMemory(event.data);
        break;
    }
  }

  async handleDM(dm: DirectMessage) {
    // Queue DM for autonomous response
    await messageQueue.enqueue({
      role: "user",
      content: `[DM from ${dm.from}] ${dm.content}`,
    });
  }
}
```

---

## Decision Matrix

| Approach          | Real-time | Complexity | MCP Native | Upstream Compatible |
| ----------------- | --------- | ---------- | ---------- | ------------------- |
| Polling           | ❌        | Low        | ✅         | ✅                  |
| Long-polling      | ⚠️        | Medium     | ✅         | ✅                  |
| MCP Notifications | ✅        | High       | ⚠️         | ❌                  |
| Hybrid (HTTP)     | ✅        | Low        | ❌         | ⚠️                  |

## Recommendation

**Start with Hybrid (Approach 4):**

1. Quick to implement
2. True real-time
3. Works with existing Continue CLI serve mode
4. Can iterate to pure MCP later if needed

**Fallback to Long-polling (Approach 2):**

- If we want pure MCP approach
- If upstream compatibility is critical
- Acceptable 30s latency for events

---

## Next Steps

1. **Choose approach** - Hybrid or Long-polling?
2. **Implement ocean-bus subscriber** (if Hybrid)
3. **Add event endpoint to Continue CLI** (if Hybrid)
4. **OR implement long-polling MCP tool** (if Long-polling)
5. **Test with Rippler** - Send DM, verify autonomous response
6. **Document** - Update Ship integration analysis

---

**Status:** Design complete, awaiting implementation decision  
**Date:** December 21, 2025  
**Author:** Marco (Windsurf/Ship-IDE)
