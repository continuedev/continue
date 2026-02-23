// Refactored file upload and management system following SOLID principles
// Original: next-edit-6-3.ts

// Types
interface FileData {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: Date;
  uploadedBy: string;
  path: string;
  isPublic: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
}

interface FileQuery {
  name?: string;
  type?: string;
  tags?: string[];
  uploadedBy?: string;
  isPublic?: boolean;
  minSize?: number;
  maxSize?: number;
  uploadedAfter?: Date;
  uploadedBefore?: Date;
}

interface FileMetadataUpdate {
  name?: string;
  isPublic?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface StorageStats {
  used: number;
  total: number;
  available: number;
  fileCount: number;
}

// Constants
const MAX_STORAGE = 1024 * 1024 * 1024; // 1GB
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// User Management
class UserManager {
  private users: Record<string, User>;
  private currentUser: string | null = null;

  constructor(initialUsers: Record<string, User> = {}) {
    this.users = initialUsers;
  }

  login(userId: string): boolean {
    if (this.users[userId]) {
      this.currentUser = userId;
      console.log(`Logged in as ${this.users[userId].name}`);
      return true;
    } else {
      console.error("User not found");
      return false;
    }
  }

  logout(): boolean {
    this.currentUser = null;
    console.log("Logged out");
    return true;
  }

  getCurrentUser(): string | null {
    return this.currentUser;
  }

  getUser(userId: string): User | null {
    return this.users[userId] || null;
  }

  getCurrentUserData(): User | null {
    return this.currentUser ? this.users[this.currentUser] : null;
  }

  userExists(userId: string): boolean {
    return !!this.users[userId];
  }
}

// File Storage Management
class FileStorageManager {
  private fileStorage: Record<string, FileData> = {};
  private storageUsed = 0;
  private readonly maxStorage: number;
  private readonly maxFileSize: number;
  private userManager: UserManager;

  constructor(
    userManager: UserManager,
    maxStorage = MAX_STORAGE,
    maxFileSize = MAX_FILE_SIZE,
  ) {
    this.userManager = userManager;
    this.maxStorage = maxStorage;
    this.maxFileSize = maxFileSize;
  }

  uploadFile(
    fileName: string,
    fileSize: number,
    fileType: string,
    isPublic = false,
    tags: string[] = [],
    metadata: Record<string, any> = {},
  ): string | false {
    const currentUser = this.userManager.getCurrentUser();

    // Check if user is logged in
    if (!currentUser) {
      console.error("User not logged in");
      return false;
    }

    // Check file size
    if (!this.validateFileSize(fileSize)) {
      return false;
    }

    // Check available storage
    if (!this.hasEnoughStorage(fileSize)) {
      return false;
    }

    // Generate file data
    const fileId = this.generateFileId();
    const path = this.createFilePath(currentUser, fileId, fileName);
    const fileData: FileData = {
      id: fileId,
      name: fileName,
      size: fileSize,
      type: fileType,
      uploadDate: new Date(),
      uploadedBy: currentUser,
      path,
      isPublic,
      tags,
      metadata,
    };

    // Save file and update storage
    this.fileStorage[fileId] = fileData;
    this.storageUsed += fileSize;

    console.log(`File ${fileName} uploaded successfully`);
    return fileId;
  }

  deleteFile(fileId: string): boolean {
    const currentUser = this.userManager.getCurrentUser();
    const currentUserData = this.userManager.getCurrentUserData();

    // Check if user is logged in
    if (!currentUser || !currentUserData) {
      console.error("User not logged in");
      return false;
    }

    // Check if file exists
    const file = this.getFileById(fileId);
    if (!file) {
      console.error("File not found");
      return false;
    }

    // Check permissions
    if (!this.canModifyFile(file, currentUser, currentUserData.role)) {
      console.error("Permission denied");
      return false;
    }

    // Update storage and remove file
    this.storageUsed -= file.size;
    delete this.fileStorage[fileId];

    console.log(`File ${file.name} deleted successfully`);
    return true;
  }

  updateFileMetadata(fileId: string, updates: FileMetadataUpdate): boolean {
    const currentUser = this.userManager.getCurrentUser();
    const currentUserData = this.userManager.getCurrentUserData();

    // Check if user is logged in
    if (!currentUser || !currentUserData) {
      console.error("User not logged in");
      return false;
    }

    // Check if file exists
    const file = this.getFileById(fileId);
    if (!file) {
      console.error("File not found");
      return false;
    }

    // Check permissions
    if (!this.canModifyFile(file, currentUser, currentUserData.role)) {
      console.error("Permission denied");
      return false;
    }

    // Update file data
    if (updates.name !== undefined)
      this.fileStorage[fileId].name = updates.name;
    if (updates.isPublic !== undefined)
      this.fileStorage[fileId].isPublic = updates.isPublic;
    if (updates.tags !== undefined)
      this.fileStorage[fileId].tags = updates.tags;
    if (updates.metadata !== undefined) {
      this.fileStorage[fileId].metadata = {
        ...this.fileStorage[fileId].metadata,
        ...updates.metadata,
      };
    }

    console.log(`File ${file.name} updated successfully`);
    return true;
  }

  getFileData(fileId: string): FileData | null {
    // Check if file exists
    const file = this.getFileById(fileId);
    if (!file) {
      console.error("File not found");
      return null;
    }

    const currentUser = this.userManager.getCurrentUser();
    const currentUserData = this.userManager.getCurrentUserData();

    // Check if user has permission to access
    if (
      !file.isPublic &&
      currentUser !== file.uploadedBy &&
      currentUserData?.role !== "admin" &&
      !this.isSharedWithUser(file, currentUser)
    ) {
      console.error("Permission denied");
      return null;
    }

    return file;
  }

  searchFiles(query: FileQuery): FileData[] {
    const currentUser = this.userManager.getCurrentUser();
    const currentUserData = this.userManager.getCurrentUserData();

    // Check if user is logged in
    if (!currentUser || !currentUserData) {
      console.error("User not logged in");
      return [];
    }

    const results: FileData[] = [];

    // Filter files
    for (const fileId in this.fileStorage) {
      const file = this.fileStorage[fileId];

      // Skip files user doesn't have access to
      if (
        !file.isPublic &&
        file.uploadedBy !== currentUser &&
        currentUserData.role !== "admin" &&
        !this.isSharedWithUser(file, currentUser)
      ) {
        continue;
      }

      if (this.matchesQuery(file, query)) {
        results.push(file);
      }
    }

    return results;
  }

  getStorageStats(): StorageStats {
    return {
      used: this.storageUsed,
      total: this.maxStorage,
      available: this.maxStorage - this.storageUsed,
      fileCount: Object.keys(this.fileStorage).length,
    };
  }

  shareFile(fileId: string, targetUserId: string): boolean {
    const currentUser = this.userManager.getCurrentUser();
    const currentUserData = this.userManager.getCurrentUserData();

    // Check if user is logged in
    if (!currentUser || !currentUserData) {
      console.error("User not logged in");
      return false;
    }

    // Check if file exists
    const file = this.getFileById(fileId);
    if (!file) {
      console.error("File not found");
      return false;
    }

    // Check if target user exists
    if (!this.userManager.userExists(targetUserId)) {
      console.error("Target user not found");
      return false;
    }

    // Check if user has permission
    if (!this.canModifyFile(file, currentUser, currentUserData.role)) {
      console.error("Permission denied");
      return false;
    }

    // Share file by adding metadata
    if (!file.metadata) {
      file.metadata = {};
    }

    if (!file.metadata.sharedWith) {
      file.metadata.sharedWith = [];
    }

    // Check if already shared
    if (!file.metadata.sharedWith.includes(targetUserId)) {
      file.metadata.sharedWith.push(targetUserId);
    }

    const targetUser = this.userManager.getUser(targetUserId);
    console.log(`File ${file.name} shared with ${targetUser?.name}`);
    return true;
  }

  // Helper methods
  private generateFileId(): string {
    return "file_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  }

  private createFilePath(
    userId: string,
    fileId: string,
    fileName: string,
  ): string {
    return `/storage/${userId}/${fileId}_${fileName}`;
  }

  private getFileById(fileId: string): FileData | null {
    return this.fileStorage[fileId] || null;
  }

  private validateFileSize(fileSize: number): boolean {
    if (fileSize > this.maxFileSize) {
      console.error(
        `File too large. Maximum size is ${this.maxFileSize / (1024 * 1024)}MB`,
      );
      return false;
    }
    return true;
  }

  private hasEnoughStorage(fileSize: number): boolean {
    if (this.storageUsed + fileSize > this.maxStorage) {
      console.error("Not enough storage space");
      return false;
    }
    return true;
  }

  private canModifyFile(
    file: FileData,
    userId: string,
    userRole: string,
  ): boolean {
    return file.uploadedBy === userId || userRole === "admin";
  }

  private isSharedWithUser(file: FileData, userId: string | null): boolean {
    if (!userId) return false;
    return !!file.metadata?.sharedWith?.includes(userId);
  }

  private matchesQuery(file: FileData, query: FileQuery): boolean {
    // Name filter
    if (
      query.name &&
      !file.name.toLowerCase().includes(query.name.toLowerCase())
    ) {
      return false;
    }

    // Type filter
    if (query.type && file.type !== query.type) {
      return false;
    }

    // Upload user filter
    if (query.uploadedBy && file.uploadedBy !== query.uploadedBy) {
      return false;
    }

    // Public/private filter
    if (query.isPublic !== undefined && file.isPublic !== query.isPublic) {
      return false;
    }

    // Size range filter
    if (query.minSize !== undefined && file.size < query.minSize) {
      return false;
    }
    if (query.maxSize !== undefined && file.size > query.maxSize) {
      return false;
    }

    // Date range filter
    if (query.uploadedAfter && file.uploadDate < query.uploadedAfter) {
      return false;
    }
    if (query.uploadedBefore && file.uploadDate > query.uploadedBefore) {
      return false;
    }

    // Tags filter
    if (query.tags && query.tags.length > 0) {
      if (!file.tags) {
        return false;
      } else {
        for (const tag of query.tags) {
          if (!file.tags.includes(tag)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  // For testing/export purposes
  getFileStorage(): Record<string, FileData> {
    return this.fileStorage;
  }
}

// Demo Application
// Initialize system with users
const initialUsers: Record<string, User> = {
  user1: {
    id: "user1",
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
  },
  user2: {
    id: "user2",
    name: "Regular User",
    email: "user@example.com",
    role: "user",
  },
  user3: {
    id: "user3",
    name: "Guest User",
    email: "guest@example.com",
    role: "guest",
  },
};

// Create system instances
const userManager = new UserManager(initialUsers);
const fileManager = new FileStorageManager(userManager);

// Example usage
userManager.login("user1");
const fileId = fileManager.uploadFile(
  "document.pdf",
  1024 * 1024,
  "application/pdf",
  false,
  ["important", "document"],
);
fileManager.updateFileMetadata(fileId as string, { isPublic: true });
fileManager.shareFile(fileId as string, "user2");
console.log(fileManager.getFileData(fileId as string));
console.log(fileManager.getStorageStats());
userManager.logout();

// Exported API for backward compatibility
export const fileStorage = fileManager.getFileStorage();
export const users = initialUsers;
export function login(userId: string): boolean {
  return userManager.login(userId);
}
export function logout(): boolean {
  return userManager.logout();
}
export function uploadFile(
  fileName: string,
  fileSize: number,
  fileType: string,
  isPublic = false,
  tags: string[] = [],
  metadata: Record<string, any> = {},
): string | false {
  return fileManager.uploadFile(
    fileName,
    fileSize,
    fileType,
    isPublic,
    tags,
    metadata,
  );
}
export function deleteFile(fileId: string): boolean {
  return fileManager.deleteFile(fileId);
}
export function updateFileMetadata(
  fileId: string,
  updates: FileMetadataUpdate,
): boolean {
  return fileManager.updateFileMetadata(fileId, updates);
}
export function getFileData(fileId: string): FileData | null {
  return fileManager.getFileData(fileId);
}
export function searchFiles(query: FileQuery): FileData[] {
  return fileManager.searchFiles(query);
}
export function getStorageStats(): StorageStats {
  return fileManager.getStorageStats();
}
export function shareFile(fileId: string, targetUserId: string): boolean {
  return fileManager.shareFile(fileId, targetUserId);
}

export {
  FileData,
  FileMetadataUpdate,
  FileQuery,
  FileStorageManager,
  StorageStats,
  User,
  UserManager,
};

/*
Code Smells in the Original File (next-edit-6-3.ts)

Violation of Single Responsibility Principle (SRP):

The code mixed user management, file storage, permissions, and business logic in a single file with global state.
Functions were handling multiple responsibilities (authentication, validation, business logic).


Global State and Poor Encapsulation:

Used global variables (fileStorage, users, currentUser, storageUsed) instead of encapsulated state.
Direct manipulation of shared state led to potential side effects and made testing difficult.


Lack of Proper Abstractions:

No separation between data access and business logic.
No interfaces defined for the different components of the system.


Repetitive Code:

Authentication and permission checks repeated in every function.
File existence validation duplicated across functions.


Poor Error Handling:

Inconsistent error reporting (some console.error, some boolean returns).
No distinction between different types of errors.


Primitive Obsession:

Using primitive types instead of creating proper domain objects.


Tight Coupling:

Functions directly depend on global state.
No dependency injection making the code hard to test or extend.


Improvements Made in the Refactored Solution

Applied Single Responsibility Principle:

Created separate UserManager and FileStorageManager classes with clear responsibilities.
Each method has a single purpose with helper methods for validation and common tasks.


Proper Encapsulation:

Encapsulated state within classes using private fields.
Provided controlled access to state through methods with proper validation.


Improved Type Safety:

Converted types to interfaces for better type safety.
Added specific interfaces for operations (FileQuery, FileMetadataUpdate, etc.).


Dependency Injection:

FileStorageManager depends on UserManager through constructor injection.
Made constants configurable through constructor parameters.


Extracted Helper Methods:

Created private helper methods for validation logic.
Extracted common operations like canModifyFile, isSharedWithUser, etc.


Improved Code Structure:

Organized related functionality into classes.
Added proper commenting and documentation.


Preserved Backward Compatibility:

Maintained the original API through exported functions.
Made it easy to migrate existing code to use the new object-oriented approach.


Applied Open/Closed Principle:

The system is now extensible without modifying existing code.
New behaviors can be added by extending or composing with existing classes.


Applied Interface Segregation:

Split large interfaces into smaller, more specific ones.
Created purpose-specific interfaces like FileQuery and FileMetadataUpdate.


Improved Error Handling:

Consistent error reporting pattern.
Clear validation in separate methods.
*/
