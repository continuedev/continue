#!/usr/bin/env node

/**
 * Sentry Error Analysis Script
 * Analyzes errors from the past 24 hours using Sentry's API
 */

const https = require('https');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to make API requests to Sentry
function sentryRequest(token, endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'sentry.io',
      path: `/api/0/${endpoint}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Format date for Sentry API
function getDateRange() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return {
    start: yesterday.toISOString(),
    end: now.toISOString()
  };
}

// Analyze errors
async function analyzeErrors(token) {
  try {
    console.log('\n🔍 Fetching Sentry organizations...');
    const orgs = await sentryRequest(token, 'organizations/');
    
    if (!orgs || orgs.length === 0) {
      console.log('❌ No organizations found. Please check your token permissions.');
      return;
    }

    console.log(`\n📊 Found ${orgs.length} organization(s):\n`);
    
    for (const org of orgs) {
      console.log(`\n🏢 Organization: ${org.name} (${org.slug})`);
      console.log('─'.repeat(50));
      
      // Get projects
      const projects = await sentryRequest(token, `organizations/${org.slug}/projects/`);
      console.log(`  📁 Projects: ${projects.length}`);
      
      const { start, end } = getDateRange();
      
      for (const project of projects) {
        console.log(`\n  📌 Project: ${project.name}`);
        
        // Get issues for the past 24 hours
        const issues = await sentryRequest(
          token, 
          `projects/${org.slug}/${project.slug}/issues/?statsPeriod=24h&query=is:unresolved`
        );
        
        if (issues && issues.length > 0) {
          console.log(`     🐛 Unresolved issues (24h): ${issues.length}`);
          
          // Analyze top issues
          const topIssues = issues.slice(0, 5);
          console.log('\n     Top 5 Issues:');
          console.log('     ' + '─'.repeat(45));
          
          topIssues.forEach((issue, index) => {
            const errorCount = issue.count || 0;
            const userCount = issue.userCount || 0;
            const level = issue.level || 'unknown';
            const title = issue.title || issue.culprit || 'Unknown Error';
            
            console.log(`\n     ${index + 1}. ${title}`);
            console.log(`        Level: ${level.toUpperCase()}`);
            console.log(`        Events: ${errorCount} | Users affected: ${userCount}`);
            console.log(`        First seen: ${new Date(issue.firstSeen).toLocaleString()}`);
            console.log(`        Last seen: ${new Date(issue.lastSeen).toLocaleString()}`);
            
            if (issue.metadata && issue.metadata.type) {
              console.log(`        Type: ${issue.metadata.type}`);
            }
          });
          
          // Summary statistics
          const totalEvents = issues.reduce((sum, issue) => sum + (issue.count || 0), 0);
          const totalUsers = issues.reduce((sum, issue) => sum + (issue.userCount || 0), 0);
          const criticalIssues = issues.filter(i => i.level === 'error' || i.level === 'fatal').length;
          
          console.log('\n     📊 24-Hour Summary:');
          console.log('     ' + '─'.repeat(45));
          console.log(`     Total issues: ${issues.length}`);
          console.log(`     Total events: ${totalEvents}`);
          console.log(`     Users affected: ${totalUsers}`);
          console.log(`     Critical issues: ${criticalIssues}`);
        } else {
          console.log(`     ✅ No unresolved issues in the past 24 hours`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Analysis complete!');
    
  } catch (error) {
    console.error('\n❌ Error analyzing Sentry data:', error.message);
    if (error.message.includes('401')) {
      console.log('\n💡 Tip: Make sure your token has the correct permissions:');
      console.log('   - project:read');
      console.log('   - org:read');
      console.log('   - event:read');
    }
  }
}

// Main execution
console.log('='.repeat(50));
console.log('🔍 SENTRY ERROR ANALYZER (Past 24 Hours)');
console.log('='.repeat(50));

console.log('\nTo get your Sentry Auth Token:');
console.log('1. Visit: https://sentry.io/settings/account/api/auth-tokens/');
console.log('2. Create a new token with these scopes:');
console.log('   - project:read');
console.log('   - org:read');
console.log('   - event:read');
console.log('3. Copy the token and paste it below\n');

rl.question('Enter your Sentry Auth Token: ', async (token) => {
  if (!token) {
    console.log('❌ No token provided. Exiting...');
    rl.close();
    return;
  }

  await analyzeErrors(token.trim());
  rl.close();
});

// Handle cleanup
rl.on('close', () => {
  console.log('\n👋 Goodbye!');
  process.exit(0);
});