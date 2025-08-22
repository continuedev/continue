const { llmManager } = require('./llm');
const { contextManager } = require('./context');
const { configManager } = require('./config');
const fs = require('fs').promises;

class EditManager {
  constructor() {
    this.editHistory = [];
    this.activeEdits = new Map();
  }

  async apply(params) {
    const {
      filePath,
      instructions,
      selectedCode,
      cursorPosition,
      options = {}
    } = params;

    try {
      // Read current file content
      const currentContent = await fs.readFile(filePath, 'utf8');
      
      // Get context for the edit
      const context = await this.getEditContext(filePath, selectedCode, instructions);
      
      // Get edit model from config
      const config = await configManager.loadConfig();
      const editModel = config.selectedModel; // Could have specific edit model
      
      // Generate the edit
      const edit = await this.generateEdit({
        filePath,
        currentContent,
        instructions,
        selectedCode,
        cursorPosition,
        context,
        model: editModel,
        options
      });

      // Apply the edit
      const newContent = this.applyEditToContent(currentContent, edit, cursorPosition, selectedCode);
      
      // Save the edited file
      if (!options.dryRun) {
        await fs.writeFile(filePath, newContent, 'utf8');
      }

      // Track the edit
      const editId = Date.now().toString();
      this.editHistory.push({
        id: editId,
        timestamp: new Date().toISOString(),
        filePath,
        instructions,
        originalContent: currentContent,
        newContent,
        applied: !options.dryRun,
        diff: this.generateDiff(currentContent, newContent)
      });

      return {
        editId,
        success: true,
        originalContent: currentContent,
        newContent,
        diff: this.generateDiff(currentContent, newContent),
        applied: !options.dryRun
      };

    } catch (error) {
      console.error('Edit apply error:', error);
      throw new Error(`Failed to apply edit: ${error.message}`);
    }
  }

  async generateEdit({ filePath, currentContent, instructions, selectedCode, cursorPosition, context, model, options }) {
    const prompt = this.buildEditPrompt({
      currentContent,
      instructions,
      selectedCode,
      cursorPosition,
      context,
      options
    });

    try {
      const provider = await llmManager.getProvider(model.title || model);
      const response = await provider.chat([
        {
          role: 'system',
          content: this.getEditSystemPrompt()
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: options.temperature || 0.1, // Low temperature for precise edits
        maxTokens: options.maxTokens || 4000,
        stream: false
      });

      let editContent = '';
      if (response.choices && response.choices[0]) {
        editContent = response.choices[0].message.content;
      } else if (response.content) {
        editContent = response.content;
      }

      // Parse the edit from the response
      return this.parseEditResponse(editContent, selectedCode);

    } catch (error) {
      throw new Error(`Edit generation failed: ${error.message}`);
    }
  }

  getEditSystemPrompt() {
    return `You are an expert code editor. Your job is to make precise code changes based on user instructions.

Rules:
1. Only modify the code as requested
2. Preserve existing code style and formatting
3. Ensure syntactic correctness
4. If editing selected code, provide the complete replacement
5. If adding new code, provide exactly what should be inserted
6. Do not include explanations unless asked
7. Maintain proper indentation and spacing

Respond with the modified code only, wrapped in code fences with the appropriate language.`;
  }

  buildEditPrompt({ currentContent, instructions, selectedCode, cursorPosition, context, options }) {
    let prompt = `Instructions: ${instructions}\n\n`;

    if (selectedCode) {
      prompt += `Selected code to modify:\n\`\`\`\n${selectedCode}\n\`\`\`\n\n`;
    }

    prompt += `Current file content:\n\`\`\`\n${currentContent}\n\`\`\`\n\n`;

    if (context.relatedCode) {
      prompt += `Related code for context:\n\`\`\`\n${context.relatedCode.slice(0, 1000)}\n\`\`\`\n\n`;
    }

    if (cursorPosition) {
      prompt += `Cursor position: Line ${cursorPosition.line}, Column ${cursorPosition.column}\n\n`;
    }

    prompt += `Provide the modified code:`;

    return prompt;
  }

  async getEditContext(filePath, selectedCode, instructions) {
    try {
      // Get current file context
      const fileContext = await contextManager.retrieve('currentFile', { filePath });
      
      // Search for related code based on instructions
      const searchQuery = this.extractSearchQuery(instructions, selectedCode);
      const searchResults = await contextManager.retrieve('search', { 
        query: searchQuery,
        path: require('path').dirname(filePath)
      });

      return {
        fileContent: fileContext.data?.content || '',
        relatedCode: searchResults.data?.map(r => r.content).join('\n') || '',
        language: fileContext.data?.language || 'text'
      };
    } catch (error) {
      return {
        fileContent: '',
        relatedCode: '',
        language: 'text'
      };
    }
  }

  extractSearchQuery(instructions, selectedCode) {
    // Extract keywords from instructions and selected code
    const text = `${instructions} ${selectedCode || ''}`;
    const tokens = text.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
    return tokens.slice(0, 10).join(' '); // First 10 tokens
  }

  parseEditResponse(response, selectedCode) {
    // Remove code fence markers
    let editContent = response.replace(/```[a-zA-Z]*\n?/g, '');
    editContent = editContent.replace(/```/g, '');
    editContent = editContent.trim();

    return {
      type: selectedCode ? 'replace' : 'insert',
      content: editContent,
      originalCode: selectedCode
    };
  }

  applyEditToContent(currentContent, edit, cursorPosition, selectedCode) {
    if (edit.type === 'replace' && selectedCode) {
      // Replace selected code
      return currentContent.replace(selectedCode, edit.content);
    } else if (edit.type === 'insert' && cursorPosition) {
      // Insert at cursor position
      const lines = currentContent.split('\n');
      const lineIndex = cursorPosition.line - 1;
      const columnIndex = cursorPosition.column;
      
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        const newLine = line.slice(0, columnIndex) + edit.content + line.slice(columnIndex);
        lines[lineIndex] = newLine;
        return lines.join('\n');
      }
    }
    
    // Fallback: append to end
    return currentContent + '\n' + edit.content;
  }

  async generateDiff(originalContent, newContent) {
    const originalLines = originalContent.split('\n');
    const newLines = newContent.split('\n');
    
    // Simple line-by-line diff
    const diff = [];
    const maxLines = Math.max(originalLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i] || '';
      const newLine = newLines[i] || '';
      
      if (originalLine !== newLine) {
        if (originalLine && !newLine) {
          diff.push(`-${i + 1}: ${originalLine}`);
        } else if (!originalLine && newLine) {
          diff.push(`+${i + 1}: ${newLine}`);
        } else {
          diff.push(`-${i + 1}: ${originalLine}`);
          diff.push(`+${i + 1}: ${newLine}`);
        }
      }
    }
    
    return diff;
  }

  async streamEdit(params) {
    // For streaming edits - would implement WebSocket or Server-Sent Events
    const editId = Date.now().toString();
    
    // Mark as active edit
    this.activeEdits.set(editId, {
      status: 'in_progress',
      progress: 0,
      params
    });

    try {
      // Simulate streaming by breaking edit into steps
      const steps = [
        { step: 'analyzing', progress: 20 },
        { step: 'generating', progress: 60 },
        { step: 'applying', progress: 90 },
        { step: 'complete', progress: 100 }
      ];

      for (const step of steps) {
        this.activeEdits.set(editId, {
          ...this.activeEdits.get(editId),
          ...step
        });
        
        // In real implementation, would emit to connected clients
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Apply the actual edit
      const result = await this.apply(params);
      
      this.activeEdits.delete(editId);
      return { editId, ...result };

    } catch (error) {
      this.activeEdits.set(editId, {
        ...this.activeEdits.get(editId),
        status: 'error',
        error: error.message
      });
      throw error;
    }
  }

  getEditHistory(limit = 10) {
    return this.editHistory.slice(-limit).reverse();
  }

  getActiveEdits() {
    return Array.from(this.activeEdits.entries()).map(([id, edit]) => ({
      id,
      ...edit
    }));
  }
}

const editManager = new EditManager();

async function apply(req, res) {
  try {
    const result = await editManager.apply(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function generateDiff(req, res) {
  try {
    const { originalContent, newContent } = req.body;
    const diff = await editManager.generateDiff(originalContent, newContent);
    res.json({ success: true, data: { diff } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function streamEdit(req, res) {
  try {
    const result = await editManager.streamEdit(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  apply,
  generateDiff,
  streamEdit,
  editManager
};