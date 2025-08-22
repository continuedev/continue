const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class IndexingManager {
  constructor() {
    this.index = new Map();
    this.embeddings = new Map();
    this.indexPath = path.join(process.cwd(), '.continue', 'index.json');
    this.isIndexing = false;
    this.indexProgress = { current: 0, total: 0, status: 'idle' };
  }

  async initializeIndex() {
    try {
      await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
      const indexData = await fs.readFile(this.indexPath, 'utf8');
      const data = JSON.parse(indexData);
      this.index = new Map(Object.entries(data.index || {}));
      this.embeddings = new Map(Object.entries(data.embeddings || {}));
    } catch (error) {
      // Index doesn't exist yet, start fresh
      this.index = new Map();
      this.embeddings = new Map();
    }
  }

  async saveIndex() {
    const data = {
      index: Object.fromEntries(this.index),
      embeddings: Object.fromEntries(this.embeddings),
      lastUpdated: new Date().toISOString()
    };
    
    await fs.writeFile(this.indexPath, JSON.stringify(data, null, 2));
  }

  async indexCodebase(workspaceRoot, options = {}) {
    if (this.isIndexing) {
      throw new Error('Indexing already in progress');
    }

    this.isIndexing = true;
    this.indexProgress = { current: 0, total: 0, status: 'starting' };

    try {
      const excludePatterns = options.exclude || [
        'node_modules', '.git', 'dist', 'build', '.next', 
        '.vscode', '.idea', '*.log', '*.lock', '.continue'
      ];

      // Find all files to index
      const files = await this.findIndexableFiles(workspaceRoot, excludePatterns);
      this.indexProgress.total = files.length;
      this.indexProgress.status = 'indexing';

      // Process files in chunks
      const chunkSize = 10;
      for (let i = 0; i < files.length; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize);
        await Promise.all(chunk.map(filePath => this.indexFile(filePath, workspaceRoot)));
        this.indexProgress.current = Math.min(i + chunkSize, files.length);
      }

      await this.saveIndex();
      this.indexProgress.status = 'completed';
      
      return {
        filesIndexed: files.length,
        totalChunks: this.index.size,
        indexPath: this.indexPath
      };

    } catch (error) {
      this.indexProgress.status = 'error';
      throw error;
    } finally {
      this.isIndexing = false;
    }
  }

  async indexFile(filePath, workspaceRoot) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const stats = await fs.stat(filePath);
      const relativePath = path.relative(workspaceRoot, filePath);
      
      // Create file hash for change detection
      const hash = crypto.createHash('md5').update(content).digest('hex');
      const existing = this.index.get(relativePath);
      
      // Skip if file hasn't changed
      if (existing && existing.hash === hash) {
        return;
      }

      // Chunk the file content
      const chunks = this.chunkContent(content, {
        maxChunkSize: 1000,
        overlap: 100
      });

      const fileData = {
        path: relativePath,
        fullPath: filePath,
        hash,
        language: this.getLanguageFromPath(filePath),
        size: stats.size,
        modified: stats.mtime.toISOString(),
        chunks: chunks.map((chunk, index) => ({
          id: `${relativePath}:${index}`,
          content: chunk,
          startChar: content.indexOf(chunk),
          endChar: content.indexOf(chunk) + chunk.length
        }))
      };

      this.index.set(relativePath, fileData);

      // Generate embeddings for chunks (mock implementation)
      for (const chunk of fileData.chunks) {
        const embedding = await this.generateEmbedding(chunk.content);
        this.embeddings.set(chunk.id, embedding);
      }

    } catch (error) {
      console.warn(`Failed to index ${filePath}: ${error.message}`);
    }
  }

  async findIndexableFiles(dir, excludePatterns, files = []) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
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
          if (this.isIndexableFile(entry.name)) {
            files.push(fullPath);
          }
        } else if (entry.isDirectory()) {
          await this.findIndexableFiles(fullPath, excludePatterns, files);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }

    return files;
  }

  isIndexableFile(filename) {
    const indexableExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala',
      '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
      '.json', '.yaml', '.yml', '.xml', '.md', '.txt', '.sql',
      '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
      '.dockerfile', '.gitignore', '.env'
    ];
    
    const ext = path.extname(filename).toLowerCase();
    return indexableExtensions.includes(ext) || !path.extname(filename);
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

  chunkContent(content, options = {}) {
    const maxChunkSize = options.maxChunkSize || 1000;
    const overlap = options.overlap || 100;
    
    if (content.length <= maxChunkSize) {
      return [content];
    }

    const chunks = [];
    let start = 0;
    
    while (start < content.length) {
      const end = Math.min(start + maxChunkSize, content.length);
      let chunk = content.slice(start, end);
      
      // Try to break at word boundaries
      if (end < content.length) {
        const lastSpaceIndex = chunk.lastIndexOf(' ');
        const lastNewlineIndex = chunk.lastIndexOf('\n');
        const breakPoint = Math.max(lastSpaceIndex, lastNewlineIndex);
        
        if (breakPoint > start + maxChunkSize * 0.5) {
          chunk = content.slice(start, start + breakPoint);
        }
      }
      
      chunks.push(chunk.trim());
      start += chunk.length - overlap;
    }
    
    return chunks.filter(chunk => chunk.length > 0);
  }

  async generateEmbedding(text) {
    // Mock embedding generation - in real implementation would use actual embedding model
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const embedding = new Array(384).fill(0);
    
    // Simple hash-based mock embedding
    for (const word of words) {
      const hash = crypto.createHash('md5').update(word).digest();
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] += hash[i % hash.length] / 255;
      }
    }
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }

  async search(query, options = {}) {
    const maxResults = options.maxResults || 20;
    const threshold = options.threshold || 0.5;
    
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Find similar chunks
    const results = [];
    for (const [chunkId, embedding] of this.embeddings) {
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      if (similarity > threshold) {
        // Find the chunk data
        const [filePath, chunkIndex] = chunkId.split(':');
        const fileData = this.index.get(filePath);
        if (fileData && fileData.chunks[parseInt(chunkIndex)]) {
          results.push({
            chunkId,
            filePath,
            chunk: fileData.chunks[parseInt(chunkIndex)],
            similarity,
            language: fileData.language
          });
        }
      }
    }

    // Sort by similarity and limit results
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, maxResults);
  }

  cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  getIndexStatus() {
    return {
      isIndexing: this.isIndexing,
      progress: this.indexProgress,
      totalFiles: this.index.size,
      totalChunks: this.embeddings.size,
      lastUpdated: this.lastUpdated
    };
  }
}

const indexingManager = new IndexingManager();

async function indexCodebase(req, res) {
  try {
    const { workspaceRoot, options } = req.body;
    const root = workspaceRoot || process.cwd();
    
    await indexingManager.initializeIndex();
    const result = await indexingManager.indexCodebase(root, options);
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getIndexStatus(req, res) {
  try {
    const status = indexingManager.getIndexStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function search(req, res) {
  try {
    const { query, options } = req.body;
    
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    await indexingManager.initializeIndex();
    const results = await indexingManager.search(query, options);
    
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  indexCodebase,
  getIndexStatus,
  search,
  indexingManager
};