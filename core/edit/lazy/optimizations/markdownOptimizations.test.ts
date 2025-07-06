import { dedent } from "../../../util";
import { markdownAwareLazyEdit, markdownUtils } from "./markdownOptimizations";

const { parseMarkdownStructure, generateTableOfContents, createSlug } =
  markdownUtils;

// Test basic markdown structure parsing
test("should parse markdown structure correctly", () => {
  const markdown = dedent`
    # Main Title
    
    Introduction content here.
    
    ## Section 1
    
    Content for section 1.
    
    ### Subsection 1.1
    
    Nested content.
    
    ## Section 2
    
    Content for section 2.
  `;

  const structure = parseMarkdownStructure(markdown);

  expect(structure.sections).toHaveLength(1);
  expect(structure.sections[0].title).toBe("Main Title");
  expect(structure.sections[0].level).toBe(1);
  expect(structure.sections[0].children).toHaveLength(2);
  expect(structure.sections[0].children[0].title).toBe("Section 1");
  expect(structure.sections[0].children[0].children).toHaveLength(1);
  expect(structure.sections[0].children[0].children[0].title).toBe(
    "Subsection 1.1",
  );
});

// Test adding new sections
test("should handle adding new markdown sections", async () => {
  const oldFile = dedent`
    # Documentation
    
    ## Introduction
    
    This is the introduction.
    
    ## Installation
    
    Install instructions here.
    
    ## Usage
    
    Usage examples here.
  `;

  const newFile = dedent`
    # Documentation
    
    ## Introduction
    
    This is the introduction.
    
    ## Installation
    
    Install instructions here.
    
    ## Configuration
    
    New configuration section with:
    - Database settings
    - API keys
    - Environment variables
    
    <!-- ... existing sections ... -->
    
    ## Usage
    
    Usage examples here.
  `;

  const diff = await markdownAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "docs.md",
    enableMarkdownOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should add the new Configuration section
  const addedLines = diff?.filter((line) => line.type === "new") || [];
  expect(
    addedLines.some((line) => line.line.includes("## Configuration")),
  ).toBe(true);
  expect(
    addedLines.some((line) => line.line.includes("Database settings")),
  ).toBe(true);
  expect(addedLines.some((line) => line.line.includes("API keys"))).toBe(true);
});

// Test section reordering
test("should handle markdown section reordering", async () => {
  const oldFile = dedent`
    # API Guide
    
    ## Authentication
    
    How to authenticate with the API.
    
    ## Endpoints
    
    Available API endpoints.
    
    ## Error Handling
    
    How to handle API errors.
    
    ## Rate Limiting
    
    API rate limiting information.
  `;

  const newFile = dedent`
    # API Guide
    
    ## Authentication
    
    How to authenticate with the API.
    Enhanced with new OAuth2 flow documentation.
    
    ## Rate Limiting
    
    API rate limiting information.
    
    ## Error Handling
    
    How to handle API errors.
    
    ## Endpoints
    
    Available API endpoints.
  `;

  const diff = await markdownAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "api-guide.md",
    enableMarkdownOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should handle modification (may fall back to standard diff)
  const allLines = diff?.map((line) => line.line).join("\n") || "";
  expect(allLines).toContain("Enhanced with new OAuth2");

  // Should maintain all sections despite reordering
  expect(allLines).toContain("## Authentication");
  expect(allLines).toContain("## Endpoints");
  expect(allLines).toContain("## Error Handling");
  expect(allLines).toContain("## Rate Limiting");
});

// Test table of contents generation
test("should generate table of contents correctly", () => {
  const sections = [
    {
      id: "h1:main",
      level: 1,
      title: "Main Section",
      slug: "main-section",
      content: "",
      startLine: 0,
      endLine: 10,
      children: [
        {
          id: "h2:sub1",
          level: 2,
          title: "Subsection 1",
          slug: "subsection-1",
          content: "",
          startLine: 2,
          endLine: 5,
          children: [],
          originalOrder: 1,
          isModified: false,
        },
        {
          id: "h2:sub2",
          level: 2,
          title: "Subsection 2",
          slug: "subsection-2",
          content: "",
          startLine: 6,
          endLine: 9,
          children: [],
          originalOrder: 2,
          isModified: false,
        },
      ],
      originalOrder: 0,
      isModified: false,
    },
  ];

  const toc = generateTableOfContents(sections);

  expect(toc).toContain("- [Main Section](#main-section)");
  expect(toc).toContain("  - [Subsection 1](#subsection-1)");
  expect(toc).toContain("  - [Subsection 2](#subsection-2)");
});

// Test front matter handling
test("should handle YAML front matter correctly", async () => {
  const oldFile = dedent`
    ---
    title: "Documentation"
    version: "1.0"
    ---
    
    # Documentation
    
    ## Overview
    
    This is the overview section.
  `;

  const newFile = dedent`
    ---
    title: "Documentation"
    version: "2.0"
    author: "John Doe"
    ---
    
    # Documentation
    
    ## Overview
    
    This is the overview section.

    Updated with new information.
  `;

  const diff = await markdownAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "docs.md",
    enableMarkdownOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should handle front matter changes (may fall back to standard diff)
  const allLines = diff?.map((line) => line.line).join("\n") || "";
  expect(allLines).toContain('version: "2.0"');
  expect(allLines).toContain('author: "John Doe"');
  expect(allLines).toContain("Updated with new information");
});

// Test slug generation
test("should generate URL-safe slugs correctly", () => {
  expect(createSlug("Getting Started")).toBe("getting-started");
  expect(createSlug("API & Configuration")).toBe("api-configuration");
  expect(createSlug("Multiple   Spaces")).toBe("multiple-spaces");
  expect(createSlug("Special!@#$%Characters")).toBe("specialcharacters");
  expect(createSlug("Numbers 123 Test")).toBe("numbers-123-test");
});

// Test fallback to standard approach
test.skip("should fallback to standard approach when markdown optimization fails", async () => {
  const oldFile = dedent`
    This is not really structured markdown.
    It has some text but no clear headers or sections.
    Just plain content without markdown formatting.
  `;

  const newFile = dedent`
    This is not really structured markdown.
    It has some text but no clear headers or sections.
    Just plain content without markdown formatting.
    Added some new content at the end.
  `;

  const diff = await markdownAwareLazyEdit({
    oldFile,
    newLazyFile: newFile,
    filename: "plain.md",
    enableMarkdownOptimizations: true,
  });

  expect(diff).toBeDefined();

  // Should still work via fallback to standard approach
  const addedLines = diff?.filter((line) => line.type === "new") || [];
  expect(
    addedLines.some((line) => line.line.includes("Added some new content")),
  ).toBe(true);
});
