# Light IDE Extension for Continue

## Overview

This extension provides a lightweight IDE integration for the Continue ecosystem. It enables core Continue features—such as code context, chat, and agent workflows—in editors or environments that do not have a dedicated extension. The Light IDE extension communicates with the Continue core via a standardized protocol, allowing for basic code intelligence and automation features.

## Development

### Prerequisites

- Node.js v20.19.0 or higher (`nvm use` in the project root to set the correct version)
- npm for dependency management

### Setup

1. **Install dependencies:**
   
   ```sh
   cd /continue
   npm run ci 
   (this will install both core and vscode extension)
   
   cd /continue/extensions/light-ide
   npm install
   

2. **Build the extension:**

    ```sh
    npm run prepackage 
    (this will copy relevant artifacts, gui and other folders)

    npm run build 
    (create index.js build artifact)

   

3. **Run in development mode and debug:**

 ```sh
    npm run start 

    ** You can click on it "Run Start" or "Run Debug" if you want to debug.
    ** currently the breakpoints should be in the index.js 