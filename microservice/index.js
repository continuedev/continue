const express = require('express');
const cors = require('cors');
const path = require('path');

// Import all core functionality
const config = require('./config');
const llm = require('./llm');
const indexing = require('./indexing');
const context = require('./context');
const autocomplete = require('./autocomplete');
const edit = require('./edit');
const chat = require('./chat');
const auth = require('./auth');

class ContinueMicroservice {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    this.app.use('/static', express.static(path.join(__dirname, 'static')));
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Config endpoints
    this.app.get('/config', config.getConfig);
    this.app.post('/config', config.updateConfig);
    this.app.get('/config/models', config.getModels);

    // LLM endpoints
    this.app.post('/llm/chat', llm.chat);
    this.app.post('/llm/complete', llm.complete);
    this.app.get('/llm/models', llm.getAvailableModels);

    // Context endpoints
    this.app.post('/context/retrieve', context.retrieve);
    this.app.get('/context/providers', context.getProviders);
    this.app.post('/context/add-provider', context.addProvider);

    // Indexing endpoints
    this.app.post('/index/codebase', indexing.indexCodebase);
    this.app.get('/index/status', indexing.getIndexStatus);
    this.app.post('/index/search', indexing.search);

    // Autocomplete endpoints
    this.app.post('/autocomplete', autocomplete.complete);
    this.app.post('/autocomplete/accept', autocomplete.accept);
    this.app.post('/autocomplete/reject', autocomplete.reject);

    // Edit endpoints
    this.app.post('/edit/apply', edit.apply);
    this.app.post('/edit/diff', edit.generateDiff);
    this.app.post('/edit/stream', edit.streamEdit);

    // Chat endpoints
    this.app.post('/chat/message', chat.sendMessage);
    this.app.get('/chat/history', chat.getHistory);
    this.app.post('/chat/clear', chat.clearHistory);

    // Auth endpoints
    this.app.post('/auth/login', auth.login);
    this.app.post('/auth/logout', auth.logout);
    this.app.get('/auth/user', auth.getCurrentUser);

    // IDE integration endpoints
    this.app.post('/ide/workspace', this.handleWorkspace.bind(this));
    this.app.post('/ide/files', this.handleFiles.bind(this));
    this.app.post('/ide/terminal', this.handleTerminal.bind(this));

    // Error handling
    this.app.use(this.errorHandler);
  }

  async handleWorkspace(req, res) {
    try {
      const { action, data } = req.body;
      let result;

      switch (action) {
        case 'getWorkspaceInfo':
          result = await this.getWorkspaceInfo(data);
          break;
        case 'getOpenFiles':
          result = await this.getOpenFiles(data);
          break;
        case 'readFile':
          result = await this.readFile(data);
          break;
        case 'writeFile':
          result = await this.writeFile(data);
          break;
        default:
          throw new Error(`Unknown workspace action: ${action}`);
      }

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async handleFiles(req, res) {
    try {
      const { action, data } = req.body;
      let result;

      switch (action) {
        case 'search':
          result = await this.searchFiles(data);
          break;
        case 'list':
          result = await this.listFiles(data);
          break;
        case 'watch':
          result = await this.watchFiles(data);
          break;
        default:
          throw new Error(`Unknown files action: ${action}`);
      }

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async handleTerminal(req, res) {
    try {
      const { command, cwd } = req.body;
      const result = await this.executeCommand(command, cwd);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  errorHandler(error, req, res, next) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }

  async getWorkspaceInfo(data) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const workspacePath = data.path || process.cwd();
    const stats = await fs.stat(workspacePath);
    
    return {
      path: workspacePath,
      name: path.basename(workspacePath),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      modified: stats.mtime
    };
  }

  async getOpenFiles(data) {
    // Mock implementation - in real scenario would integrate with IDE
    return {
      files: [
        { path: '/example/file1.js', language: 'javascript', isModified: false },
        { path: '/example/file2.py', language: 'python', isModified: true }
      ]
    };
  }

  async readFile(data) {
    const fs = require('fs').promises;
    const content = await fs.readFile(data.path, 'utf8');
    return { content, path: data.path };
  }

  async writeFile(data) {
    const fs = require('fs').promises;
    await fs.writeFile(data.path, data.content, 'utf8');
    return { success: true, path: data.path };
  }

  async searchFiles(data) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync(`grep -r "${data.query}" ${data.path || '.'}`);
      const results = stdout.split('\n').filter(line => line.trim()).map(line => {
        const [file, ...content] = line.split(':');
        return { file, content: content.join(':') };
      });
      return { results };
    } catch (error) {
      return { results: [] };
    }
  }

  async listFiles(data) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const targetPath = data.path || process.cwd();
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    
    const files = entries.map(entry => ({
      name: entry.name,
      path: path.join(targetPath, entry.name),
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile()
    }));
    
    return { files };
  }

  async watchFiles(data) {
    // Mock implementation - would use fs.watch in real scenario
    return { watching: data.paths || [] };
  }

  async executeCommand(command, cwd = process.cwd()) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      const { stdout, stderr } = await execAsync(command, { cwd });
      return { stdout, stderr, exitCode: 0 };
    } catch (error) {
      return { 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message, 
        exitCode: error.code || 1 
      };
    }
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`Continue Microservice running on port ${this.port}`);
      console.log(`Health check: http://localhost:${this.port}/health`);
    });
  }
}

// Start the microservice
const service = new ContinueMicroservice();
service.start();

module.exports = ContinueMicroservice;