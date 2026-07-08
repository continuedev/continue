# Mintlify Documentation Formatting Rules

## Component Formatting

When working with Mintlify documentation components (Card, Info, Tip, Note, Warning, etc.), follow these formatting guidelines:

### Bullet Points and Lists

1. **Always add a blank line** after the opening component tag and before the closing tag
2. **Indent content** by 2 spaces within components
3. **Use proper list formatting** with each item on its own line:
   - Start lists on a new line after introductory text
   - Use `-` for unordered lists
   - Maintain consistent indentation

### Examples

#### ✅ Correct Formatting:

```mdx
<Card title="Example" icon="icon-name">

  This is the content with proper formatting:
  - First bullet point
  - Second bullet point
  - Third bullet point

</Card>
```

```mdx
<Info>

  Important information here:
  - Point one
  - Point two
  - Point three

</Info>
```

#### ❌ Incorrect Formatting:

```mdx
<Card title="Example" icon="icon-name">
  This is wrong: - All bullets - On one line - Bad formatting
</Card>
```

### Component-Specific Rules

1. **Card Components**: Always include blank lines and proper indentation
2. **Info/Tip/Note/Warning**: Format lists as bullet points, not inline
3. **CardGroup**: Each Card within should follow the same formatting rules
4. **Code Blocks**: Within components, maintain proper indentation

### Links in Lists

When including links in bullet points:
```mdx
- [Link Text](url): Description of the link
```

### Nested Components

For nested components, maintain proper indentation levels:
```mdx
<CardGroup>
  <Card title="First Card">

    Content here:
    - Bullet one
    - Bullet two

  </Card>

  <Card title="Second Card">

    More content:
    - Another bullet
    - Final bullet

  </Card>
</CardGroup>
```

## Application

These rules apply to all `.mdx` files in the `docs/` directory, particularly:
- Guide documents
- Cookbook documents
- Reference documentation
- Any Mintlify-powered documentation

## Automation Note

When using Continue or other AI assistants to generate or modify documentation:
- Always format Mintlify components according to these rules
- Review generated content for proper formatting
- Apply these rules consistently across all documentation