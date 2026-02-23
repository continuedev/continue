// A messy project management application with tangled dependencies and responsibilities
// Difficulty: 5/5

// Global state
let globalTasks: any[] = [];
let globalUsers: any[] = [];
let globalProjects: any[] = [];
let currentUser: any = null;
let lastActivityTime = Date.now();
let _config = {
  maxTasksPerUser: 20,
  maxProjectsPerUser: 5,
  defaultPriority: "medium",
  enableNotifications: true,
  serverUrl: "https://api.example.com/v1",
};

// Mixed utility functions and business logic
const util = {
  generateId: (prefix: string) =>
    `${prefix}_${Math.random().toString(36).substring(2, 15)}${Date.now()}`,
  calculateProgress: (tasks: any[]) => {
    const completed = tasks.filter((t) => t.status === "completed").length;
    return tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  },
  sendNotification: (type: string, message: string, user: any) => {
    if (!_config.enableNotifications) return;
    console.log(`[NOTIFICATION to ${user.email}]: ${message}`);
    // Side effects directly inside utility function
    if (typeof window !== "undefined") {
      // DOM manipulation in utility
      const notification = document.createElement("div");
      notification.className = `notification ${type}`;
      notification.innerText = message;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    }
  },
  logger: (action: string, data: any) => {
    console.log(`[${new Date().toISOString()}] ${action}:`, data);
    // Side effect - updating activity time
    lastActivityTime = Date.now();
  },
};

// Data validation mixed with business logic
function validateTask(task: any) {
  if (!task.title) throw new Error("Task title is required");
  if (!task.projectId) throw new Error("Task must belong to a project");
  if (!globalProjects.some((p) => p.id === task.projectId)) {
    throw new Error("Project does not exist");
  }

  // Validation mixed with business rules
  const userTasks = globalTasks.filter(
    (t) => t.assignedTo === task.assignedTo && t.status !== "completed",
  );

  if (userTasks.length >= _config.maxTasksPerUser) {
    throw new Error(
      `User cannot have more than ${_config.maxTasksPerUser} active tasks`,
    );
  }

  return true;
}

// Authentication mixed with data fetching
function authenticate(username: string, password: string) {
  // Direct data manipulation and mocked authentication
  const user = globalUsers.find((u) => u.username === username);
  if (!user || user.password !== password) {
    util.logger("auth_failed", { username });
    throw new Error("Invalid credentials");
  }

  currentUser = user;
  util.logger("auth_success", { userId: user.id });

  // Mixing data fetching with authentication
  loadUserData(user.id);

  return user;
}

// Data fetching with side effects
function loadUserData(userId: string) {
  // This would be an API call in real app
  console.log(`Loading data for user ${userId}`);

  // Direct global state manipulation
  globalTasks = globalTasks.filter(
    (t) => t.createdBy === userId || t.assignedTo === userId,
  );

  globalProjects = globalProjects.filter(
    (p) => p.members.includes(userId) || p.createdBy === userId,
  );

  // Direct DOM manipulation
  if (typeof document !== "undefined") {
    const taskCount = document.getElementById("task-count");
    if (taskCount) {
      taskCount.innerText = String(globalTasks.length);
    }
  }
}

// Task management with mixed responsibilities
class TaskManager {
  // Creates a task with mixed concerns
  createTask(taskData: any) {
    if (!currentUser) throw new Error("Not authenticated");

    // Authentication check mixed with business logic
    if (taskData.projectId) {
      const project = globalProjects.find((p) => p.id === taskData.projectId);
      if (
        !project.members.includes(currentUser.id) &&
        project.createdBy !== currentUser.id
      ) {
        throw new Error("You do not have access to this project");
      }
    }

    const task = {
      id: util.generateId("task"),
      title: taskData.title,
      description: taskData.description || "",
      status: "new",
      priority: taskData.priority || _config.defaultPriority,
      createdAt: new Date(),
      createdBy: currentUser.id,
      assignedTo: taskData.assignedTo || currentUser.id,
      projectId: taskData.projectId,
      dueDate: taskData.dueDate || null,
      comments: [],
      attachments: [],
      tags: taskData.tags || [],
      timeSpent: 0,
      lastUpdated: new Date(),
    };

    // Validation mixed with creation
    validateTask(task);

    // Global state mutation
    globalTasks.push(task);

    // Side effects - email notification mixed with task creation
    if (task.assignedTo !== currentUser.id) {
      const assignee = globalUsers.find((u) => u.id === task.assignedTo);
      if (assignee) {
        console.log(
          `Sending email to ${assignee.email} about new task assignment`,
        );
        util.sendNotification(
          "task_assigned",
          `You've been assigned a new task: ${task.title}`,
          assignee,
        );
      }
    }

    // More side effects - updating project data
    if (task.projectId) {
      const project = globalProjects.find((p) => p.id === task.projectId);
      if (project) {
        project.taskCount = (project.taskCount || 0) + 1;
        project.lastActivity = new Date();
        // Recalculating project progress on each task addition
        const projectTasks = globalTasks.filter(
          (t) => t.projectId === project.id,
        );
        project.progress = util.calculateProgress(projectTasks);
      }
    }

    // Logging
    util.logger("task_created", { taskId: task.id, title: task.title });

    return task;
  }

  // Update task with mixed concerns
  updateTask(taskId: string, updates: any) {
    if (!currentUser) throw new Error("Not authenticated");

    const taskIndex = globalTasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) throw new Error("Task not found");

    const task = globalTasks[taskIndex];

    // Permission check mixed with update logic
    if (
      task.createdBy !== currentUser.id &&
      task.assignedTo !== currentUser.id &&
      !currentUser.isAdmin
    ) {
      throw new Error("You do not have permission to update this task");
    }

    // Status transition logic mixed with update
    if (updates.status && updates.status !== task.status) {
      if (task.status === "completed" && updates.status !== "completed") {
        // Re-opening completed task
        task.reopenCount = (task.reopenCount || 0) + 1;
        util.logger("task_reopened", { taskId, previousStatus: task.status });
      }

      if (updates.status === "completed") {
        // Completing task
        task.completedAt = new Date();
        task.completedBy = currentUser.id;

        // Side effect - updating user stats
        const user = globalUsers.find((u) => u.id === currentUser.id);
        if (user) {
          user.completedTasks = (user.completedTasks || 0) + 1;
          // More side effects - achievement system
          if (
            user.completedTasks >= 10 &&
            !user.achievements?.includes("productive")
          ) {
            user.achievements = [...(user.achievements || []), "productive"];
            util.sendNotification(
              "achievement",
              "You earned the Productive badge!",
              user,
            );
          }
        }
      }
    }

    // Main update logic - directly modifying the object
    Object.keys(updates).forEach((key) => {
      // Skip protected fields
      if (!["id", "createdAt", "createdBy"].includes(key)) {
        task[key] = updates[key];
      }
    });

    task.lastUpdated = new Date();

    // Validation after update (inconsistent)
    validateTask(task);

    // Update global state
    globalTasks[taskIndex] = task;

    // More side effects - project update
    if (task.projectId) {
      const project = globalProjects.find((p) => p.id === task.projectId);
      if (project) {
        const projectTasks = globalTasks.filter(
          (t) => t.projectId === project.id,
        );
        project.progress = util.calculateProgress(projectTasks);
        project.lastActivity = new Date();
      }
    }

    // Notification side effects
    if (updates.assignedTo && updates.assignedTo !== task.assignedTo) {
      const assignee = globalUsers.find((u) => u.id === updates.assignedTo);
      if (assignee) {
        util.sendNotification(
          "task_assigned",
          `You've been assigned to task: ${task.title}`,
          assignee,
        );
      }
    }

    util.logger("task_updated", { taskId, changes: Object.keys(updates) });

    return task;
  }

  // Delete task with side effects
  deleteTask(taskId: string) {
    if (!currentUser) throw new Error("Not authenticated");

    const taskIndex = globalTasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) throw new Error("Task not found");

    const task = globalTasks[taskIndex];

    // Permission check
    if (task.createdBy !== currentUser.id && !currentUser.isAdmin) {
      throw new Error("Only the creator or an admin can delete a task");
    }

    // Side effects before deletion
    if (task.projectId) {
      const project = globalProjects.find((p) => p.id === task.projectId);
      if (project) {
        project.taskCount = Math.max(0, (project.taskCount || 0) - 1);
        project.lastActivity = new Date();
        // More side effects - recalculating metrics
        setTimeout(() => {
          const projectTasks = globalTasks.filter(
            (t) => t.projectId === project.id && t.id !== taskId,
          );
          project.progress = util.calculateProgress(projectTasks);
        }, 0);
      }
    }

    // Global state mutation
    globalTasks.splice(taskIndex, 1);

    // Notification side effects
    if (task.assignedTo !== currentUser.id) {
      const assignee = globalUsers.find((u) => u.id === task.assignedTo);
      if (assignee) {
        util.sendNotification(
          "task_deleted",
          `A task assigned to you was deleted: ${task.title}`,
          assignee,
        );
      }
    }

    util.logger("task_deleted", { taskId, title: task.title });

    return { success: true };
  }

  // Search with mixed concerns
  searchTasks(criteria: any) {
    if (!currentUser) throw new Error("Not authenticated");

    // Filtering with complex inline logic
    let results = globalTasks.filter((task) => {
      // Basic visibility check
      const isVisible =
        task.createdBy === currentUser.id ||
        task.assignedTo === currentUser.id ||
        (task.projectId &&
          globalProjects.some(
            (p) =>
              p.id === task.projectId &&
              (p.members.includes(currentUser.id) || p.isPublic),
          ));

      if (!isVisible) return false;

      // Apply search criteria
      if (criteria.status && task.status !== criteria.status) return false;
      if (criteria.priority && task.priority !== criteria.priority)
        return false;
      if (criteria.assignedTo && task.assignedTo !== criteria.assignedTo)
        return false;
      if (criteria.projectId && task.projectId !== criteria.projectId)
        return false;

      // Text search
      if (criteria.searchText) {
        const searchText = criteria.searchText.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(searchText);
        const matchesDescription = task.description
          ?.toLowerCase()
          .includes(searchText);
        const matchesTags = task.tags?.some((tag: string) =>
          tag.toLowerCase().includes(searchText),
        );

        if (!matchesTitle && !matchesDescription && !matchesTags) return false;
      }

      // Date filters
      if (
        criteria.createdAfter &&
        new Date(task.createdAt) < new Date(criteria.createdAfter)
      )
        return false;
      if (
        criteria.createdBefore &&
        new Date(task.createdAt) > new Date(criteria.createdBefore)
      )
        return false;
      if (
        criteria.dueBefore &&
        task.dueDate &&
        new Date(task.dueDate) > new Date(criteria.dueBefore)
      )
        return false;
      if (
        criteria.dueAfter &&
        task.dueDate &&
        new Date(task.dueDate) < new Date(criteria.dueAfter)
      )
        return false;

      return true;
    });

    // Sorting mixed with filtering
    if (criteria.sortBy) {
      results.sort((a, b) => {
        if (criteria.sortBy === "dueDate") {
          if (!a.dueDate) return criteria.sortDir === "asc" ? 1 : -1;
          if (!b.dueDate) return criteria.sortDir === "asc" ? -1 : 1;
          return criteria.sortDir === "asc"
            ? new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
            : new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
        }

        if (criteria.sortBy === "priority") {
          const priorityMap: Record<string, number> = {
            high: 3,
            medium: 2,
            low: 1,
          };
          return criteria.sortDir === "asc"
            ? priorityMap[a.priority] - priorityMap[b.priority]
            : priorityMap[b.priority] - priorityMap[a.priority];
        }

        // Default sort by creation date
        return criteria.sortDir === "asc"
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    // Pagination mixed with core functionality
    if (criteria.limit) {
      const page = criteria.page || 1;
      const start = (page - 1) * criteria.limit;
      results = results.slice(start, start + criteria.limit);
    }

    util.logger("tasks_searched", { criteria, resultCount: results.length });

    return results;
  }
}

// Usage would be like:
// const tm = new TaskManager();
// tm.createTask({ title: 'Implement login', projectId: 'proj_123', priority: 'high' });
// tm.updateTask('task_123', { status: 'in_progress', assignedTo: 'user_456' });
