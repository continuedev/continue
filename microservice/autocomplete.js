const { llmManager } = require('./llm');
const { contextManager } = require('./context');
const { configManager } = require('./config');

class AutocompleteManager {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 1000;
    this.completionHistory = [];
    this.acceptedCompletions = 0;
    this.rejectedCompletions = 0;
  }

  async complete(params) {
    const {
      filePath,
      language,
      prefix,
      suffix,
      cursorPosition,
      options = {}
    } = params;

    // Check cache first
    const cacheKey = this.createCacheKey(prefix, suffix, language);
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30000) { // 30 second cache
        return cached.completion;
      }
    }

    try {
      // Get context for better completions
      const context = await this.getAutocompleteContext(filePath, prefix, suffix);
      
      // Get completion model from config
      const config = await configManager.loadConfig();
      const completionModel = config.tabAutocompleteModel || config.selectedModel;
      
      // Generate completion
      const completion = await this.generateCompletion({
        prefix,
        suffix,
        language,
        context,
        model: completionModel,
        options
      });

      // Cache the result
      this.addToCache(cacheKey, completion);
      
      // Track the completion
      this.completionHistory.push({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        prefix: prefix.slice(-100), // Store last 100 chars for analysis
        suffix: suffix.slice(0, 100), // Store first 100 chars for analysis
        completion: completion.text,
        language,
        filePath,
        status: 'pending'
      });

      return completion;

    } catch (error) {
      console.error('Autocomplete error:', error);
      throw new Error(`Autocomplete failed: ${error.message}`);
    }
  }

  async generateCompletion({ prefix, suffix, language, context, model, options }) {
    const prompt = this.buildCompletionPrompt({
      prefix,
      suffix,
      language,
      context,
      options
    });

    try {
      const provider = await llmManager.getProvider(model.title || model);
      const response = await provider.chat([
        {
          role: 'system',
          content: this.getSystemPrompt(language)
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: options.temperature || 0.2,
        maxTokens: options.maxTokens || 500,
        stream: false
      });

      let completionText = '';
      if (response.choices && response.choices[0]) {
        completionText = response.choices[0].message.content;
      } else if (response.content) {
        completionText = response.content;
      }

      // Clean and validate completion
      const cleanedCompletion = this.cleanCompletion(completionText, prefix, suffix);

      return {
        text: cleanedCompletion,
        range: {
          start: prefix.length,
          end: prefix.length
        },
        displayText: cleanedCompletion.split('\n')[0], // Show first line for inline
        multiline: cleanedCompletion.includes('\n'),
        language,
        confidence: this.calculateConfidence(cleanedCompletion, context)
      };

    } catch (error) {
      throw new Error(`Completion generation failed: ${error.message}`);
    }
  }

  getSystemPrompt(language) {
    const langPrompts = {
      javascript: 'You are an expert JavaScript developer. Provide code completions that are syntactically correct, follow best practices, and match the existing code style.',
      typescript: 'You are an expert TypeScript developer. Provide code completions with proper typing, following TypeScript best practices and the existing code patterns.',
      python: 'You are an expert Python developer. Provide code completions that follow PEP 8 style guidelines and Python best practices.',
      java: 'You are an expert Java developer. Provide code completions that follow Java conventions and best practices.',
      cpp: 'You are an expert C++ developer. Provide code completions that follow modern C++ standards and best practices.',
      csharp: 'You are an expert C# developer. Provide code completions that follow C# coding conventions and .NET best practices.',
      go: 'You are an expert Go developer. Provide code completions that follow Go conventions and idiomatic patterns.',
      rust: 'You are an expert Rust developer. Provide code completions that are memory-safe and follow Rust conventions.',
      php: 'You are an expert PHP developer. Provide code completions that follow PSR standards and PHP best practices.',
      ruby: 'You are an expert Ruby developer. Provide code completions that follow Ruby style guide and conventions.'
    };

    return langPrompts[language] || `You are an expert ${language} developer. Provide accurate and helpful code completions.`;
  }

  buildCompletionPrompt({ prefix, suffix, language, context, options }) {
    let prompt = `Complete the ${language} code. Only return the completion, no explanations.

Context from similar code:
${context.similarCode.slice(0, 1000)}

Current file context:
${context.fileContext.slice(0, 2000)}

Code before cursor:
\`\`\`${language}
${prefix.slice(-500)} // Complete here
\`\`\`

Code after cursor:
\`\`\`${language}
${suffix.slice(0, 200)}
\`\`\`

Completion:`;

    return prompt;
  }

  async getAutocompleteContext(filePath, prefix, suffix) {
    try {
      // Get file context
      const fileContext = await contextManager.retrieve('currentFile', { filePath });
      
      // Get similar code from codebase
      const searchQuery = this.extractSearchQuery(prefix);
      const searchResults = await contextManager.retrieve('search', { 
        query: searchQuery,
        path: require('path').dirname(filePath)
      });

      return {
        fileContext: fileContext.data?.content || '',
        similarCode: searchResults.data?.map(r => r.content).join('\n') || '',
        language: fileContext.data?.language || 'text'
      };
    } catch (error) {
      return {
        fileContext: '',
        similarCode: '',
        language: 'text'
      };
    }
  }

  extractSearchQuery(prefix) {
    // Extract function names, variable names, keywords for search
    const lines = prefix.split('\n').slice(-5); // Last 5 lines
    const tokens = lines.join(' ').match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
    return tokens.slice(-10).join(' '); // Last 10 tokens
  }

  cleanCompletion(completion, prefix, suffix) {
    // Remove code fence markers
    completion = completion.replace(/```[a-zA-Z]*\n?/g, '');
    completion = completion.replace(/```/g, '');
    
    // Remove explanatory text
    const lines = completion.split('\n');
    const codeLines = [];
    
    for (const line of lines) {
      // Skip lines that look like explanations
      if (line.trim().startsWith('//') && line.toLowerCase().includes('explanation')) break;
      if (line.trim().startsWith('#') && line.toLowerCase().includes('explanation')) break;
      if (line.trim().startsWith('/*') && line.toLowerCase().includes('explanation')) break;
      
      codeLines.push(line);
    }
    
    completion = codeLines.join('\n').trim();
    
    // Ensure it doesn't duplicate prefix or suffix
    if (prefix.endsWith(completion.slice(0, 20))) {
      completion = completion.slice(20);
    }
    
    if (suffix.startsWith(completion.slice(-20))) {
      completion = completion.slice(0, -20);
    }
    
    return completion;
  }

  calculateConfidence(completion, context) {
    let confidence = 0.5; // Base confidence
    
    // Boost confidence based on completion characteristics
    if (completion.length > 0) confidence += 0.1;
    if (completion.includes('(') && completion.includes(')')) confidence += 0.1; // Function calls
    if (completion.match(/\b(if|for|while|function|class|def|const|let|var)\b/)) confidence += 0.1; // Keywords
    if (context.similarCode.length > 100) confidence += 0.1; // Good context
    if (!completion.includes('TODO') && !completion.includes('FIXME')) confidence += 0.1; // Not placeholder
    
    // Reduce confidence for suspicious completions
    if (completion.includes('???')) confidence -= 0.2;
    if (completion.length > 1000) confidence -= 0.2; // Too long
    if (completion.split('\n').length > 20) confidence -= 0.1; // Too many lines
    
    return Math.max(0, Math.min(1, confidence));
  }

  createCacheKey(prefix, suffix, language) {
    const crypto = require('crypto');
    const content = `${prefix.slice(-200)}|${suffix.slice(0, 200)}|${language}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  addToCache(key, completion) {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      completion,
      timestamp: Date.now()
    });
  }

  async accept(completionId) {
    const completion = this.completionHistory.find(c => c.id === completionId);
    if (completion) {
      completion.status = 'accepted';
      this.acceptedCompletions++;
    }
    
    return {
      success: true,
      stats: this.getStats()
    };
  }

  async reject(completionId, reason) {
    const completion = this.completionHistory.find(c => c.id === completionId);
    if (completion) {
      completion.status = 'rejected';
      completion.rejectionReason = reason;
      this.rejectedCompletions++;
    }
    
    return {
      success: true,
      stats: this.getStats()
    };
  }

  getStats() {
    const total = this.acceptedCompletions + this.rejectedCompletions;
    return {
      total: this.completionHistory.length,
      accepted: this.acceptedCompletions,
      rejected: this.rejectedCompletions,
      acceptanceRate: total > 0 ? (this.acceptedCompletions / total) : 0,
      cacheSize: this.cache.size,
      recentCompletions: this.completionHistory.slice(-10)
    };
  }
}

const autocompleteManager = new AutocompleteManager();

async function complete(req, res) {
  try {
    const completion = await autocompleteManager.complete(req.body);
    res.json({ success: true, data: completion });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function accept(req, res) {
  try {
    const { completionId } = req.body;
    const result = await autocompleteManager.accept(completionId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function reject(req, res) {
  try {
    const { completionId, reason } = req.body;
    const result = await autocompleteManager.reject(completionId, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  complete,
  accept,
  reject,
  autocompleteManager
};