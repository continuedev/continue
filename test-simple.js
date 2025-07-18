// Simple test to verify our fixes work
const { readFileSync } = require('fs');
const { join } = require('path');

function testProvider(providerName, fileName) {
    try {
        // Read the provider file
        const providerContent = readFileSync(join(__dirname, `core/llm/llms/${fileName}.ts`), 'utf8');
        
        // Extract the apiBase from the provider
        const apiBaseMatch = providerContent.match(/apiBase:\s*"([^"]+)"/);
        const actualApiBase = apiBaseMatch ? apiBaseMatch[1] : null;
        
        // Read the test file
        const testContent = readFileSync(join(__dirname, 'core/llm/llms/OpenAI-compatible.vitest.ts'), 'utf8');
        
        // Extract the expected apiBase from the test
        const testApiBaseMatch = testContent.match(new RegExp(`createOpenAISubclassTests\\(${fileName},\\s*\\{[^}]*defaultApiBase:\\s*"([^"]+)"`, 's'));
        const expectedApiBase = testApiBaseMatch ? testApiBaseMatch[1] : null;
        
        console.log(`${providerName} Provider:`);
        console.log('  Actual apiBase:', actualApiBase);
        console.log('  Expected apiBase:', expectedApiBase);
        console.log('  Match:', actualApiBase === expectedApiBase);
        console.log('');
        
        return actualApiBase === expectedApiBase;
    } catch (error) {
        console.log(`${providerName} Provider: Error -`, error.message);
        console.log('');
        return false;
    }
}

// Test specific providers
const providers = [
    ['Fireworks', 'Fireworks'],
    ['Docker', 'Docker'],
    ['Kindo', 'Kindo'],
    ['Inception', 'Inception'],
    ['Venice', 'Venice'],
    ['NCompass', 'NCompass'],
    ['OVHcloud', 'OVHcloud']
];

let allMatches = true;
for (const [displayName, fileName] of providers) {
    const matches = testProvider(displayName, fileName);
    allMatches = allMatches && matches;
}

console.log('All provider URLs match:', allMatches);