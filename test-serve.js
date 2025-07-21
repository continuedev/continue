// Test script to verify the serve command sends proper message format
import fetch from 'node-fetch';

async function testServe() {
  const port = 8001;
  const url = `http://localhost:${port}`;
  
  console.log('Testing serve command message format...\n');
  
  try {
    // Send a message
    console.log('Sending message to trigger tool use...');
    const messageRes = await fetch(`${url}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Read the README.md file' })
    });
    
    if (!messageRes.ok) {
      throw new Error(`Failed to send message: ${messageRes.status}`);
    }
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get the state
    console.log('\nFetching state...');
    const stateRes = await fetch(`${url}/state`);
    const state = await stateRes.json();
    
    console.log('\nMessages in chatHistory:');
    state.chatHistory.forEach((msg, i) => {
      console.log(`\n[${i}] Role: ${msg.role}`);
      console.log(`    Content: ${msg.content}`);
      if (msg.messageType) {
        console.log(`    MessageType: ${msg.messageType}`);
      }
      if (msg.toolName) {
        console.log(`    ToolName: ${msg.toolName}`);
      }
      if (msg.toolResult) {
        console.log(`    ToolResult: ${msg.toolResult.substring(0, 50)}...`);
      }
    });
    
    // Check if tool messages have proper format
    const toolMessages = state.chatHistory.filter(msg => msg.messageType);
    if (toolMessages.length > 0) {
      console.log('\n✅ Tool messages found with proper messageType fields!');
    } else {
      console.log('\n❌ No tool messages found with messageType fields');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the test
console.log('Start the serve command first with: cn serve --port 8001');
console.log('Then press Enter to run the test...');

process.stdin.once('data', () => {
  testServe().then(() => {
    console.log('\nTest complete!');
    process.exit(0);
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
});