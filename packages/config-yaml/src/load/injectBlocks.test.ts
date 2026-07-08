import { Registry } from "../interfaces/index.js";
import { PackageIdentifier } from "../interfaces/slugs.js";
import { ConfigYaml } from "../schemas/index.js";
import { unrollBlocks } from "./unroll.js";

// Mock Registry for testing
class MockRegistry implements Registry {
  private content: Record<string, string> = {};

  setContent(id: string, content: string) {
    this.content[id] = content;
  }

  async getContent(id: PackageIdentifier): Promise<string> {
    const key =
      id.uriType === "file"
        ? id.fileUri
        : `${id.fullSlug.ownerSlug}/${id.fullSlug.packageSlug}`;
    if (this.content[key]) {
      return this.content[key];
    }
    throw new Error(`Content not found for ${key}`);
  }
}

describe("injectBlocks with input-to-secret conversion", () => {
  let mockRegistry: MockRegistry;

  beforeEach(() => {
    mockRegistry = new MockRegistry();
  });

  it("converts inputs to secrets in injected model blocks", async () => {
    // Set up a basic assistant config
    const assistant: ConfigYaml = {
      name: "Test Assistant",
      version: "1.0.0",
    };

    // Set up an injected block with input template variables in model
    // Note: Block schema requires exactly 1 element in arrays
    const injectedBlockContent = `
name: OpenAI Block
version: 1.0.0
schema: v1
models:
  - name: gpt-4
    provider: openai
    model: gpt-4
    apiKey: \${{ inputs.openaiKey }}
    apiBase: \${{ inputs.customEndpoint }}
`;

    const injectedBlockId: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///test/openai-block.yaml",
    };

    mockRegistry.setContent(
      "file:///test/openai-block.yaml",
      injectedBlockContent,
    );

    // Unroll with injected blocks
    const result = await unrollBlocks(
      assistant,
      mockRegistry,
      [injectedBlockId], // inject the block
      undefined, // no allowlist
      undefined, // no blocklist
      undefined, // no request options
    );

    expect(result.config).toBeDefined();
    expect(result.config!.models).toBeDefined();
    expect(result.config!.models!.length).toBe(1);

    // Check that inputs were converted to secrets and then to FQSNs
    // For file-type blocks, the FQSN format is: ${{ secrets.//secretName }}
    const model = result.config!.models![0]!;
    expect(model.apiKey).toBe("${{ secrets.//openaiKey }}");
    expect(model.apiBase).toBe("${{ secrets.//customEndpoint }}");
    expect(model.name).toBe("gpt-4");
    expect(model.provider).toBe("openai");
    expect(model.model).toBe("gpt-4");

    // Check that no input variables remain
    const configStr = JSON.stringify(result.config);
    expect(configStr).not.toContain("inputs.openaiKey");
    expect(configStr).not.toContain("inputs.customEndpoint");
  });

  it("converts inputs to secrets in injected rule blocks", async () => {
    const assistant: ConfigYaml = {
      name: "Rule Test Assistant",
      version: "1.0.0",
    };

    const injectedBlockContent = `
name: Style Rules Block
version: 1.0.0
schema: v1
rules:
  - "Use \${{ inputs.codeStyle }} formatting consistently"
`;

    const injectedBlockId: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///test/rules-block.yaml",
    };

    mockRegistry.setContent(
      "file:///test/rules-block.yaml",
      injectedBlockContent,
    );

    const result = await unrollBlocks(
      assistant,
      mockRegistry,
      [injectedBlockId],
      undefined,
      undefined,
      undefined,
    );

    expect(result.config).toBeDefined();
    expect(result.config!.rules).toBeDefined();
    expect(result.config!.rules!.length).toBe(1);

    // Check that input was converted to secret and then to FQSN
    // Note: string rules get wrapped in objects with sourceFile when injected
    const rule = result.config!.rules![0]!;
    if (typeof rule === "string") {
      expect(rule).toBe(
        "Use ${{ secrets.//codeStyle }} formatting consistently",
      );
    } else {
      expect(rule.rule).toBe(
        "Use ${{ secrets.//codeStyle }} formatting consistently",
      );
    }

    // Check that no input variables remain
    const configStr = JSON.stringify(result.config);
    expect(configStr).not.toContain("inputs.codeStyle");
  });

  it("converts inputs to secrets in injected docs blocks", async () => {
    const assistant: ConfigYaml = {
      name: "Docs Test Assistant",
      version: "1.0.0",
    };

    const injectedBlockContent = `
name: Dynamic Docs Block
version: 1.0.0
schema: v1
docs:
  - name: project-docs
    startUrl: \${{ inputs.docsBaseUrl }}/api
    rootUrl: \${{ inputs.docsBaseUrl }}
    faviconUrl: \${{ inputs.docsBaseUrl }}/favicon.ico
`;

    const injectedBlockId: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///test/docs-block.yaml",
    };

    mockRegistry.setContent(
      "file:///test/docs-block.yaml",
      injectedBlockContent,
    );

    const result = await unrollBlocks(
      assistant,
      mockRegistry,
      [injectedBlockId],
      undefined,
      undefined,
      undefined,
    );

    expect(result.config).toBeDefined();
    expect(result.config!.docs).toBeDefined();
    expect(result.config!.docs!.length).toBe(1);

    // Check that inputs were converted to secrets and then to FQSNs
    const doc = result.config!.docs![0]!;
    expect(doc.startUrl).toBe("${{ secrets.//docsBaseUrl }}/api");
    expect(doc.rootUrl).toBe("${{ secrets.//docsBaseUrl }}");
    expect(doc.faviconUrl).toBe("${{ secrets.//docsBaseUrl }}/favicon.ico");
    expect(doc.name).toBe("project-docs");

    // Check that no input variables remain
    const configStr = JSON.stringify(result.config);
    expect(configStr).not.toContain("inputs.docsBaseUrl");
  });

  it("converts inputs to secrets in injected prompt blocks", async () => {
    const assistant: ConfigYaml = {
      name: "Prompt Test Assistant",
      version: "1.0.0",
    };

    const injectedBlockContent = `
name: Dynamic Prompt Block
version: 1.0.0
schema: v1
prompts:
  - name: custom-prompt
    description: "A customizable prompt"
    prompt: "You are a \${{ inputs.roleType }} assistant. Use \${{ inputs.responseStyle }} responses."
`;

    const injectedBlockId: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///test/prompt-block.yaml",
    };

    mockRegistry.setContent(
      "file:///test/prompt-block.yaml",
      injectedBlockContent,
    );

    const result = await unrollBlocks(
      assistant,
      mockRegistry,
      [injectedBlockId],
      undefined,
      undefined,
      undefined,
    );

    expect(result.config).toBeDefined();
    expect(result.config!.prompts).toBeDefined();
    expect(result.config!.prompts!.length).toBe(1);

    // Check that inputs were converted to secrets and then to FQSNs
    const prompt = result.config!.prompts![0]!;
    expect(prompt.prompt).toBe(
      "You are a ${{ secrets.//roleType }} assistant. Use ${{ secrets.//responseStyle }} responses.",
    );
    expect(prompt.name).toBe("custom-prompt");
    expect(prompt.description).toBe("A customizable prompt");

    // Check that no input variables remain
    const configStr = JSON.stringify(result.config);
    expect(configStr).not.toContain("inputs.roleType");
    expect(configStr).not.toContain("inputs.responseStyle");
  });

  it("handles multiple injected blocks of different types", async () => {
    const assistant: ConfigYaml = {
      name: "Multi-Block Assistant",
      version: "1.0.0",
    };

    // Model block with inputs
    const modelBlockContent = `
name: API Model Block
version: 1.0.0
schema: v1
models:
  - name: custom-api
    provider: openai
    model: \${{ inputs.modelName }}
    apiKey: \${{ inputs.apiKey }}
`;

    // Rules block with inputs
    const rulesBlockContent = `
name: Dynamic Rules Block
version: 1.0.0
schema: v1
rules:
  - "Follow \${{ inputs.codingStandard }} conventions"
`;

    const modelBlockId: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///test/model-block.yaml",
    };

    const rulesBlockId: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///test/rules-block.yaml",
    };

    mockRegistry.setContent("file:///test/model-block.yaml", modelBlockContent);
    mockRegistry.setContent("file:///test/rules-block.yaml", rulesBlockContent);

    const result = await unrollBlocks(
      assistant,
      mockRegistry,
      [modelBlockId, rulesBlockId],
      undefined,
      undefined,
      undefined,
    );

    expect(result.config).toBeDefined();

    // Check model block conversion (file-type blocks use // as FQSN prefix)
    expect(result.config!.models).toBeDefined();
    expect(result.config!.models!.length).toBe(1);
    const model = result.config!.models![0]!;
    expect(model.model).toBe("${{ secrets.//modelName }}");
    expect(model.apiKey).toBe("${{ secrets.//apiKey }}");

    // Check rules block conversion
    expect(result.config!.rules).toBeDefined();
    expect(result.config!.rules!.length).toBe(1);
    const rule = result.config!.rules![0]!;
    if (typeof rule === "string") {
      expect(rule).toBe("Follow ${{ secrets.//codingStandard }} conventions");
    } else {
      expect(rule.rule).toBe(
        "Follow ${{ secrets.//codingStandard }} conventions",
      );
    }

    // Verify no input variables remain
    const configStr = JSON.stringify(result.config);
    expect(configStr).not.toContain("inputs.modelName");
    expect(configStr).not.toContain("inputs.apiKey");
    expect(configStr).not.toContain("inputs.codingStandard");
  });

  it("handles blocks with no template variables", async () => {
    const assistant: ConfigYaml = {
      name: "Static Assistant",
      version: "1.0.0",
    };

    const staticBlockContent = `
name: Static Block
version: 1.0.0
schema: v1
models:
  - name: static-model
    provider: ollama
    model: llama3.1
    defaultCompletionOptions:
      temperature: 0.5
      stream: false
`;

    const blockId: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///test/static-block.yaml",
    };

    mockRegistry.setContent(
      "file:///test/static-block.yaml",
      staticBlockContent,
    );

    const result = await unrollBlocks(
      assistant,
      mockRegistry,
      [blockId],
      undefined,
      undefined,
      undefined,
    );

    expect(result.config).toBeDefined();

    // Check that static content is preserved as-is
    expect(result.config!.models).toBeDefined();
    expect(result.config!.models!.length).toBe(1);
    const model = result.config!.models![0]!;
    expect(model.name).toBe("static-model");
    expect(model.provider).toBe("ollama");
    expect(model.model).toBe("llama3.1");
    expect(model.defaultCompletionOptions?.temperature).toBe(0.5);
    expect(model.defaultCompletionOptions?.stream).toBe(false);
  });

  it("preserves non-input template variables", async () => {
    const assistant: ConfigYaml = {
      name: "Mixed Variables Assistant",
      version: "1.0.0",
    };

    const mixedBlockContent = `
name: Mixed Variables Block
version: 1.0.0
schema: v1
rules:
  - "Input: \${{ inputs.userSetting }} | Secret: \${{ secrets.apiKey }} | Continue: \${{ continue.workspaceRoot }}"
`;

    const blockId: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///test/mixed-block.yaml",
    };

    mockRegistry.setContent("file:///test/mixed-block.yaml", mixedBlockContent);

    const result = await unrollBlocks(
      assistant,
      mockRegistry,
      [blockId],
      undefined,
      undefined,
      undefined,
    );

    expect(result.config).toBeDefined();
    expect(result.config!.rules).toBeDefined();
    expect(result.config!.rules!.length).toBe(1);

    const rule = result.config!.rules![0]!;
    let ruleText: string;
    if (typeof rule === "string") {
      ruleText = rule;
    } else {
      ruleText = rule.rule;
    }

    // Input should be converted to secret and then to FQSN, others should also get FQSN treatment
    expect(ruleText).toBe(
      "Input: ${{ secrets.//userSetting }} | Secret: ${{ secrets.//apiKey }} | Continue: ${{ continue.workspaceRoot }}",
    );

    // Verify only inputs were converted
    const configStr = JSON.stringify(result.config);
    expect(configStr).not.toContain("inputs.userSetting");
    expect(configStr).toContain("secrets.//apiKey");
    expect(configStr).toContain("continue.workspaceRoot");
  });

  it("adds source file information to injected blocks", async () => {
    const assistant: ConfigYaml = {
      name: "Source Test Assistant",
      version: "1.0.0",
    };

    const blockContent = `
name: Source Block
version: 1.0.0
schema: v1
rules:
  - name: custom-rule
    rule: "Always add type hints with \${{ inputs.typeStyle }}"
    description: "Enforce type hints for better code clarity"
`;

    const blockId: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///test/source-block.yaml",
    };

    mockRegistry.setContent("file:///test/source-block.yaml", blockContent);

    const result = await unrollBlocks(
      assistant,
      mockRegistry,
      [blockId],
      undefined,
      undefined,
      undefined,
    );

    expect(result.config).toBeDefined();

    // Check that rules have source file information
    expect(result.config!.rules).toBeDefined();
    expect(result.config!.rules!.length).toBe(1);
    const rule = result.config!.rules![0];
    expect(rule).toMatchObject({
      name: "custom-rule",
      rule: "Always add type hints with ${{ secrets.//typeStyle }}",
      description: "Enforce type hints for better code clarity",
      sourceFile: "file:///test/source-block.yaml",
    });

    // Verify input was converted
    const configStr = JSON.stringify(result.config);
    expect(configStr).not.toContain("inputs.typeStyle");
  });

  it("handles complex nested input variables", async () => {
    const assistant: ConfigYaml = {
      name: "Nested Variables Assistant",
      version: "1.0.0",
    };

    const nestedBlockContent = `
name: Nested Variables Block
version: 1.0.0
schema: v1
rules:
  - "Database config: host=\${{ inputs.db.host }};port=\${{ inputs.db.port }};user=\${{ inputs.db.user }}"
`;

    const blockId: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///test/nested-block.yaml",
    };

    mockRegistry.setContent(
      "file:///test/nested-block.yaml",
      nestedBlockContent,
    );

    const result = await unrollBlocks(
      assistant,
      mockRegistry,
      [blockId],
      undefined,
      undefined,
      undefined,
    );

    expect(result.config).toBeDefined();
    expect(result.config!.rules).toBeDefined();
    expect(result.config!.rules!.length).toBe(1);

    const rule = result.config!.rules![0]!;
    let ruleText: string;
    if (typeof rule === "string") {
      ruleText = rule;
    } else {
      ruleText = rule.rule;
    }

    // All nested inputs should be converted to secrets and then to FQSNs
    expect(ruleText).toBe(
      "Database config: host=${{ secrets.//db.host }};port=${{ secrets.//db.port }};user=${{ secrets.//db.user }}",
    );

    // Verify all nested inputs were converted
    const configStr = JSON.stringify(result.config);
    expect(configStr).not.toContain("inputs.db.host");
    expect(configStr).not.toContain("inputs.db.port");
    expect(configStr).not.toContain("inputs.db.user");
  });

  it("converts secrets in injected slug blocks to FQSNs using the block's package identifier", async () => {
    const assistant: ConfigYaml = {
      name: "FQSN Test Assistant",
      version: "1.0.0",
    };

    // This simulates a model block from the hub (e.g., anthropic/claude-sonnet)
    // that has a secret reference that needs to be converted to an FQSN
    const modelBlockContent = `
name: Anthropic Claude Model
version: 1.0.0
schema: v1
models:
  - name: claude-sonnet
    provider: anthropic
    model: claude-sonnet-4-20250514
    apiKey: \${{ secrets.ANTHROPIC_API_KEY }}
`;

    // Using a slug-type identifier (like anthropic/claude-sonnet from the hub)
    const injectedBlockId: PackageIdentifier = {
      uriType: "slug",
      fullSlug: {
        ownerSlug: "anthropic",
        packageSlug: "claude-sonnet",
        versionSlug: "latest",
      },
    };

    mockRegistry.setContent("anthropic/claude-sonnet", modelBlockContent);

    const result = await unrollBlocks(
      assistant,
      mockRegistry,
      [injectedBlockId],
      undefined,
      undefined,
      undefined,
    );

    expect(result.config).toBeDefined();
    expect(result.config!.models).toBeDefined();
    expect(result.config!.models!.length).toBe(1);

    // The secret should be converted to an FQSN that includes the block's slug
    // Format: ${{ secrets.ownerSlug/packageSlug/secretName }}
    const model = result.config!.models![0]!;
    expect(model.apiKey).toBe(
      "${{ secrets.anthropic/claude-sonnet/ANTHROPIC_API_KEY }}",
    );
    expect(model.name).toBe("claude-sonnet");
    expect(model.provider).toBe("anthropic");
    expect(model.model).toBe("claude-sonnet-4-20250514");
  });

  it("converts secrets in injected file blocks to FQSNs using file path shorthand", async () => {
    const assistant: ConfigYaml = {
      name: "File FQSN Test Assistant",
      version: "1.0.0",
    };

    const modelBlockContent = `
name: Local Model
version: 1.0.0
schema: v1
models:
  - name: local-model
    provider: openai
    model: gpt-4
    apiKey: \${{ secrets.OPENAI_API_KEY }}
`;

    const injectedBlockId: PackageIdentifier = {
      uriType: "file",
      fileUri: "/path/to/local-model.yaml",
    };

    mockRegistry.setContent("/path/to/local-model.yaml", modelBlockContent);

    const result = await unrollBlocks(
      assistant,
      mockRegistry,
      [injectedBlockId],
      undefined,
      undefined,
      undefined,
    );

    expect(result.config).toBeDefined();
    expect(result.config!.models).toBeDefined();
    expect(result.config!.models!.length).toBe(1);

    // For file-type blocks, the shorthand slug is "/"
    // So the FQSN becomes: ${{ secrets.//secretName }}
    const model = result.config!.models![0]!;
    expect(model.apiKey).toBe("${{ secrets.//OPENAI_API_KEY }}");
  });

  it("converts both inputs and secrets to proper FQSNs in injected blocks", async () => {
    const assistant: ConfigYaml = {
      name: "Mixed Template Test Assistant",
      version: "1.0.0",
    };

    // Block has both inputs and secrets
    const modelBlockContent = `
name: Mixed Model
version: 1.0.0
schema: v1
models:
  - name: mixed-model
    provider: openai
    model: \${{ inputs.modelName }}
    apiKey: \${{ secrets.API_KEY }}
    apiBase: \${{ inputs.apiBase }}
`;

    const injectedBlockId: PackageIdentifier = {
      uriType: "slug",
      fullSlug: {
        ownerSlug: "myorg",
        packageSlug: "mixed-model",
        versionSlug: "1.0.0",
      },
    };

    mockRegistry.setContent("myorg/mixed-model", modelBlockContent);

    const result = await unrollBlocks(
      assistant,
      mockRegistry,
      [injectedBlockId],
      undefined,
      undefined,
      undefined,
    );

    expect(result.config).toBeDefined();
    expect(result.config!.models).toBeDefined();
    expect(result.config!.models!.length).toBe(1);

    const model = result.config!.models![0]!;
    // Inputs get converted to secrets first, then both get FQSN treatment
    expect(model.model).toBe("${{ secrets.myorg/mixed-model/modelName }}");
    expect(model.apiKey).toBe("${{ secrets.myorg/mixed-model/API_KEY }}");
    expect(model.apiBase).toBe("${{ secrets.myorg/mixed-model/apiBase }}");
  });
});
