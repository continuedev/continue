const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ContextManager {
  constructor() {
    this.providers = {
      codebase: this.codebaseProvider,
      diff: this.diffProvider,
      terminal: this.terminalProvider,
      problems: this.problemsProvider,
      folder: this.folderProvider,
      codeHighlights: this.codeHighlightsProvider,
      currentFile: this.currentFileProvider,
      openFiles: this.openFilesProvider,
      search: this.searchProvider,
      url: this.urlProvider,
      git: this.gitProvider
    };
  }

  async retrieve(providerName, params = {}) {
    const provider = this.providers[providerName];
    if (!provider) {
      throw new Error(`Context provider not found: ${providerName}`);
    }
    
    return await provider.call(this, params);
  }

  async codebaseProvider(params) {
    const workspaceRoot = params.workspaceRoot || process.cwd();
    const maxFiles = params.maxFiles || 50;
    const excludePatterns = params.exclude || [
      'node_modules', '.git', 'dist', 'build', '.next', 
      '.vscode', '.idea', '*.log', '*.lock'
    ];

    try {
      const files = await this.walkDirectory(workspaceRoot, excludePatterns, maxFiles);
      const codebase = await Promise.all(
        files.map(async (filePath) => {
          try {
            const content = await fs.readFile(filePath, 'utf8');
            const relativePath = path.relative(workspaceRoot, filePath);
            return {
              path: relativePath,
              content: content.slice(0, 10000), // Limit content size
              language: this.getLanguageFromPath(filePath)
            };
          } catch (error) {
            return null;
          }
        })
      );

      return {
        type: 'codebase',
        data: codebase.filter(Boolean),
        metadata: {
          totalFiles: files.length,
          workspaceRoot
        }
      };
    } catch (error) {
      throw new Error(`Failed to retrieve codebase context: ${error.message}`);
    }
  }

  async diffProvider(params) {
    try {
      const { stdout: gitStatus } = await execAsync('git status --porcelain', {
        cwd: params.workspaceRoot || process.cwd()
      });

      const changes = [];
      if (gitStatus.trim()) {
        const { stdout: gitDiff } = await execAsync('git diff HEAD', {
          cwd: params.workspaceRoot || process.cwd()
        });
        changes.push({
          type: 'unstaged',
          diff: gitDiff
        });
      }

      return {
        type: 'diff',
        data: changes,
        metadata: {
          hasChanges: changes.length > 0
        }
      };
    } catch (error) {
      return {
        type: 'diff', 
        data: [],
        error: error.message
      };
    }
  }

  async terminalProvider(params) {
    const command = params.command || 'pwd && ls -la';
    const cwd = params.cwd || process.cwd();

    try {
      const { stdout, stderr } = await execAsync(command, { cwd });
      return {
        type: 'terminal',
        data: {
          command,
          cwd,
          stdout,
          stderr,
          success: true
        }
      };
    } catch (error) {
      return {
        type: 'terminal',
        data: {
          command,
          cwd,
          stdout: error.stdout || '',
          stderr: error.stderr || error.message,
          success: false
        }
      };
    }
  }

  async problemsProvider(params) {
    const workspaceRoot = params.workspaceRoot || process.cwd();
    
    try {
      // Look for common problem indicators
      const problems = [];

      // Check for TypeScript errors
      try {
        const { stdout } = await execAsync('npx tsc --noEmit', { cwd: workspaceRoot });
        if (stdout) {
          problems.push({
            type: 'typescript',
            content: stdout,
            severity: 'error'
          });
        }
      } catch (error) {
        if (error.stdout) {
          problems.push({
            type: 'typescript',
            content: error.stdout,
            severity: 'error'
          });
        }
      }

      // Check for ESLint issues
      try {
        const { stdout } = await execAsync('npx eslint . --format json', { cwd: workspaceRoot });
        const eslintResults = JSON.parse(stdout);
        eslintResults.forEach(file => {
          if (file.messages.length > 0) {
            problems.push({
              type: 'eslint',
              file: file.filePath,
              messages: file.messages,
              severity: 'warning'
            });
          }
        });
      } catch (error) {
        // ESLint not configured or other error
      }

      return {
        type: 'problems',
        data: problems,
        metadata: {
          totalProblems: problems.length
        }
      };
    } catch (error) {
      return {
        type: 'problems',
        data: [],
        error: error.message
      };
    }
  }

  async folderProvider(params) {
    const folderPath = params.path || process.cwd();
    
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      const structure = [];

      for (const entry of entries.slice(0, 100)) { // Limit entries
        const entryPath = path.join(folderPath, entry.name);
        const stats = await fs.stat(entryPath);
        
        structure.push({
          name: entry.name,
          path: entryPath,
          relativePath: path.relative(params.workspaceRoot || process.cwd(), entryPath),
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile(),
          size: stats.size,
          modified: stats.mtime
        });
      }

      return {
        type: 'folder',
        data: structure,
        metadata: {
          path: folderPath,
          totalEntries: entries.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to read folder: ${error.message}`);
    }
  }

  async codeHighlightsProvider(params) {
    // Mock implementation - would integrate with IDE
    const highlights = [
      {
        file: '/example/important.js',
        ranges: [
          { start: { line: 10, character: 0 }, end: { line: 15, character: 0 } },
          { start: { line: 25, character: 5 }, end: { line: 30, character: 0 } }
        ],
        content: 'function importantFunction() {\n  // Critical code here\n}'
      }
    ];

    return {
      type: 'codeHighlights',
      data: highlights,
      metadata: {
        totalHighlights: highlights.length
      }
    };
  }

  async currentFileProvider(params) {
    const filePath = params.filePath;
    if (!filePath) {
      throw new Error('File path required for currentFile provider');
    }

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const stats = await fs.stat(filePath);

      return {
        type: 'currentFile',
        data: {
          path: filePath,
          relativePath: path.relative(params.workspaceRoot || process.cwd(), filePath),
          content,
          language: this.getLanguageFromPath(filePath),
          size: stats.size,
          modified: stats.mtime
        }
      };
    } catch (error) {
      throw new Error(`Failed to read current file: ${error.message}`);
    }
  }

  async openFilesProvider(params) {
    // Mock implementation - would integrate with IDE
    const openFiles = [
      { path: '/example/main.js', language: 'javascript', isModified: false },
      { path: '/example/utils.py', language: 'python', isModified: true },
      { path: '/example/styles.css', language: 'css', isModified: false }
    ];

    return {
      type: 'openFiles',
      data: openFiles,
      metadata: {
        totalOpenFiles: openFiles.length
      }
    };
  }

  async searchProvider(params) {
    const query = params.query;
    const searchPath = params.path || process.cwd();
    
    if (!query) {
      throw new Error('Search query required');
    }

    try {
      const { stdout } = await execAsync(
        `grep -r -n -H "${query}" ${searchPath} --exclude-dir=node_modules --exclude-dir=.git`,
        { maxBuffer: 1024 * 1024 }
      );

      const results = stdout.split('\n').filter(line => line.trim()).map(line => {
        const [file, lineNum, ...content] = line.split(':');
        return {
          file: path.relative(searchPath, file),
          lineNumber: parseInt(lineNum),
          content: content.join(':').trim()
        };
      });

      return {
        type: 'search',
        data: results.slice(0, 50), // Limit results
        metadata: {
          query,
          totalResults: results.length
        }
      };
    } catch (error) {
      return {
        type: 'search',
        data: [],
        metadata: {
          query,
          error: error.message
        }
      };
    }
  }

  async urlProvider(params) {
    const url = params.url;
    if (!url) {
      throw new Error('URL required for url provider');
    }

    try {
      const axios = require('axios');
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Continue-AI-Assistant/1.0'
        }
      });

      return {
        type: 'url',
        data: {
          url,
          content: response.data.slice(0, 50000), // Limit content
          contentType: response.headers['content-type'],
          status: response.status
        }
      };
    } catch (error) {
      throw new Error(`Failed to fetch URL: ${error.message}`);
    }
  }

  async gitProvider(params) {
    const workspaceRoot = params.workspaceRoot || process.cwd();

    try {
      const [commitInfo, branchInfo, remoteInfo] = await Promise.all([
        execAsync('git log -1 --pretty=format:"%H|%an|%ae|%ad|%s"', { cwd: workspaceRoot }),
        execAsync('git branch --show-current', { cwd: workspaceRoot }),
        execAsync('git remote -v', { cwd: workspaceRoot }).catch(() => ({ stdout: '' }))
      ]);

      const [hash, author, email, date, message] = commitInfo.stdout.split('|');

      return {
        type: 'git',
        data: {
          currentBranch: branchInfo.stdout.trim(),
          lastCommit: {
            hash: hash?.slice(0, 8),
            author,
            email, 
            date,
            message
          },
          remotes: remoteInfo.stdout.trim().split('\n').filter(Boolean)
        }
      };
    } catch (error) {
      return {
        type: 'git',
        data: null,
        error: error.message
      };
    }
  }

  async walkDirectory(dir, excludePatterns, maxFiles, currentFiles = []) {
    if (currentFiles.length >= maxFiles) return currentFiles;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (currentFiles.length >= maxFiles) break;
        
        const fullPath = path.join(dir, entry.name);
        const shouldExclude = excludePatterns.some(pattern => {
          if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(entry.name);
          }
          return entry.name.includes(pattern);
        });

        if (shouldExclude) continue;

        if (entry.isFile()) {
          if (this.isTextFile(entry.name)) {
            currentFiles.push(fullPath);
          }
        } else if (entry.isDirectory()) {
          await this.walkDirectory(fullPath, excludePatterns, maxFiles, currentFiles);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }

    return currentFiles;
  }

  isTextFile(filename) {
    const textExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala',
      '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
      '.json', '.yaml', '.yml', '.xml', '.md', '.txt', '.sql',
      '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd'
    ];
    
    const ext = path.extname(filename).toLowerCase();
    return textExtensions.includes(ext);
  }

  getLanguageFromPath(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript', 
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.json': 'json',
      '.md': 'markdown',
      '.sql': 'sql',
      '.sh': 'bash',
      '.yml': 'yaml',
      '.yaml': 'yaml'
    };
    
    return languageMap[ext] || 'text';
  }
}

const contextManager = new ContextManager();

async function retrieve(req, res) {
  try {
    const { providers } = req.body;
    const results = [];

    for (const providerConfig of providers) {
      try {
        const result = await contextManager.retrieve(providerConfig.name, providerConfig.params);
        results.push(result);
      } catch (error) {
        results.push({
          type: providerConfig.name,
          error: error.message
        });
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getProviders(req, res) {
  try {
    const availableProviders = Object.keys(contextManager.providers).map(name => ({
      name,
      description: `${name.charAt(0).toUpperCase() + name.slice(1)} context provider`
    }));

    res.json({ success: true, data: availableProviders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function addProvider(req, res) {
  try {
    const { name, implementation } = req.body;
    
    // In a real implementation, you might want to validate and sandbox the implementation
    contextManager.providers[name] = new Function('params', implementation);
    
    res.json({ success: true, message: `Provider ${name} added successfully` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  retrieve,
  getProviders,
  addProvider,
  contextManager
};