import { MCPOptions } from "../..";
import MCPConnection from "./MCPConnection";
import { MCPManagerSingleton } from "./MCPManagerSingleton";

// Create test versions with stubbed behavior
class TestMCPConnection extends MCPConnection {
  constructor(options: MCPOptions) {
    super(options);

    // Override with test implementations
    this.client = {
      close: async () => {},
      connect: async () => {},
      getServerCapabilities: () => ({}),
      listResources: async () => ({ resources: [] }),
      listTools: async () => ({ tools: [] }),
      listPrompts: async () => ({ prompts: [] }),
    } as any;

    this.abortController = new AbortController();
    this.connectClient = jest.fn().mockResolvedValue(undefined);
    this.getStatus = jest
      .fn()
      .mockReturnValue({ status: "connected", errors: [] });
  }
}

describe("MCPManagerSingleton", () => {
  let manager: MCPManagerSingleton;
  const testOptions: MCPOptions = {
    name: "test-mcp",
    id: "test-id",
    transport: {
      type: "stdio",
      command: "test-command",
      args: [],
    },
  };

  beforeEach(() => {
    // Reset singleton
    (MCPManagerSingleton as any).instance = undefined;
    manager = MCPManagerSingleton.getInstance();

    // Replace the connections map with our own that will use TestMCPConnection
    const connectionsMap = new Map<string, MCPConnection>();
    Object.defineProperty(manager, "connections", {
      value: connectionsMap,
      writable: true,
    });

    // Override createConnection to use our TestMCPConnection
    manager.createConnection = function (
      id: string,
      options: MCPOptions,
    ): MCPConnection {
      if (!this.connections.has(id)) {
        const connection = new TestMCPConnection(options);
        this.connections.set(id, connection);
        return connection;
      } else {
        return this.connections.get(id)!;
      }
    };
  });

  describe("getInstance", () => {
    it("should create singleton instance", () => {
      const instance1 = MCPManagerSingleton.getInstance();
      const instance2 = MCPManagerSingleton.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("createConnection", () => {
    it("should create new connection if none exists", () => {
      const connection = manager.createConnection("test-id", testOptions);
      expect(connection).toBeInstanceOf(MCPConnection);
    });

    it("should return existing connection if exists", () => {
      const connection1 = manager.createConnection("test-id", testOptions);
      const connection2 = manager.createConnection("test-id", testOptions);
      expect(connection1).toBe(connection2);
    });
  });

  describe("getConnection", () => {
    it("should return undefined for non-existent connection", () => {
      expect(manager.getConnection("non-existent")).toBeUndefined();
    });

    it("should return existing connection", () => {
      const connection = manager.createConnection("test-id", testOptions);
      expect(manager.getConnection("test-id")).toBe(connection);
    });
  });

  describe("removeConnection", () => {
    it("should remove connection and close client", async () => {
      // Create a spy on the close method
      const connection = manager.createConnection(
        "test-id",
        testOptions,
      ) as TestMCPConnection;
      const closeSpy = jest.spyOn(connection.client, "close");

      await manager.removeConnection("test-id");

      expect(closeSpy).toHaveBeenCalled();
      expect(manager.getConnection("test-id")).toBeUndefined();
    });

    it("should handle non-existent connection", async () => {
      await expect(
        manager.removeConnection("non-existent"),
      ).resolves.toBeUndefined();
    });
  });

  describe("setConnections", () => {
    it("should add new connections", () => {
      const servers = [testOptions];
      manager.setConnections(servers, false);
      expect(manager.getConnection(testOptions.id)).toBeInstanceOf(
        MCPConnection,
      );
    });

    it("should remove old connections", () => {
      // Create initial connection
      const connection = manager.createConnection(
        "test-id",
        testOptions,
      ) as TestMCPConnection;
      const abortSpy = jest.spyOn(connection.abortController, "abort");
      const closeSpy = jest.spyOn(connection.client, "close");

      // Remove it by setting empty server list
      manager.setConnections([], false);

      expect(abortSpy).toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalled();
      expect(manager.getConnection("test-id")).toBeUndefined();
    });
  });

  describe("refreshConnection", () => {
    it("should refresh specific connection", async () => {
      const connection = manager.createConnection(
        "test-id",
        testOptions,
      ) as TestMCPConnection;

      await manager.refreshConnection("test-id");

      expect(connection.connectClient).toHaveBeenCalledWith(
        true,
        expect.any(AbortSignal),
      );
    });

    it("should throw error for non-existent connection", async () => {
      await expect(manager.refreshConnection("non-existent")).rejects.toThrow(
        "MCP Connection non-existent not found",
      );
    });
  });

  describe("refreshConnections", () => {
    it("should refresh all connections", async () => {
      const connection1 = manager.createConnection("test-id-1", {
        ...testOptions,
        id: "test-id-1",
      }) as TestMCPConnection;

      const connection2 = manager.createConnection("test-id-2", {
        ...testOptions,
        id: "test-id-2",
      }) as TestMCPConnection;

      await manager.refreshConnections(true);

      expect(connection1.connectClient).toHaveBeenCalledWith(
        true,
        expect.any(AbortSignal),
      );
      expect(connection2.connectClient).toHaveBeenCalledWith(
        true,
        expect.any(AbortSignal),
      );
    });

    it("should call onConnectionsRefreshed if defined", async () => {
      const mockCallback = jest.fn();
      manager.onConnectionsRefreshed = mockCallback;
      manager.createConnection("test-id", testOptions);

      await manager.refreshConnections(true);

      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe("getStatuses", () => {
    it("should return statuses for all connections", () => {
      const connection = manager.createConnection(
        "test-id",
        testOptions,
      ) as TestMCPConnection;
      const mockStatus = { status: "connected", errors: [] };
      connection.getStatus = jest.fn().mockReturnValue(mockStatus);

      const statuses = manager.getStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0]).toEqual({ ...mockStatus, client: connection.client });
    });
  });
});
