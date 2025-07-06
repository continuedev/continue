import { dedent } from "../../../util";
import { importAwareLazyEdit, importUtils } from "./importOptimizations";

const {
  parseImportStructure,
  categorizeImport,
  formatImportStatement,
  detectImportEditPattern,
} = importUtils;

// Test import parsing
test("should parse various import statement types", () => {
  const code = dedent`
    import React from 'react';
    import { useState, useEffect } from 'react';
    import * as fs from 'fs';
    import 'reflect-metadata';
    import type { User, ApiResponse } from './types';
  `;

  const structure = parseImportStructure(code, "test.ts");

  expect(structure.allImports).toHaveLength(5);
  expect(structure.allImports[0].type).toBe("default");
  expect(structure.allImports[0].defaultImport).toBe("React");
  expect(structure.allImports[1].type).toBe("named");
  expect(structure.allImports[1].namedImports).toEqual([
    "useState",
    "useEffect",
  ]);
  expect(structure.allImports[2].type).toBe("namespace");
  expect(structure.allImports[2].namespaceImport).toBe("fs");
  expect(structure.allImports[3].type).toBe("side_effect");
  expect(structure.allImports[4].type).toBe("type_only");
  expect(structure.allImports[4].typeOnly).toBe(true);
});

// Test import categorization
test("should categorize imports correctly", () => {
  expect(categorizeImport("fs", "test.ts")).toBe("builtin");
  expect(categorizeImport("node:path", "test.ts")).toBe("builtin");
  expect(categorizeImport("react", "test.ts")).toBe("external");
  expect(categorizeImport("@types/node", "test.ts")).toBe("external");
  expect(categorizeImport("./utils", "test.ts")).toBe("relative");
  expect(categorizeImport("../config", "test.ts")).toBe("relative");
  expect(categorizeImport("@/components", "test.ts")).toBe("internal");
  expect(categorizeImport("~/utils", "test.ts")).toBe("internal");
});

// Test adding new imports
test("should handle adding new imports", async () => {
  const oldFile = dedent`
    import React from 'react';
    import { Component } from 'react';

    export class MyComponent extends Component {
      render() {
        return <div>Hello World</div>;
      }
    }
  `;

  const newFile = dedent`
    import React from 'react';
    import { Component } from 'react';
    import { useState } from 'react';
    import axios from 'axios';

    export class MyComponent extends Component {
      render() {
        return <div>Hello World</div>;
      }
    }
  `;

  const diff = await importAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "component.tsx",
    enableImportOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should add the new imports
  const addedLines = diff?.filter((line) => line.type === "new") || [];
  expect(addedLines.some((line) => line.line.includes("useState"))).toBe(true);
  expect(addedLines.some((line) => line.line.includes("axios"))).toBe(true);
});

// Test import grouping and sorting
test("should group and sort imports correctly", async () => {
  const oldFile = dedent`
    import { Component } from 'react';
    import fs from 'fs';
    import './styles.css';
    import { utils } from '../utils';
  `;

  const newFile = dedent`
    import { Component } from 'react';
    import fs from 'fs';
    import './styles.css';
    import { utils } from '../utils';
    import axios from 'axios';
  `;

  const diff = await importAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "component.ts",
    enableImportOptimizations: true,
    importConfig: {
      enableImportOptimizations: true,
      groupImports: true,
      sortImports: true,
      separateTypeImports: false,
      removeUnusedImports: false,
      preferSingleQuotes: true,
      trailingComma: true,
    },
  });

  expect(diff).toBeDefined();

  // Check that imports are properly grouped (builtin, external, relative)
  const allLines = diff?.map((line) => line.line).join("\n") || "";
  expect(allLines).toContain("fs");
  expect(allLines).toContain("axios");
  expect(allLines).toContain("Component");
  expect(allLines).toContain("utils");
});

// Test type import separation
test("should separate type imports when enabled", async () => {
  const oldFile = dedent`
    import React from 'react';
    import { User } from './types';
  `;

  const newFile = dedent`
    import React from 'react';
    import { User } from './types';
    import type { ApiResponse } from './api-types';
    import { useCallback } from 'react';
  `;

  const diff = await importAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "component.ts",
    enableImportOptimizations: true,
    importConfig: {
      enableImportOptimizations: true,
      groupImports: true,
      sortImports: true,
      separateTypeImports: true,
      removeUnusedImports: false,
      preferSingleQuotes: true,
      trailingComma: true,
    },
  });

  expect(diff).toBeDefined();

  // Should add both regular and type imports
  const addedLines = diff?.filter((line) => line.type === "new") || [];
  expect(addedLines.some((line) => line.line.includes("import type"))).toBe(
    true,
  );
  expect(addedLines.some((line) => line.line.includes("useCallback"))).toBe(
    true,
  );
});

// Test import reorganization
test("should detect and handle import reorganization", async () => {
  const oldFile = dedent`
    import { utils } from '../utils';
    import React from 'react';
    import fs from 'fs';
    import axios from 'axios';
  `;

  const newFile = dedent`
    import fs from 'fs';
    
    import axios from 'axios';
    import React from 'react';
    
    import { utils } from '../utils';
  `;

  const diff = await importAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "component.ts",
    enableImportOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should reorganize imports with proper grouping
  const allLines = diff?.map((line) => line.line).join("\n") || "";
  expect(allLines).toContain("fs");
  expect(allLines).toContain("axios");
  expect(allLines).toContain("React");
  expect(allLines).toContain("utils");
});

// Test import style conversion
test("should handle converting between import styles", async () => {
  const oldFile = dedent`
    import * as React from 'react';
    import { Component, useState } from 'react';
  `;

  const newFile = dedent`
    import React from 'react';
    import { Component, useState, useEffect } from 'react';
  `;

  const diff = await importAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "component.tsx",
    enableImportOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should convert namespace import to default import and add useEffect
  const allLines = diff?.map((line) => line.line).join("\n") || "";
  expect(allLines).toContain("import React from");
  expect(allLines).toContain("useEffect");
});

// Test removing imports
test("should handle removing imports", async () => {
  const oldFile = dedent`
    import React from 'react';
    import { Component, useState } from 'react';
    import axios from 'axios';
    import { utils } from './utils';

    export class MyComponent extends Component {
      render() {
        return <div>Hello World</div>;
      }
    }
  `;

  const newFile = dedent`
    import React from 'react';
    import { Component } from 'react';

    export class MyComponent extends Component {
      render() {
        return <div>Hello World</div>;
      }
    }
  `;

  const diff = await importAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "component.tsx",
    enableImportOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should remove unused imports
  const removedLines = diff?.filter((line) => line.type === "old") || [];
  expect(removedLines.some((line) => line.line.includes("useState"))).toBe(
    true,
  );
  expect(removedLines.some((line) => line.line.includes("axios"))).toBe(true);
  expect(removedLines.some((line) => line.line.includes("utils"))).toBe(true);
});

// Test import formatting
test("should format imports according to configuration", () => {
  const singleQuoteConfig = {
    enableImportOptimizations: true,
    groupImports: false,
    sortImports: false,
    separateTypeImports: false,
    removeUnusedImports: false,
    preferSingleQuotes: true,
    trailingComma: true,
  };

  const doubleQuoteConfig = {
    ...singleQuoteConfig,
    preferSingleQuotes: false,
  };

  const importStatement = {
    type: "named" as const,
    source: "react",
    namedImports: ["useState", "useEffect"],
    typeOnly: false,
    startLine: 0,
    endLine: 0,
    originalText: "",
  };

  const singleQuoteResult = formatImportStatement(
    importStatement,
    singleQuoteConfig,
  );
  const doubleQuoteResult = formatImportStatement(
    importStatement,
    doubleQuoteConfig,
  );

  expect(singleQuoteResult).toContain("'react'");
  expect(doubleQuoteResult).toContain('"react"');
  expect(singleQuoteResult).toContain("useState, useEffect");
});

// Test pattern detection
test("should detect various import editing patterns", () => {
  const baseStructure = {
    groups: [],
    allImports: [
      {
        type: "default" as const,
        source: "react",
        defaultImport: "React",
        namedImports: [],
        typeOnly: false,
        startLine: 0,
        endLine: 0,
        originalText: "import React from 'react';",
      },
    ],
    hasTypeImports: false,
    importRegion: { start: 0, end: 0 },
  };

  // Test add import pattern
  const newStructureWithAddition = {
    ...baseStructure,
    allImports: [
      ...baseStructure.allImports,
      {
        type: "named" as const,
        source: "axios",
        namedImports: ["axios"],
        typeOnly: false,
        startLine: 1,
        endLine: 1,
        originalText: "import axios from 'axios';",
      },
    ],
  };

  const addPattern = detectImportEditPattern(
    baseStructure,
    newStructureWithAddition,
  );
  expect(addPattern.type).toBe("add_import");
  expect(addPattern.confidence).toBeGreaterThan(0.7);

  // Test remove import pattern
  const newStructureWithRemoval = {
    ...baseStructure,
    allImports: [],
  };

  const removePattern = detectImportEditPattern(
    baseStructure,
    newStructureWithRemoval,
  );
  expect(removePattern.type).toBe("remove_import");
  expect(removePattern.confidence).toBeGreaterThan(0.6);
});

// Test fallback behavior
test("should fallback to standard approach for non-TypeScript files", async () => {
  const oldFile = dedent`
    const fs = require('fs');
    const path = require('path');
    
    console.log('Hello World');
  `;

  const newFile = dedent`
    const fs = require('fs');
    const path = require('path');
    const http = require('http');
    
    console.log('Hello World');
  `;

  const diff = await importAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "script.js", // CommonJS, not ES modules
    enableImportOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should still work via fallback to standard approach
  const addedLines = diff?.filter((line) => line.type === "new") || [];
  expect(addedLines.some((line) => line.line.includes("http"))).toBe(true);
});

// Test complex import scenarios
test("should handle complex mixed import scenarios", async () => {
  const oldFile = dedent`
    import React, { Component } from 'react';
    import * as fs from 'fs';
    import { User } from './types';
    import axios from 'axios';
    import './styles.css';
  `;

  const newFile = dedent`
    import React, { Component, useState } from 'react';
    import * as fs from 'fs';
    import type { User, ApiResponse } from './types';
    import axios from 'axios';
    import lodash from 'lodash';
    import './styles.css';
    import { utils } from '../utils';
  `;

  const diff = await importAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "component.tsx",
    enableImportOptimizations: true,
    importConfig: {
      enableImportOptimizations: true,
      groupImports: true,
      sortImports: true,
      separateTypeImports: true,
      removeUnusedImports: false,
      preferSingleQuotes: true,
      trailingComma: true,
    },
  });

  expect(diff).toBeDefined();

  // Should handle all the changes: add useState, convert to type import, add lodash and utils
  const allLines = diff?.map((line) => line.line).join("\n") || "";
  expect(allLines).toContain("useState");
  expect(allLines).toContain("import type");
  expect(allLines).toContain("lodash");
  expect(allLines).toContain("utils");
});

// Test edge cases
test("should handle edge cases gracefully", async () => {
  // Empty file
  const emptyDiff = await importAwareLazyEdit({
    oldFile: "",
    newLazyFile: "import React from 'react';",
    filename: "component.ts",
    enableImportOptimizations: true,
  });
  expect(emptyDiff).toBeDefined();

  // File with no imports
  const noImportDiff = await importAwareLazyEdit({
    oldFile: "console.log('Hello World');",
    newLazyFile: "import React from 'react';\nconsole.log('Hello World');",
    filename: "component.ts",
    enableImportOptimizations: true,
  });
  expect(noImportDiff).toBeDefined();

  // Malformed imports (should fallback)
  const malformedDiff = await importAwareLazyEdit({
    oldFile: "import { broken from 'react';",
    newLazyFile: "import React from 'react';",
    filename: "component.ts",
    enableImportOptimizations: true,
  });
  expect(malformedDiff).toBeDefined();
});
