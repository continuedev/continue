// A chaotic file upload and management system
// Difficulty: 3 - Moderate refactoring needed

// Types
type FileData = {
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
};

type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
};

// Global storage
const fileStorage: Record<string, FileData> = {};
const users: Record<string, User> = {
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
let currentUser: string | null = null;
let storageUsed = 0;
const MAX_STORAGE = 1024 * 1024 * 1024; // 1GB
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Login function
function login(userId: string) {
  if (users[userId]) {
    currentUser = userId;
    console.log(`Logged in as ${users[userId].name}`);
    return true;
  } else {
    console.error("User not found");
    return false;
  }
}

// Logout function
function logout() {
  currentUser = null;
  console.log("Logged out");
  return true;
}

// Upload file
function uploadFile(
  fileName: string,
  fileSize: number,
  fileType: string,
  isPublic: boolean = false,
  tags: string[] = [],
  metadata: Record<string, any> = {},
) {
  // Check if user is logged in
  if (!currentUser) {
    console.error("User not logged in");
    return false;
  }

  // Check file size
  if (fileSize > MAX_FILE_SIZE) {
    console.error(
      `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    );
    return false;
  }

  // Check available storage
  if (storageUsed + fileSize > MAX_STORAGE) {
    console.error("Not enough storage space");
    return false;
  }

  // Generate ID
  const fileId = "file_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

  // Create file path
  const path = `/storage/${currentUser}/${fileId}_${fileName}`;

  // Create file data
  const fileData: FileData = {
    id: fileId,
    name: fileName,
    size: fileSize,
    type: fileType,
    uploadDate: new Date(),
    uploadedBy: currentUser,
    path: path,
    isPublic: isPublic,
    tags: tags,
    metadata: metadata,
  };

  // Save file data
  fileStorage[fileId] = fileData;

  // Update storage used
  storageUsed += fileSize;

  console.log(`File ${fileName} uploaded successfully`);
  return fileId;
}

// Delete file
function deleteFile(fileId: string) {
  // Check if user is logged in
  if (!currentUser) {
    console.error("User not logged in");
    return false;
  }

  // Check if file exists
  if (!fileStorage[fileId]) {
    console.error("File not found");
    return false;
  }

  // Check if user has permission
  const file = fileStorage[fileId];
  const user = users[currentUser];
  if (file.uploadedBy !== currentUser && user.role !== "admin") {
    console.error("Permission denied");
    return false;
  }

  // Update storage used
  storageUsed -= file.size;

  // Remove file
  delete fileStorage[fileId];

  console.log(`File ${file.name} deleted successfully`);
  return true;
}

// Update file metadata
function updateFileMetadata(
  fileId: string,
  updates: {
    name?: string;
    isPublic?: boolean;
    tags?: string[];
    metadata?: Record<string, any>;
  },
) {
  // Check if user is logged in
  if (!currentUser) {
    console.error("User not logged in");
    return false;
  }

  // Check if file exists
  if (!fileStorage[fileId]) {
    console.error("File not found");
    return false;
  }

  // Check if user has permission
  const file = fileStorage[fileId];
  const user = users[currentUser];
  if (file.uploadedBy !== currentUser && user.role !== "admin") {
    console.error("Permission denied");
    return false;
  }

  // Update file data
  if (updates.name !== undefined) fileStorage[fileId].name = updates.name;
  if (updates.isPublic !== undefined)
    fileStorage[fileId].isPublic = updates.isPublic;
  if (updates.tags !== undefined) fileStorage[fileId].tags = updates.tags;
  if (updates.metadata !== undefined) {
    fileStorage[fileId].metadata = {
      ...fileStorage[fileId].metadata,
      ...updates.metadata,
    };
  }

  console.log(`File ${file.name} updated successfully`);
  return true;
}

// Get file data
function getFileData(fileId: string) {
  // Check if file exists
  if (!fileStorage[fileId]) {
    console.error("File not found");
    return null;
  }

  const file = fileStorage[fileId];

  // Check if user has permission
  if (
    !file.isPublic &&
    currentUser !== file.uploadedBy &&
    users[currentUser]?.role !== "admin"
  ) {
    console.error("Permission denied");
    return null;
  }

  return file;
}

// Search files
function searchFiles(query: {
  name?: string;
  type?: string;
  tags?: string[];
  uploadedBy?: string;
  isPublic?: boolean;
  minSize?: number;
  maxSize?: number;
  uploadedAfter?: Date;
  uploadedBefore?: Date;
}) {
  // Check if user is logged in
  if (!currentUser) {
    console.error("User not logged in");
    return [];
  }

  const user = users[currentUser];
  const results: FileData[] = [];

  // Filter files
  for (const fileId in fileStorage) {
    const file = fileStorage[fileId];

    // Skip files user doesn't have access to
    if (
      !file.isPublic &&
      file.uploadedBy !== currentUser &&
      user.role !== "admin"
    ) {
      continue;
    }

    // Apply filters
    let match = true;

    if (
      query.name &&
      !file.name.toLowerCase().includes(query.name.toLowerCase())
    ) {
      match = false;
    }

    if (query.type && file.type !== query.type) {
      match = false;
    }

    if (query.uploadedBy && file.uploadedBy !== query.uploadedBy) {
      match = false;
    }

    if (query.isPublic !== undefined && file.isPublic !== query.isPublic) {
      match = false;
    }

    if (query.minSize !== undefined && file.size < query.minSize) {
      match = false;
    }

    if (query.maxSize !== undefined && file.size > query.maxSize) {
      match = false;
    }

    if (query.uploadedAfter && file.uploadDate < query.uploadedAfter) {
      match = false;
    }

    if (query.uploadedBefore && file.uploadDate > query.uploadedBefore) {
      match = false;
    }

    if (query.tags && query.tags.length > 0) {
      if (!file.tags) {
        match = false;
      } else {
        for (const tag of query.tags) {
          if (!file.tags.includes(tag)) {
            match = false;
            break;
          }
        }
      }
    }

    if (match) {
      results.push(file);
    }
  }

  return results;
}

// Get storage stats
function getStorageStats() {
  return {
    used: storageUsed,
    total: MAX_STORAGE,
    available: MAX_STORAGE - storageUsed,
    fileCount: Object.keys(fileStorage).length,
  };
}

// Share file with user
function shareFile(fileId: string, targetUserId: string) {
  // Check if user is logged in
  if (!currentUser) {
    console.error("User not logged in");
    return false;
  }

  // Check if file exists
  if (!fileStorage[fileId]) {
    console.error("File not found");
    return false;
  }

  // Check if target user exists
  if (!users[targetUserId]) {
    console.error("Target user not found");
    return false;
  }

  // Check if user has permission
  const file = fileStorage[fileId];
  if (file.uploadedBy !== currentUser && users[currentUser]?.role !== "admin") {
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

  console.log(`File ${file.name} shared with ${users[targetUserId].name}`);
  return true;
}

// Example usage
login("user1");
const fileId = uploadFile(
  "document.pdf",
  1024 * 1024,
  "application/pdf",
  false,
  ["important", "document"],
);
updateFileMetadata(fileId, { isPublic: true });
shareFile(fileId, "user2");
console.log(getFileData(fileId));
console.log(getStorageStats());
logout();

export {
  deleteFile,
  fileStorage,
  getFileData,
  getStorageStats,
  login,
  logout,
  searchFiles,
  shareFile,
  updateFileMetadata,
  uploadFile,
  users,
};
