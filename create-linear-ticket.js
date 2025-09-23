#!/usr/bin/env node

// Simple script to create a Linear ticket using MCP
const { spawn } = require('child_process');

async function createLinearTicket() {
  console.log('Creating Linear ticket: "create test ticket"');
  
  // Check if Linear API key is set
  if (!process.env.LINEAR_API_KEY) {
    console.error('ERROR: LINEAR_API_KEY environment variable is not set.');
    console.error('Please set your Linear API key:');
    console.error('export LINEAR_API_KEY="your_linear_api_key_here"');
    process.exit(1);
  }

  try {
    // Try to use Linear MCP server
    console.log('Attempting to connect to Linear MCP server...');
    
    const mcpProcess = spawn('npx', ['@linear/mcp-server'], {
      env: { 
        ...process.env, 
        LINEAR_API_KEY: process.env.LINEAR_API_KEY 
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let error = '';

    mcpProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    mcpProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    mcpProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('MCP server failed:', error);
        console.log('Falling back to direct API call...');
        createTicketDirectly();
      } else {
        console.log('MCP server output:', output);
      }
    });

    // Send create ticket request
    const createTicketRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'create_issue',
        arguments: {
          title: 'create test ticket',
          description: 'This is a test ticket created via Linear MCP',
        }
      }
    };

    mcpProcess.stdin.write(JSON.stringify(createTicketRequest) + '\n');
    mcpProcess.stdin.end();

  } catch (error) {
    console.error('Error creating Linear ticket via MCP:', error);
    console.log('Falling back to direct API call...');
    createTicketDirectly();
  }
}

async function createTicketDirectly() {
  console.log('Creating Linear ticket using direct API call...');
  
  if (!process.env.LINEAR_API_KEY) {
    console.error('LINEAR_API_KEY is required for direct API calls');
    process.exit(1);
  }

  try {
    const fetch = require('node-fetch').default || require('node-fetch');
    
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.LINEAR_API_KEY
      },
      body: JSON.stringify({
        query: `
          mutation CreateIssue($title: String!, $description: String) {
            issueCreate(input: {
              title: $title
              description: $description
            }) {
              success
              issue {
                id
                title
                url
              }
            }
          }
        `,
        variables: {
          title: 'create test ticket',
          description: 'This is a test ticket created via Linear API'
        }
      })
    });

    const result = await response.json();
    
    if (result.data?.issueCreate?.success) {
      console.log('✅ Linear ticket created successfully!');
      console.log('Title:', result.data.issueCreate.issue.title);
      console.log('ID:', result.data.issueCreate.issue.id);
      console.log('URL:', result.data.issueCreate.issue.url);
    } else {
      console.error('❌ Failed to create Linear ticket:', result.errors || result);
    }
  } catch (error) {
    console.error('❌ Error calling Linear API directly:', error);
    console.error('Please make sure you have a valid LINEAR_API_KEY set and node-fetch installed.');
    console.error('You can install node-fetch with: npm install node-fetch');
  }
}

// Run the script
createLinearTicket();