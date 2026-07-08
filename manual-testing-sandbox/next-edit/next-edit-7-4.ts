// A messy and tightly coupled event processing system with poor separation of concerns
// Difficulty: 4

type EventType = "click" | "hover" | "scroll" | "keypress" | "resize" | "load";
type EventCallback = (data: any) => void;

// Global state - everything is mixed together
const globalState = {
  count: 0,
  lastEvent: null as any,
  isActive: false,
  username: "",
  token: "",
  preferences: { theme: "light", fontSize: 12, notifications: true },
  eventHistory: [] as string[],
  userData: null as any,
};

// God class that handles everything
class EventManager {
  private events: Map<EventType, EventCallback[]> = new Map();
  private static instance: EventManager;
  private isProcessing = false;
  private processingQueue: Array<{ type: EventType; data: any }> = [];

  private constructor() {
    // Initialize default handlers
    this.events.set("click", []);
    this.events.set("hover", []);
    this.events.set("scroll", []);
    this.events.set("keypress", []);
    this.events.set("resize", []);
    this.events.set("load", []);

    // Add default behavior
    this.on("click", (data) => {
      console.log("Default click handler:", data);
      globalState.count++;
      globalState.lastEvent = { type: "click", data, timestamp: Date.now() };
      globalState.eventHistory.push(`click:${JSON.stringify(data)}`);

      // Side effects directly in handler
      this.updateUI();

      // Mixes concerns by also handling auth
      if (data.target && data.target.id === "login-button") {
        this.login(globalState.username, "hardcoded-password");
      }
    });
  }

  // Singleton pattern
  public static getInstance(): EventManager {
    if (!EventManager.instance) {
      EventManager.instance = new EventManager();
    }
    return EventManager.instance;
  }

  public on(eventType: EventType, callback: EventCallback): void {
    const handlers = this.events.get(eventType) || [];
    handlers.push(callback);
    this.events.set(eventType, handlers);
  }

  public emit(eventType: EventType, data: any): void {
    globalState.lastEvent = { type: eventType, data, timestamp: Date.now() };

    if (this.isProcessing) {
      this.processingQueue.push({ type: eventType, data });
      return;
    }

    this.isProcessing = true;

    try {
      const handlers = this.events.get(eventType) || [];
      for (const handler of handlers) {
        handler(data);

        // Random state modifications scattered throughout code
        globalState.eventHistory.push(`${eventType}:${JSON.stringify(data)}`);
      }

      // UI Update with every event
      this.updateUI();

      // Process queue
      while (this.processingQueue.length > 0) {
        const next = this.processingQueue.shift()!;
        const queueHandlers = this.events.get(next.type) || [];
        for (const handler of queueHandlers) {
          handler(next.data);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Mixed UI concerns with event handling
  private updateUI(): void {
    // Directly manipulates DOM
    const countElement = document.getElementById("count");
    if (countElement) {
      countElement.textContent = String(globalState.count);
    }

    // Apply theme
    document.body.className = globalState.preferences.theme;

    // Update last event display
    const lastEventElement = document.getElementById("lastEvent");
    if (lastEventElement && globalState.lastEvent) {
      lastEventElement.textContent = JSON.stringify(globalState.lastEvent);
    }
  }

  // Authentication logic mixed with event handling
  private login(username: string, password: string): void {
    console.log(`Attempting login for ${username}...`);

    // Simulate API call
    setTimeout(() => {
      globalState.isActive = true;
      globalState.token = `token-${Math.random().toString(36).substring(7)}`;
      globalState.userData = {
        name: username,
        role: "user",
        loginTime: new Date(),
      };

      // Update UI after login
      this.updateUI();

      // Emit another event
      this.emit("load", { user: username });
    }, 1000);
  }

  // Analytics mixed in
  public trackEvent(category: string, action: string, label?: string): void {
    const eventData = { category, action, label, timestamp: Date.now() };
    console.log("Tracking event:", eventData);

    // Update global state
    globalState.eventHistory.push(`analytics:${JSON.stringify(eventData)}`);

    // Send to analytics service
    if (globalState.isActive) {
      this.sendToAnalyticsService(eventData);
    }
  }

  private sendToAnalyticsService(data: any): void {
    // Pretend API call
    console.log("Sending to analytics service:", data);
  }

  // Utility functions mixed in
  public formatEventHistory(): string {
    return globalState.eventHistory
      .map((event, index) => `${index + 1}. ${event}`)
      .join("\n");
  }

  // Settings management mixed in
  public updatePreference(
    key: "theme" | "fontSize" | "notifications",
    value: any,
  ): void {
    globalState.preferences[key] = value;
    this.updateUI();
    this.trackEvent("preferences", "update", `${key}:${value}`);
  }
}

// Export singleton
export const eventManager = EventManager.getInstance();

// Helper functions that directly use global state
export function getCurrentCount(): number {
  return globalState.count;
}

export function resetCount(): void {
  globalState.count = 0;
  eventManager.emit("click", { action: "reset" });
}

export function setUsername(name: string): void {
  globalState.username = name;
}

// Example usage
document.addEventListener("DOMContentLoaded", () => {
  eventManager.emit("load", { page: "home" });

  // Add event listeners
  document.addEventListener("click", (e) => {
    eventManager.emit("click", {
      target: e.target,
      x: e.clientX,
      y: e.clientY,
    });
  });

  document.addEventListener("keypress", (e) => {
    eventManager.emit("keypress", { key: e.key, code: e.code });
  });
});
