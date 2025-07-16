import { constructSystemMessage } from './systemMessage.js';

describe('constructSystemMessage', () => {
  it('should return base system message with rules when rulesSystemMessage is provided', () => {
    const rulesMessage = 'These are the rules for the assistant.';
    const result = constructSystemMessage(rulesMessage);
    
    expect(result).toContain('You are an agent in the Continue CLI');
    expect(result).toContain('<context name="userRules">');
    expect(result).toContain(rulesMessage);
    expect(result).toContain('</context>');
  });

  it('should return base system message with agent content when no rules but agent file exists', () => {
    // The implementation checks for agent files like AGENTS.md which exists in this project
    const result = constructSystemMessage('');
    
    expect(result).toContain('You are an agent in the Continue CLI');
    expect(result).toContain('<context name="userRules">');
    expect(result).toContain('AGENTS.md');
  });

  it('should include base system message components', () => {
    const result = constructSystemMessage('');
    
    expect(result).toContain('You are an agent in the Continue CLI');
    expect(result).toContain('<env>');
    expect(result).toContain('<context name="directoryStructure">');
    expect(result).toContain('<context name="gitStatus">');
    expect(result).toContain('Any file paths you return in your final response MUST be absolute');
  });

  it('should handle whitespace-only rules message', () => {
    const result = constructSystemMessage('   ');
    
    expect(result).toContain('You are an agent in the Continue CLI');
    expect(result).toContain('<context name="userRules">');
  });

  it('should include working directory information', () => {
    const result = constructSystemMessage('');
    
    expect(result).toContain('Working directory:');
    expect(result).toContain('<env>');
  });

  it('should include platform information', () => {
    const result = constructSystemMessage('');
    
    expect(result).toContain('Platform:');
  });

  it('should include current date', () => {
    const result = constructSystemMessage('');
    
    expect(result).toContain('Today\'s date:');
    expect(result).toContain(new Date().toISOString().split('T')[0]);
  });

  it('should format rules section correctly', () => {
    const rulesMessage = 'Rule 1: Do this\nRule 2: Do that';
    const result = constructSystemMessage(rulesMessage);
    
    expect(result).toContain('<context name="userRules">');
    expect(result).toContain(rulesMessage);
    expect(result).toContain('</context>');
  });

  it('should handle multiline rules message', () => {
    const rulesMessage = `Rule 1: First rule
Rule 2: Second rule
Rule 3: Third rule`;
    const result = constructSystemMessage(rulesMessage);
    
    expect(result).toContain(rulesMessage);
    expect(result).toContain('<context name="userRules">');
    expect(result).toContain('</context>');
  });

  it('should handle special characters in rules message', () => {
    const rulesMessage = 'Rule with <special> characters & symbols!';
    const result = constructSystemMessage(rulesMessage);
    
    expect(result).toContain(rulesMessage);
    expect(result).toContain('<context name="userRules">');
  });

  it('should handle very long rules message', () => {
    const rulesMessage = 'A'.repeat(1000);
    const result = constructSystemMessage(rulesMessage);
    
    expect(result).toContain(rulesMessage);
    expect(result).toContain('<context name="userRules">');
  });

  it('should combine rules and agent content when both are present', () => {
    const rulesMessage = 'These are the rules.';
    const result = constructSystemMessage(rulesMessage);
    
    expect(result).toContain('<context name="userRules">');
    expect(result).toContain(rulesMessage);
    expect(result).toContain('AGENTS.md');
    expect(result).toContain('</context>');
  });
});