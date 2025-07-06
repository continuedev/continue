# Lazy Edit Optimizations

A collection of specialized optimization strategies for applying deterministic lazy edits to different types of code and documentation files. Each optimization is designed to handle specific patterns and file types intelligently.

## Implemented Optimizations

### 📝 **Markdown Optimizations** (`markdownOptimizations.ts`)

**Purpose**: Handle markdown document edits with awareness of document structure and content organization.

**Key Features**:

- **Hierarchical section understanding** (`#`, `##`, `###`)
- **Front matter handling** (YAML metadata at document start)
- **Internal link updates** when headers change
- **Section reordering** with content preservation
- **Table of contents maintenance**
- **Diff validation** with confidence scoring

**Implementation Details**:

```typescript
async function markdownAwareLazyEdit({
  oldFile,
  newLazyFile,
  filename,
  enableMarkdownOptimizations = true,
  markdownConfig = DEFAULT_MARKDOWN_CONFIG,
}: {
  oldFile: string;
  newLazyFile: string;
  filename: string;
  enableMarkdownOptimizations?: boolean;
  markdownConfig?: MarkdownConfig;
}): Promise<DiffLine[] | undefined>;

function validateMarkdownDiff(
  diff: DiffLine[],
  oldFile: string,
  newFile: string,
  pattern: MarkdownEditPattern,
  matches: Array<{
    oldSection: MarkdownSection;
    newSection: MarkdownSection;
    similarity: number;
  }>,
): { isAcceptable: boolean; confidence: number; issues: string[] };
```

**Handles**:

- Front matter additions/removals
- Section content changes
- Internal link reference updates
- Document structure modifications
- Diff quality validation and confidence scoring

### 🔧 **Similar Function Optimizations** (`similarFunctionOptimizations.ts`)

**Purpose**: Handle code with many similar functions (calculators, CRUD operations, validators) by distinguishing functions through unique identifiers rather than just structural similarity.

**Key Features**:

- **Function fingerprinting** based on names and signatures
- **High-confidence exact name matching**
- **Precision targeting** for function modifications
- **CRUD operation awareness**

**Implementation Details**:

```typescript
async function similarFunctionAwareLazyEdit({
  oldFile,
  newLazyFile,
  filename,
  enableSimilarFunctionOptimizations = true,
  similarFunctionConfig = DEFAULT_SIMILAR_FUNCTION_CONFIG,
}: {
  oldFile: string;
  newLazyFile: string;
  filename: string;
  enableSimilarFunctionOptimizations?: boolean;
  similarFunctionConfig?: SimilarFunctionConfig;
}): Promise<DiffLine[] | undefined>;
```

**Handles**:

- Calculator-like classes with similar methods
- CRUD operations with similar structure but different entities
- Validator functions with similar patterns
- Method modifications in classes with many similar methods

**Example Use Cases**:

- Calculator class with `add()`, `subtract()`, `multiply()` methods
- User management with `createUser()`, `updateUser()`, `deleteUser()`
- Form validators with `validateEmail()`, `validatePhone()`, `validateAddress()`

### 🔄 **Reorder-Aware Optimizations** (`reorderAwareOptimizations.ts`)

**Purpose**: Detect and handle cases where functions, methods, or blocks have been reordered while preserving content changes.

**Key Features**:

- **Reordering pattern detection** (alphabetical, dependency-based, functional grouping)
- **Content change preservation** during reordering
- **Multi-strategy reorder handling**

**Implementation Details**:

```typescript
async function reorderAwareLazyEdit({
  oldFile,
  newLazyFile,
  filename,
  enableReorderOptimizations = true,
  reorderConfig = DEFAULT_REORDER_CONFIG,
}: {
  oldFile: string;
  newLazyFile: string;
  filename: string;
  enableReorderOptimizations?: boolean;
  reorderConfig?: ReorderConfig;
}): Promise<DiffLine[] | undefined>;
```

**Handles**:

- Alphabetical function/method reordering
- Dependency-based reorganization
- Functional grouping (getters, setters, utilities)
- Import statement reordering

### 📦 **Import Optimizations** (`importOptimizations.ts`)

**Purpose**: Handle import/export statement modifications with awareness of dependency relationships and organization patterns.

**Key Features**:

- **Import statement parsing** and analysis
- **Dependency relationship awareness**
- **Import organization** (grouping, sorting)
- **Export handling**

**Implementation Details**:

```typescript
async function importAwareLazyEdit({
  oldFile,
  newLazyFile,
  filename,
  enableImportOptimizations = true,
  importConfig = DEFAULT_IMPORT_CONFIG,
}: {
  oldFile: string;
  newLazyFile: string;
  filename: string;
  enableImportOptimizations?: boolean;
  importConfig?: ImportConfig;
}): Promise<DiffLine[] | undefined>;
```

**Handles**:

- Import statement additions/removals
- Import path changes
- Named import modifications
- Import grouping and organization
- Export statement changes

### 🧪 **Test File Optimizations** (`testFileOptimizations.ts`)

**Purpose**: Handle test file modifications with understanding of test structure, patterns, and common testing frameworks (Jest/Vitest).

**Key Features**:

- **Test structure understanding** (describe blocks, test cases)
- **Setup/teardown code handling**
- **Test addition/modification patterns**
- **Assertion pattern recognition**

**Implementation Details**:

```typescript
async function testAwareLazyEdit({
  oldFile,
  newLazyFile,
  filename,
  enableTestOptimizations = true,
  testSimilarityConfig = DEFAULT_TEST_SIMILARITY_CONFIG,
}: {
  oldFile: string;
  newLazyFile: string;
  filename: string;
  enableTestOptimizations?: boolean;
  testSimilarityConfig?: TestSimilarityConfig;
}): Promise<DiffLine[] | undefined>;
```

**Handles**:

- Test case additions and modifications
- Describe block organization
- Setup/teardown code changes
- Mock and assertion updates
- Test file reorganization

**Example Patterns**:

- Jest: `describe()`, `test()`, `beforeEach()`, `afterEach()`
- Vitest: Similar structure with framework-specific features
- Setup code that affects multiple tests

## Configuration

Each optimization can be configured independently:

```typescript
// Import optimizations
const importConfig = {
  enableImportGrouping: true,
  enableImportSorting: true,
  preserveComments: true,
};

// Markdown optimizations
const markdownConfig = {
  handleInternalLinks: true,
  preserveFrontMatter: true,
  enableTOCGeneration: true,
};

// Reorder optimizations
const reorderConfig = {
  enableAlphabeticalSorting: true,
  enableDependencyAwareness: true,
  preserveComments: true,
};

// Similar function optimizations
const similarFunctionConfig = {
  confidenceThreshold: 0.8,
  enableStructuralAnalysis: true,
  enableNameMatching: true,
};

// Test file optimizations
const testSimilarityConfig = {
  enableDescribeBlockHandling: true,
  enableSetupTeardownAnalysis: true,
  preserveTestStructure: true,
};
```

## Usage Patterns

### Direct Optimization Usage

```typescript
import {
  markdownAwareLazyEdit,
  similarFunctionAwareLazyEdit,
  reorderAwareLazyEdit,
  importAwareLazyEdit,
  testAwareLazyEdit,
} from "./optimizations";

// Use specific optimization directly
const diff = await markdownAwareLazyEdit({
  oldFile,
  newLazyFile,
  filename: "docs.md",
  markdownConfig,
});
```

### Automatic Selection

The unified system automatically selects appropriate optimizations based on file analysis:

```typescript
import { deterministicApplyLazyEdit } from "../index";

// Automatically selects best optimization(s)
const diff = await deterministicApplyLazyEdit({
  oldFile,
  newLazyFile,
  filename, // Used for automatic optimization selection
});
```

### File Type Detection

| File Extension               | Primary Optimization      | Secondary Optimizations  |
| ---------------------------- | ------------------------- | ------------------------ |
| `.md`, `.mdx`                | Markdown                  | -                        |
| `.test.js`, `.spec.ts`       | Test File                 | Similar Function, Import |
| `.js`, `.ts`, `.jsx`, `.tsx` | Similar Function, Reorder | Import                   |
| `.py`                        | Similar Function, Reorder | Import                   |
| `.java`, `.cs`, `.cpp`       | Reorder                   | Similar Function         |

## Performance Characteristics

### Optimization Complexity

| Optimization     | Time Complexity     | Space Complexity | Best For                         |
| ---------------- | ------------------- | ---------------- | -------------------------------- |
| Markdown         | O(n)                | O(n)             | Document files                   |
| Similar Function | O(n²) in worst case | O(n)             | Code with many similar functions |
| Reorder-Aware    | O(n log n)          | O(n)             | Files with reorganized content   |
| Import           | O(n)                | O(n)             | Files with many imports          |
| Test File        | O(n)                | O(n)             | Test files                       |

### Memory Usage

- **AST Caching**: Parsed trees are cached to avoid re-parsing
- **Pattern Analysis**: Results cached for similar file structures
- **Timeout Protection**: Prevents memory leaks on complex files

## Error Handling & Fallbacks

Each optimization includes robust error handling:

1. **Graceful Degradation**: Falls back to simpler strategies on failure
2. **Timeout Protection**: Prevents hanging on complex files
3. **Memory Limits**: Protects against excessive memory usage
4. **Debug Logging**: Detailed logging for troubleshooting

```typescript
try {
  const result = await specificOptimization(params);
  return result;
} catch (error) {
  console.debug(`Optimization failed, falling back: ${error}`);
  return fallbackStrategy(params);
}
```

## Testing

Each optimization includes comprehensive tests:
