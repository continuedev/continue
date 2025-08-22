const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class AuthManager {
  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.jwtSecret = process.env.JWT_SECRET || 'continue-dev-secret-key';
    this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  async login(credentials) {
    const { username, password, apiKey, provider } = credentials;

    // Handle API key authentication
    if (apiKey) {
      return this.authenticateWithApiKey(apiKey, provider);
    }

    // Handle username/password authentication
    if (username && password) {
      return this.authenticateWithPassword(username, password);
    }

    throw new Error('Invalid credentials provided');
  }

  async authenticateWithApiKey(apiKey, provider = 'continue') {
    // Validate API key format
    if (!apiKey || apiKey.length < 10) {
      throw new Error('Invalid API key format');
    }

    // In a real implementation, you would validate against your API key service
    const user = {
      id: this.generateUserId(apiKey),
      username: `${provider}-user`,
      provider,
      apiKey: this.hashApiKey(apiKey),
      authenticationType: 'apikey',
      permissions: this.getDefaultPermissions(),
      createdAt: new Date().toISOString()
    };

    // Generate session
    const session = this.createSession(user);
    
    return {
      user: this.sanitizeUser(user),
      token: session.token,
      expiresAt: session.expiresAt
    };
  }

  async authenticateWithPassword(username, password) {
    // Check if user exists
    const existingUser = Array.from(this.users.values()).find(u => u.username === username);
    
    if (existingUser) {
      // Verify password
      const passwordHash = this.hashPassword(password, existingUser.salt);
      if (passwordHash !== existingUser.passwordHash) {
        throw new Error('Invalid credentials');
      }
      
      const session = this.createSession(existingUser);
      return {
        user: this.sanitizeUser(existingUser),
        token: session.token,
        expiresAt: session.expiresAt
      };
    } else {
      // Create new user (for demo purposes - in production, you'd have proper registration)
      const salt = crypto.randomBytes(32).toString('hex');
      const user = {
        id: crypto.randomUUID(),
        username,
        passwordHash: this.hashPassword(password, salt),
        salt,
        authenticationType: 'password',
        permissions: this.getDefaultPermissions(),
        createdAt: new Date().toISOString()
      };

      this.users.set(user.id, user);
      
      const session = this.createSession(user);
      return {
        user: this.sanitizeUser(user),
        token: session.token,
        expiresAt: session.expiresAt
      };
    }
  }

  async logout(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      const sessionId = decoded.sessionId;
      
      // Remove session
      this.sessions.delete(sessionId);
      
      return { success: true };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async getCurrentUser(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      const session = this.sessions.get(decoded.sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      // Check session expiry
      if (Date.now() > session.expiresAt) {
        this.sessions.delete(decoded.sessionId);
        throw new Error('Session expired');
      }
      
      const user = this.users.get(session.userId) || session.user;
      if (!user) {
        throw new Error('User not found');
      }
      
      // Update last accessed time
      session.lastAccessed = Date.now();
      
      return {
        user: this.sanitizeUser(user),
        session: {
          id: session.id,
          expiresAt: session.expiresAt,
          lastAccessed: session.lastAccessed
        }
      };
    } catch (error) {
      throw new Error('Authentication failed: ' + error.message);
    }
  }

  createSession(user) {
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + this.sessionTimeout;
    
    const session = {
      id: sessionId,
      userId: user.id,
      user: user,
      createdAt: Date.now(),
      expiresAt,
      lastAccessed: Date.now()
    };
    
    this.sessions.set(sessionId, session);
    
    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        sessionId,
        username: user.username
      },
      this.jwtSecret,
      {
        expiresIn: '24h'
      }
    );
    
    return {
      token,
      expiresAt
    };
  }

  generateUserId(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
  }

  hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }

  getDefaultPermissions() {
    return {
      chat: true,
      edit: true,
      autocomplete: true,
      codebase: true,
      terminal: false, // Restricted by default
      config: false,   // Restricted by default
      admin: false
    };
  }

  sanitizeUser(user) {
    const { passwordHash, salt, apiKey, ...sanitized } = user;
    return sanitized;
  }

  // Middleware to authenticate requests
  authenticateRequest(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    
    this.getCurrentUser(token)
      .then(result => {
        req.user = result.user;
        req.session = result.session;
        next();
      })
      .catch(error => {
        res.status(401).json({ success: false, error: error.message });
      });
  }

  // Middleware to check permissions
  requirePermission(permission) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      if (!req.user.permissions || !req.user.permissions[permission]) {
        return res.status(403).json({ success: false, error: `Permission '${permission}' required` });
      }

      next();
    };
  }

  // Clean up expired sessions (call periodically)
  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
      }
    }
  }

  // Get stats about current authentication state
  getAuthStats() {
    const now = Date.now();
    const activeSessions = Array.from(this.sessions.values()).filter(s => now < s.expiresAt);
    
    return {
      totalUsers: this.users.size,
      activeSessions: activeSessions.length,
      totalSessions: this.sessions.size,
      authTypes: {
        password: Array.from(this.users.values()).filter(u => u.authenticationType === 'password').length,
        apikey: activeSessions.filter(s => s.user.authenticationType === 'apikey').length
      }
    };
  }
}

// Initialize auth manager
const authManager = new AuthManager();

// Cleanup expired sessions every hour
setInterval(() => {
  authManager.cleanupExpiredSessions();
}, 60 * 60 * 1000);

async function login(req, res) {
  try {
    const result = await authManager.login(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
}

async function logout(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    const result = await authManager.logout(token);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

async function getCurrentUser(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    const result = await authManager.getCurrentUser(token);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
}

module.exports = {
  login,
  logout,
  getCurrentUser,
  authManager,
  authenticateRequest: authManager.authenticateRequest.bind(authManager),
  requirePermission: authManager.requirePermission.bind(authManager)
};