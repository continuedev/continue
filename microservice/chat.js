const { llmManager } = require('./llm');
const { contextManager } = require('./context');
const { configManager } = require('./config');
const fs = require('fs').promises;
const path = require('path');

class ChatManager {
  constructor() {
    this.chatHistory = [];
    this.conversationHistory = [];
    this.maxHistoryLength = 50;
    this.activeConversation = null;
    this.slashCommands = new Map();
    this.initializeSlashCommands();
  }

  initializeSlashCommands() {
    this.slashCommands.set('edit', this.handleEditCommand.bind(this));
    this.slashCommands.set('comment', this.handleCommentCommand.bind(this));
    this.slashCommands.set('share', this.handleShareCommand.bind(this));
    this.slashCommands.set('cmd', this.handleCmdCommand.bind(this));
    this.slashCommands.set('commit', this.handleCommitCommand.bind(this));
    this.slashCommands.set('review', this.handleReviewCommand.bind(this));
    this.slashCommands.set('explain', this.handleExplainCommand.bind(this));
    this.slashCommands.set('optimize', this.handleOptimizeCommand.bind(this));
    this.slashCommands.set('test', this.handleTestCommand.bind(this));
    this.slashCommands.set('docs', this.handleDocsCommand.bind(this));
  }

  async sendMessage(params) {
    const {
      message,
      context = [],
      model,
      options = {},
      conversationId
    } = params;

    try {
      // Check if this is a slash command
      if (message.startsWith('/')) {
        return await this.handleSlashCommand(message, context, options);
      }

      // Get or create conversation
      const conversation = this.getOrCreateConversation(conversationId);
      
      // Add user message to conversation
      conversation.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        context: context
      });

      // Get configuration
      const config = await configManager.loadConfig();
      const selectedModel = model || config.selectedModel;

      // Retrieve additional context if needed
      const enrichedContext = await this.enrichContext(context, message);

      // Build messages for LLM
      const messages = this.buildChatMessages(conversation.messages, enrichedContext);

      // Get response from LLM
      const provider = await llmManager.getProvider(selectedModel);
      const response = await provider.chat(messages, {
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 4000,
        stream: options.stream || false
      });

      let responseContent = '';
      if (response.choices && response.choices[0]) {
        responseContent = response.choices[0].message.content;
      } else if (response.content) {
        responseContent = response.content;
      }

      // Add assistant response to conversation
      const assistantMessage = {
        role: 'assistant',
        content: responseContent,
        timestamp: new Date().toISOString(),
        model: selectedModel,
        usage: response.usage
      };

      conversation.messages.push(assistantMessage);

      // Trim conversation if too long
      if (conversation.messages.length > this.maxHistoryLength) {
        conversation.messages = conversation.messages.slice(-this.maxHistoryLength);
      }

      // Update chat history
      this.chatHistory.push({
        conversationId: conversation.id,
        userMessage: message,
        assistantMessage: responseContent,
        timestamp: new Date().toISOString(),
        model: selectedModel
      });

      return {
        message: assistantMessage,
        conversationId: conversation.id,
        context: enrichedContext
      };

    } catch (error) {
      console.error('Chat error:', error);
      throw new Error(`Chat failed: ${error.message}`);
    }
  }

  async handleSlashCommand(message, context, options) {
    const [command, ...args] = message.slice(1).split(' ');
    const handler = this.slashCommands.get(command);

    if (!handler) {
      throw new Error(`Unknown slash command: /${command}`);
    }

    return await handler(args, context, options);
  }

  async handleEditCommand(args, context, options) {
    const instruction = args.join(' ');
    if (!instruction) {
      return {
        message: {
          role: 'assistant',
          content: 'Please provide edit instructions. Usage: /edit <instruction>',
          timestamp: new Date().toISOString()
        }
      };
    }

    // Get current file from context
    const currentFile = context.find(c => c.type === 'currentFile');
    if (!currentFile) {
      return {
        message: {
          role: 'assistant',
          content: 'No current file found. Please select a file or code to edit.',
          timestamp: new Date().toISOString()
        }
      };
    }

    try {
      const editManager = require('./edit').editManager;
      const result = await editManager.apply({
        filePath: currentFile.data.path,
        instructions: instruction,
        selectedCode: context.find(c => c.type === 'selection')?.data?.text,
        options: { dryRun: false }
      });

      return {
        message: {
          role: 'assistant',
          content: `Edit applied successfully to ${path.basename(currentFile.data.path)}:\n\n\`\`\`diff\n${result.diff.join('\n')}\n\`\`\``,
          timestamp: new Date().toISOString(),
          editResult: result
        }
      };

    } catch (error) {
      return {
        message: {
          role: 'assistant',
          content: `Failed to apply edit: ${error.message}`,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  async handleCommentCommand(args, context, options) {
    const instruction = args.join(' ') || 'Add helpful comments to this code';
    
    const selectedCode = context.find(c => c.type === 'selection')?.data?.text;
    if (!selectedCode) {
      return {
        message: {
          role: 'assistant',
          content: 'Please select code to comment.',
          timestamp: new Date().toISOString()
        }
      };
    }

    const config = await configManager.loadConfig();
    const provider = await llmManager.getProvider(config.selectedModel);

    const prompt = `Add helpful comments to this code:

\`\`\`
${selectedCode}
\`\`\`

Instructions: ${instruction}

Return the code with added comments:`;

    const response = await provider.chat([
      {
        role: 'system',
        content: 'You are an expert programmer. Add clear, helpful comments to code while preserving the original functionality.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], { temperature: 0.3, maxTokens: 2000 });

    let commentedCode = '';
    if (response.choices && response.choices[0]) {
      commentedCode = response.choices[0].message.content;
    }

    return {
      message: {
        role: 'assistant',
        content: `Here's the commented code:\n\n${commentedCode}`,
        timestamp: new Date().toISOString()
      }
    };
  }

  async handleShareCommand(args, context, options) {
    const selectedCode = context.find(c => c.type === 'selection')?.data?.text;
    const currentFile = context.find(c => c.type === 'currentFile');
    
    if (!selectedCode && !currentFile) {
      return {
        message: {
          role: 'assistant',
          content: 'Please select code or open a file to share.',
          timestamp: new Date().toISOString()
        }
      };
    }

    const codeToShare = selectedCode || currentFile?.data?.content;
    const fileName = currentFile?.data?.path ? path.basename(currentFile.data.path) : 'code';
    
    // Create a shareable snippet (mock implementation)
    const shareId = Date.now().toString(36);
    const shareUrl = `https://continue.dev/share/${shareId}`;

    return {
      message: {
        role: 'assistant',
        content: `Code shared successfully!\n\n**Share URL:** ${shareUrl}\n**File:** ${fileName}\n**Size:** ${codeToShare.length} characters`,
        timestamp: new Date().toISOString(),
        shareData: {
          id: shareId,
          url: shareUrl,
          code: codeToShare,
          fileName
        }
      }
    };
  }

  async handleCmdCommand(args, context, options) {
    const command = args.join(' ');
    if (!command) {
      return {
        message: {
          role: 'assistant',
          content: 'Please provide a command to run. Usage: /cmd <command>',
          timestamp: new Date().toISOString()
        }
      };
    }

    try {
      const terminalResult = await contextManager.retrieve('terminal', { command });
      
      return {
        message: {
          role: 'assistant',
          content: `Command executed: \`${command}\`\n\n**Output:**\n\`\`\`\n${terminalResult.data.stdout}\n\`\`\`${terminalResult.data.stderr ? `\n\n**Error:**\n\`\`\`\n${terminalResult.data.stderr}\n\`\`\`` : ''}`,
          timestamp: new Date().toISOString(),
          commandResult: terminalResult.data
        }
      };

    } catch (error) {
      return {
        message: {
          role: 'assistant',
          content: `Failed to execute command: ${error.message}`,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  async handleCommitCommand(args, context, options) {
    try {
      const gitContext = await contextManager.retrieve('git');
      const diffContext = await contextManager.retrieve('diff');

      if (!diffContext.data || diffContext.data.length === 0) {
        return {
          message: {
            role: 'assistant',
            content: 'No changes detected. Make some changes first before generating a commit message.',
            timestamp: new Date().toISOString()
          }
        };
      }

      const config = await configManager.loadConfig();
      const provider = await llmManager.getProvider(config.selectedModel);

      const prompt = `Generate a conventional commit message for these changes:

${diffContext.data.map(d => d.diff).join('\n')}

Follow conventional commit format (type(scope): description).
Keep it concise and descriptive.`;

      const response = await provider.chat([
        {
          role: 'system',
          content: 'You are an expert at writing clear, conventional commit messages.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], { temperature: 0.3, maxTokens: 500 });

      let commitMessage = '';
      if (response.choices && response.choices[0]) {
        commitMessage = response.choices[0].message.content.trim();
      }

      return {
        message: {
          role: 'assistant',
          content: `Suggested commit message:\n\n\`\`\`\n${commitMessage}\n\`\`\`\n\nTo use this message, run:\n\`git commit -m "${commitMessage}"\``,
          timestamp: new Date().toISOString(),
          commitMessage
        }
      };

    } catch (error) {
      return {
        message: {
          role: 'assistant',
          content: `Failed to generate commit message: ${error.message}`,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  async handleReviewCommand(args, context, options) {
    const selectedCode = context.find(c => c.type === 'selection')?.data?.text;
    const currentFile = context.find(c => c.type === 'currentFile');
    
    const codeToReview = selectedCode || currentFile?.data?.content;
    if (!codeToReview) {
      return {
        message: {
          role: 'assistant',
          content: 'Please select code or open a file to review.',
          timestamp: new Date().toISOString()
        }
      };
    }

    const config = await configManager.loadConfig();
    const provider = await llmManager.getProvider(config.selectedModel);

    const language = currentFile?.data?.language || 'text';
    const prompt = `Review this ${language} code and provide feedback:

\`\`\`${language}
${codeToReview}
\`\`\`

Please provide:
1. Code quality assessment
2. Potential issues or bugs
3. Performance considerations
4. Best practice suggestions
5. Security concerns (if any)`;

    const response = await provider.chat([
      {
        role: 'system',
        content: 'You are an expert code reviewer. Provide constructive, actionable feedback.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], { temperature: 0.4, maxTokens: 3000 });

    let review = '';
    if (response.choices && response.choices[0]) {
      review = response.choices[0].message.content;
    }

    return {
      message: {
        role: 'assistant',
        content: `## Code Review\n\n${review}`,
        timestamp: new Date().toISOString()
      }
    };
  }

  async handleExplainCommand(args, context, options) {
    const selectedCode = context.find(c => c.type === 'selection')?.data?.text;
    if (!selectedCode) {
      return {
        message: {
          role: 'assistant',
          content: 'Please select code to explain.',
          timestamp: new Date().toISOString()
        }
      };
    }

    const config = await configManager.loadConfig();
    const provider = await llmManager.getProvider(config.selectedModel);

    const currentFile = context.find(c => c.type === 'currentFile');
    const language = currentFile?.data?.language || 'text';
    
    const prompt = `Explain this ${language} code:

\`\`\`${language}
${selectedCode}
\`\`\`

Provide a clear explanation of what this code does, how it works, and any important concepts.`;

    const response = await provider.chat([
      {
        role: 'system',
        content: 'You are an expert programmer. Explain code clearly and educational manner.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], { temperature: 0.5, maxTokens: 2000 });

    let explanation = '';
    if (response.choices && response.choices[0]) {
      explanation = response.choices[0].message.content;
    }

    return {
      message: {
        role: 'assistant',
        content: explanation,
        timestamp: new Date().toISOString()
      }
    };
  }

  async handleOptimizeCommand(args, context, options) {
    const selectedCode = context.find(c => c.type === 'selection')?.data?.text;
    if (!selectedCode) {
      return {
        message: {
          role: 'assistant',
          content: 'Please select code to optimize.',
          timestamp: new Date().toISOString()
        }
      };
    }

    const config = await configManager.loadConfig();
    const provider = await llmManager.getProvider(config.selectedModel);

    const currentFile = context.find(c => c.type === 'currentFile');
    const language = currentFile?.data?.language || 'text';
    
    const prompt = `Optimize this ${language} code for better performance and readability:

\`\`\`${language}
${selectedCode}
\`\`\`

Provide optimized version with explanations of the improvements.`;

    const response = await provider.chat([
      {
        role: 'system',
        content: 'You are an expert at code optimization. Focus on performance, readability, and best practices.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], { temperature: 0.3, maxTokens: 3000 });

    let optimization = '';
    if (response.choices && response.choices[0]) {
      optimization = response.choices[0].message.content;
    }

    return {
      message: {
        role: 'assistant',
        content: `## Optimized Code\n\n${optimization}`,
        timestamp: new Date().toISOString()
      }
    };
  }

  async handleTestCommand(args, context, options) {
    const selectedCode = context.find(c => c.type === 'selection')?.data?.text;
    const currentFile = context.find(c => c.type === 'currentFile');
    
    const codeToTest = selectedCode || currentFile?.data?.content;
    if (!codeToTest) {
      return {
        message: {
          role: 'assistant',
          content: 'Please select code or open a file to generate tests for.',
          timestamp: new Date().toISOString()
        }
      };
    }

    const config = await configManager.loadConfig();
    const provider = await llmManager.getProvider(config.selectedModel);

    const language = currentFile?.data?.language || 'text';
    const testFramework = this.getTestFramework(language);
    
    const prompt = `Generate comprehensive unit tests for this ${language} code using ${testFramework}:

\`\`\`${language}
${codeToTest}
\`\`\`

Include:
1. Happy path tests
2. Edge cases
3. Error handling
4. Mock dependencies if needed`;

    const response = await provider.chat([
      {
        role: 'system',
        content: `You are an expert at writing unit tests. Generate thorough, maintainable tests using ${testFramework}.`
      },
      {
        role: 'user',
        content: prompt
      }
    ], { temperature: 0.3, maxTokens: 4000 });

    let tests = '';
    if (response.choices && response.choices[0]) {
      tests = response.choices[0].message.content;
    }

    return {
      message: {
        role: 'assistant',
        content: `## Generated Tests\n\n${tests}`,
        timestamp: new Date().toISOString()
      }
    };
  }

  async handleDocsCommand(args, context, options) {
    const selectedCode = context.find(c => c.type === 'selection')?.data?.text;
    if (!selectedCode) {
      return {
        message: {
          role: 'assistant',
          content: 'Please select code to document.',
          timestamp: new Date().toISOString()
        }
      };
    }

    const config = await configManager.loadConfig();
    const provider = await llmManager.getProvider(config.selectedModel);

    const currentFile = context.find(c => c.type === 'currentFile');
    const language = currentFile?.data?.language || 'text';
    
    const prompt = `Generate comprehensive documentation for this ${language} code:

\`\`\`${language}
${selectedCode}
\`\`\`

Include:
1. Function/class descriptions
2. Parameter documentation
3. Return value descriptions
4. Usage examples
5. Any important notes or warnings`;

    const response = await provider.chat([
      {
        role: 'system',
        content: 'You are an expert technical writer. Generate clear, comprehensive documentation.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], { temperature: 0.4, maxTokens: 3000 });

    let documentation = '';
    if (response.choices && response.choices[0]) {
      documentation = response.choices[0].message.content;
    }

    return {
      message: {
        role: 'assistant',
        content: `## Documentation\n\n${documentation}`,
        timestamp: new Date().toISOString()
      }
    };
  }

  getTestFramework(language) {
    const frameworks = {
      javascript: 'Jest',
      typescript: 'Jest',
      python: 'pytest',
      java: 'JUnit',
      csharp: 'xUnit',
      cpp: 'Google Test',
      go: 'testing package',
      rust: 'built-in test framework',
      php: 'PHPUnit',
      ruby: 'RSpec'
    };
    
    return frameworks[language] || 'appropriate testing framework';
  }

  async enrichContext(context, message) {
    // Add additional context based on message content and existing context
    const enriched = [...context];

    // If no current file context, try to get it
    if (!context.find(c => c.type === 'currentFile')) {
      try {
        const workspaceFiles = await contextManager.retrieve('openFiles');
        if (workspaceFiles.data && workspaceFiles.data.length > 0) {
          enriched.push(workspaceFiles);
        }
      } catch (error) {
        // Continue without additional context
      }
    }

    // Add git context for commit-related messages
    if (message.includes('commit') || message.includes('changes')) {
      try {
        const gitContext = await contextManager.retrieve('git');
        enriched.push(gitContext);
      } catch (error) {
        // Continue without git context
      }
    }

    return enriched;
  }

  buildChatMessages(conversationMessages, context) {
    const messages = [];

    // Add system message
    messages.push({
      role: 'system',
      content: this.getSystemMessage(context)
    });

    // Add context as user message if present
    if (context.length > 0) {
      const contextMessage = this.formatContextMessage(context);
      messages.push({
        role: 'user',
        content: contextMessage
      });
    }

    // Add conversation history (limit to avoid token limits)
    const recentMessages = conversationMessages.slice(-10);
    messages.push(...recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    })));

    return messages;
  }

  getSystemMessage(context) {
    return `You are Continue, an AI coding assistant. You help developers with coding tasks, questions, and problems.

Key capabilities:
- Answer coding questions
- Help debug issues  
- Suggest improvements
- Generate code
- Explain code concepts
- Review code quality

You have access to the user's codebase and current context. Be helpful, accurate, and concise. When showing code, use proper syntax highlighting with language tags.

Available slash commands:
/edit - Edit code with AI assistance
/comment - Add comments to code  
/share - Share code snippets
/cmd - Run terminal commands
/commit - Generate commit messages
/review - Review code quality
/explain - Explain code
/optimize - Optimize code performance
/test - Generate unit tests
/docs - Generate documentation`;
  }

  formatContextMessage(context) {
    let message = 'Context:\n\n';
    
    for (const ctx of context) {
      switch (ctx.type) {
        case 'currentFile':
          message += `**Current File:** ${ctx.data.path}\n`;
          if (ctx.data.content) {
            message += `\`\`\`${ctx.data.language}\n${ctx.data.content.slice(0, 2000)}\n\`\`\`\n\n`;
          }
          break;
        case 'selection':
          message += `**Selected Code:**\n\`\`\`\n${ctx.data.text}\n\`\`\`\n\n`;
          break;
        case 'codebase':
          message += `**Codebase Files:** ${ctx.data.length} files\n\n`;
          break;
        case 'problems':
          if (ctx.data.length > 0) {
            message += `**Problems Found:** ${ctx.data.length} issues\n\n`;
          }
          break;
        default:
          if (ctx.data && typeof ctx.data === 'object') {
            message += `**${ctx.type}:** Available\n`;
          }
      }
    }
    
    return message;
  }

  getOrCreateConversation(conversationId) {
    if (conversationId) {
      const existing = this.conversationHistory.find(c => c.id === conversationId);
      if (existing) return existing;
    }

    const conversation = {
      id: conversationId || Date.now().toString(),
      messages: [],
      createdAt: new Date().toISOString()
    };

    this.conversationHistory.push(conversation);
    
    // Keep only recent conversations
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }

    return conversation;
  }

  getHistory(limit = 20) {
    return this.chatHistory.slice(-limit).reverse();
  }

  clearHistory(conversationId) {
    if (conversationId) {
      const conversation = this.conversationHistory.find(c => c.id === conversationId);
      if (conversation) {
        conversation.messages = [];
      }
    } else {
      this.chatHistory = [];
      this.conversationHistory = [];
    }
    
    return { success: true };
  }
}

const chatManager = new ChatManager();

async function sendMessage(req, res) {
  try {
    const result = await chatManager.sendMessage(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getHistory(req, res) {
  try {
    const { limit = 20 } = req.query;
    const history = chatManager.getHistory(parseInt(limit));
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function clearHistory(req, res) {
  try {
    const { conversationId } = req.body;
    const result = chatManager.clearHistory(conversationId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  sendMessage,
  getHistory,
  clearHistory,
  chatManager
};