const fs = require('fs');
const path = require('path');

function getAllHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllHtmlFiles(filePath, fileList);
    } else if (file === 'index.html') {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

module.exports = function customLLMsTxtPlugin(context, options) {
  return {
    name: 'custom-llms-txt',
    async postBuild({ siteConfig, outDir }) {
      // Group docs by their sidebar category
      const sections = {
        'Getting Started': [],
        'Features': [],
        'Guides': [],
        'Customization': [],
        'Advanced': [],
        'Hub': []
      };
      
      // Get all HTML files
      const htmlFiles = getAllHtmlFiles(outDir);
      
      for (const htmlPath of htmlFiles) {
        try {
          const htmlContent = fs.readFileSync(htmlPath, 'utf8');
          
          // Extract title from HTML (handle both formats)
          const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/);
          const title = titleMatch ? titleMatch[1].replace(' | Continue', '').trim() : 'Untitled';
          
          // Skip if title is just "Continue" (likely homepage)
          if (title === 'Continue') continue;
          
          // Extract description from meta tag
          const descMatch = htmlContent.match(/<meta\s+name="description"\s+content="([^"]+)"/);
          const description = descMatch ? descMatch[1] : '';
          
          // Get relative path from build directory
          const relativePath = path.relative(outDir, htmlPath);
          // Convert to URL path
          const cleanPath = relativePath.replace(/index\.html$/, '').replace(/\/$/, '');
          const url = `https://docs.continue.dev/${cleanPath}`;
          
          const docInfo = { title, url, description, path: cleanPath };
          
          // Determine section based on path
          if (cleanPath.includes('getting-started')) {
            sections['Getting Started'].push(docInfo);
          } else if (cleanPath.includes('features')) {
            sections['Features'].push(docInfo);
          } else if (cleanPath.includes('guides')) {
            sections['Guides'].push(docInfo);
          } else if (cleanPath.includes('customization')) {
            sections['Customization'].push(docInfo);
          } else if (cleanPath.includes('advanced')) {
            sections['Advanced'].push(docInfo);
          } else if (cleanPath.includes('hub')) {
            sections['Hub'].push(docInfo);
          } else if (cleanPath === '' || cleanPath === '/') {
            // Root page
            sections['Getting Started'].unshift(docInfo);
          }
        } catch (error) {
          console.warn(`Failed to process ${htmlPath}:`, error.message);
        }
      }
      
      // Generate the structured llms.txt content
      let content = '# Continue Documentation\n\n';
      content += 'Documentation for Continue - the open-source AI code assistant for developers\n\n';
      
      // Add each section
      Object.entries(sections).forEach(([sectionName, docs]) => {
        if (docs.length > 0) {
          content += `## ${sectionName}\n\n`;
          
          // Sort docs within each section
          docs.sort((a, b) => {
            // Sort by path depth first (shorter paths first)
            const depthA = (a.path.match(/\//g) || []).length;
            const depthB = (b.path.match(/\//g) || []).length;
            if (depthA !== depthB) return depthA - depthB;
            
            // Then alphabetically
            return a.path.localeCompare(b.path);
          });
          
          docs.forEach(doc => {
            content += `- [${doc.title}](${doc.url})`;
            if (doc.description) {
              content += `: ${doc.description}`;
            }
            content += '\n';
          });
          content += '\n';
        }
      });
      
      // Write to file
      const outputPath = path.join(outDir, 'llms.txt');
      fs.writeFileSync(outputPath, content, 'utf8');
      
      console.log(`Generated structured llms.txt with ${Object.values(sections).flat().length} pages`);
    }
  };
};