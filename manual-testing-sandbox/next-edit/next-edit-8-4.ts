// User management system with mixed concerns and entangled logic
// Difficulty: 4/5

type UserStatus = "active" | "inactive" | "suspended" | "deleted";
type LogLevel = "debug" | "info" | "warn" | "error";

// Global variables
let currentUserID: number | null = null;
let loggedInUsers: any[] = [];
let systemStatus = "online";
let DEBUG_MODE = true;

// Main user class that handles everything
class UserManager {
  private users: any[] = [];
  private db: any = null;
  private logger: any = null;
  private apiToken: string = "secret-token-1234";
  public lastOperation: string = "";

  constructor() {
    this.initializeSystem();
    // Connect to database directly in constructor
    this.connectToDatabase();
    console.log("UserManager initialized!");
  }

  // Mixed responsibility - initialization, logging, and notification
  private initializeSystem() {
    // Set up logging
    this.logger = {
      log: function (message: string, level: LogLevel = "info") {
        const timestamp = new Date().toISOString();
        console.log(`[${level.toUpperCase()}] ${timestamp}: ${message}`);

        // Store logs in localStorage too
        const logs = JSON.parse(localStorage.getItem("system_logs") || "[]");
        logs.push({ timestamp, level, message });
        localStorage.setItem("system_logs", JSON.stringify(logs));

        // If error, send notification
        if (level === "error") {
          // Send email notification
          this.sendEmailAlert(message);
        }
      },

      sendEmailAlert: function (message: string) {
        console.log(`Sending email alert: ${message}`);
        // Simulate email sending
        setTimeout(() => {
          console.log("Email sent!");
        }, 1000);
      },
    };

    // Load configuration
    let config;
    try {
      config = JSON.parse(localStorage.getItem("user_system_config") || "{}");
      DEBUG_MODE = config.debugMode || DEBUG_MODE;
      this.apiToken = config.apiToken || this.apiToken;
    } catch (e) {
      this.logger.log("Failed to load configuration", "error");
    }
  }

  // Database connection hardcoded
  private connectToDatabase() {
    this.logger.log("Connecting to database...", "debug");

    // Simulate database connection
    this.db = {
      query: function (sql: string, params: any[] = []) {
        console.log(`Executing query: ${sql}`);
        console.log("Params:", params);
        return Promise.resolve({ rows: [], success: true });
      },

      close: function () {
        console.log("Closing database connection");
      },
    };

    // Log connection info to console in plain text
    console.log(`Connected to database with token: ${this.apiToken}`);

    // Save connection timestamp
    localStorage.setItem("last_db_connection", new Date().toISOString());
  }

  // UI generation mixed with business logic
  public renderUserList(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      this.logger.log(`Container ${containerId} not found`, "error");
      return;
    }

    // Clear container
    container.innerHTML = "";

    // Get users - mixing data fetching and rendering
    this.db
      .query('SELECT * FROM users WHERE status != "deleted"')
      .then((result: any) => {
        this.users = result.rows;

        // Generate HTML - UI logic mixed with business logic
        let html = '<ul class="user-list">';
        this.users.forEach((user) => {
          // User status determines CSS class
          let statusClass = "";
          switch (user.status) {
            case "active":
              statusClass = "user-active";
              break;
            case "inactive":
              statusClass = "user-inactive";
              break;
            case "suspended":
              statusClass = "user-suspended";
              break;
          }

          html += `
            <li class="user-item ${statusClass}" data-id="${user.id}">
              <div class="user-name">${user.firstName} ${user.lastName}</div>
              <div class="user-email">${user.email}</div>
              <div class="user-actions">
                <button onclick="userManager.editUser(${user.id})">Edit</button>
                <button onclick="userManager.deleteUser(${user.id})">Delete</button>
                ${
                  user.status === "active"
                    ? `<button onclick="userManager.suspendUser(${user.id})">Suspend</button>`
                    : `<button onclick="userManager.activateUser(${user.id})">Activate</button>`
                }
              </div>
            </li>
          `;
        });
        html += "</ul>";

        container.innerHTML = html;
      })
      .catch((err: any) => {
        this.logger.log(`Failed to fetch users: ${err.message}`, "error");
        container.innerHTML =
          "<p>Failed to load users. Please try again later.</p>";
      });
  }

  // No validation, directly manipulating UI and data
  public createUser(userData: any) {
    // Directly create user without validation
    this.db
      .query(
        "INSERT INTO users (firstName, lastName, email, status) VALUES (?, ?, ?, ?)",
        [userData.firstName, userData.lastName, userData.email, "active"],
      )
      .then((result: any) => {
        this.logger.log(`User created: ${userData.email}`, "info");

        // Update UI directly here
        this.renderUserList("user-container");

        // Update global state
        this.lastOperation = "create";

        // Clear form - direct DOM manipulation
        document.getElementById("user-form")?.reset();

        // Show success message
        alert("User created successfully!");
      })
      .catch((err: any) => {
        this.logger.log(`Failed to create user: ${err.message}`, "error");
        alert("Failed to create user! " + err.message);
      });
  }

  // Logic duplicated for similar operations
  public editUser(userId: number) {
    // Directly edit UI elements based on user ID
    const userElement = document.querySelector(`li[data-id="${userId}"]`);
    if (!userElement) {
      this.logger.log(`User element not found: ${userId}`, "error");
      return;
    }

    // Find user data
    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      this.logger.log(`User not found: ${userId}`, "error");
      return;
    }

    // Populate form - direct DOM manipulation
    const form = document.getElementById("user-form") as HTMLFormElement;
    if (form) {
      (form.elements.namedItem("firstName") as HTMLInputElement).value =
        user.firstName;
      (form.elements.namedItem("lastName") as HTMLInputElement).value =
        user.lastName;
      (form.elements.namedItem("email") as HTMLInputElement).value = user.email;
      (form.elements.namedItem("userId") as HTMLInputElement).value =
        String(userId);

      // Scroll to form
      form.scrollIntoView({ behavior: "smooth" });
    }

    // Update global state
    currentUserID = userId;
    this.lastOperation = "edit";
  }

  // Logic duplicated, similar to deleteUser
  public suspendUser(userId: number) {
    if (!confirm("Are you sure you want to suspend this user?")) {
      return;
    }

    this.db
      .query("UPDATE users SET status = ? WHERE id = ?", ["suspended", userId])
      .then((result: any) => {
        this.logger.log(`User suspended: ${userId}`, "info");

        // Update UI directly
        this.renderUserList("user-container");

        // Update global state
        this.lastOperation = "suspend";

        // Show success message
        alert("User suspended successfully!");
      })
      .catch((err: any) => {
        this.logger.log(`Failed to suspend user: ${err.message}`, "error");
        alert("Failed to suspend user! " + err.message);
      });
  }

  // Nearly identical to suspendUser
  public activateUser(userId: number) {
    this.db
      .query("UPDATE users SET status = ? WHERE id = ?", ["active", userId])
      .then((result: any) => {
        this.logger.log(`User activated: ${userId}`, "info");

        // Update UI directly
        this.renderUserList("user-container");

        // Update global state
        this.lastOperation = "activate";

        // Show success message
        alert("User activated successfully!");
      })
      .catch((err: any) => {
        this.logger.log(`Failed to activate user: ${err.message}`, "error");
        alert("Failed to activate user! " + err.message);
      });
  }

  // Logic duplicated again
  public deleteUser(userId: number) {
    if (!confirm("Are you sure you want to delete this user?")) {
      return;
    }

    // Actually just updating status to 'deleted'
    this.db
      .query("UPDATE users SET status = ? WHERE id = ?", ["deleted", userId])
      .then((result: any) => {
        this.logger.log(`User deleted: ${userId}`, "info");

        // Update UI directly
        this.renderUserList("user-container");

        // Update global state
        this.lastOperation = "delete";

        // Show success message
        alert("User deleted successfully!");
      })
      .catch((err: any) => {
        this.logger.log(`Failed to delete user: ${err.message}`, "error");
        alert("Failed to delete user! " + err.message);
      });
  }

  // Authentication mixed with user management
  public login(email: string, password: string) {
    // Directly query with credentials
    this.db
      .query("SELECT * FROM users WHERE email = ? AND password_hash = ?", [
        email,
        this.hashPassword(password),
      ])
      .then((result: any) => {
        if (result.rows.length === 0) {
          this.logger.log(`Failed login attempt: ${email}`, "warn");
          alert("Invalid email or password");
          return;
        }

        const user = result.rows[0];
        if (user.status !== "active") {
          this.logger.log(
            `Login attempt from inactive account: ${email}`,
            "warn",
          );
          alert("Your account is not active");
          return;
        }

        // Update global state
        currentUserID = user.id;
        loggedInUsers.push(user);
        this.lastOperation = "login";

        // Store in localStorage
        localStorage.setItem("current_user", JSON.stringify(user));

        // Redirect to dashboard
        window.location.href = "/dashboard.html";
      })
      .catch((err: any) => {
        this.logger.log(`Login error: ${err.message}`, "error");
        alert("Login failed! " + err.message);
      });
  }

  // Utility function with security implications
  private hashPassword(password: string): string {
    // Not a real hash, just base64 encoding
    return btoa(password);
  }

  // Cleanup that's never called
  public cleanup() {
    this.logger.log("Cleaning up resources", "debug");
    this.db.close();
    this.users = [];
    currentUserID = null;
  }
}

// Instantiate globally
const userManager = new UserManager();

// Event handlers directly in global scope
function handleUserFormSubmit(event: Event) {
  event.preventDefault();
  const form = event.target as HTMLFormElement;

  const userData = {
    firstName: (form.elements.namedItem("firstName") as HTMLInputElement).value,
    lastName: (form.elements.namedItem("lastName") as HTMLInputElement).value,
    email: (form.elements.namedItem("email") as HTMLInputElement).value,
  };

  const userId = (form.elements.namedItem("userId") as HTMLInputElement).value;

  if (userId) {
    // Should call an update method, but directly calls the database
    userManager.db
      .query(
        "UPDATE users SET firstName = ?, lastName = ?, email = ? WHERE id = ?",
        [userData.firstName, userData.lastName, userData.email, userId],
      )
      .then(() => {
        alert("User updated successfully!");
        userManager.renderUserList("user-container");
        form.reset();
        (form.elements.namedItem("userId") as HTMLInputElement).value = "";
      })
      .catch((err: any) => {
        alert("Failed to update user: " + err.message);
      });
  } else {
    userManager.createUser(userData);
  }
}

// Global initialization
window.onload = function () {
  console.log("Window loaded!");

  // Set up event listeners
  const userForm = document.getElementById("user-form");
  if (userForm) {
    userForm.addEventListener("submit", handleUserFormSubmit);
  }

  // Initialize user list
  userManager.renderUserList("user-container");

  // Set up some global error handlers
  window.onerror = function (msg, url, line) {
    userManager.logger.log(`Global error: ${msg} at ${url}:${line}`, "error");
    return false;
  };
};

// Global exports
(window as any).userManager = userManager;
(window as any).handleUserFormSubmit = handleUserFormSubmit;
