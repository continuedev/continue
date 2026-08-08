import { detectLanguage } from "./SyntaxHighlighter.js";

describe("detectLanguage", () => {
  it("should detect JavaScript from import statements", () => {
    const code = `import React from 'react';`;
    expect(detectLanguage(code)).toBe("javascript");
  });

  it("should detect JavaScript from require statements", () => {
    const code = `const fs = require('fs');`;
    expect(detectLanguage(code)).toBe("javascript");
  });

  it("should detect JavaScript from function declarations", () => {
    const code = `function myFunction() { return true; }`;
    expect(detectLanguage(code)).toBe("javascript");
  });

  it("should detect TypeScript from interface declarations", () => {
    const code = `interface User { name: string; }`;
    expect(detectLanguage(code)).toBe("typescript");
  });

  it("should detect TypeScript from type declarations", () => {
    const code = `type UserType = { name: string; };`;
    expect(detectLanguage(code)).toBe("typescript");
  });

  it("should detect Python from function definitions", () => {
    const code = `def my_function():
    return True`;
    expect(detectLanguage(code)).toBe("python");
  });

  it("should detect Python from class definitions", () => {
    const code = `class MyClass:
    def __init__(self):
        pass`;
    expect(detectLanguage(code)).toBe("python");
  });

  it("should detect Java from public class declarations", () => {
    const code = `public class MyClass {
    public static void main(String[] args) {
    }
}`;
    expect(detectLanguage(code)).toBe("java");
  });

  it("should detect C from include statements", () => {
    const code = `#include <stdio.h>
int main() {
    return 0;
}`;
    expect(detectLanguage(code)).toBe("c");
  });

  it("should detect C++ from using namespace", () => {
    const code = `using namespace std;
int main() {
    return 0;
}`;
    expect(detectLanguage(code)).toBe("cpp");
  });

  it("should detect C# from using System", () => {
    const code = `using System;
public class Program {
    public static void Main() {
    }
}`;
    expect(detectLanguage(code)).toBe("csharp");
  });

  it("should detect Go from package main", () => {
    const code = `package main
import "fmt"
func main() {
    fmt.Println("Hello, World!")
}`;
    expect(detectLanguage(code)).toBe("go");
  });

  it("should detect Rust from function syntax", () => {
    const code = `fn main() {
    println!("Hello, World!");
}`;
    expect(detectLanguage(code)).toBe("rust");
  });

  it("should detect PHP from opening tag", () => {
    const code = `<?php
echo "Hello, World!";
?>`;
    expect(detectLanguage(code)).toBe("php");
  });

  it("should detect SQL from SELECT statements", () => {
    const code = `SELECT * FROM users WHERE id = 1;`;
    expect(detectLanguage(code)).toBe("sql");
  });

  it("should detect SQL with case insensitive matching", () => {
    const code = `select name from users where active = true;`;
    expect(detectLanguage(code)).toBe("sql");
  });

  it("should detect JSON from object syntax", () => {
    const code = `{
  "name": "John",
  "age": 30
}`;
    expect(detectLanguage(code)).toBe("json");
  });

  it("should detect bash from shebang", () => {
    const code = `#!/bin/bash
echo "Hello, World!"`;
    expect(detectLanguage(code)).toBe("bash");
  });

  it("should detect HTML from DOCTYPE", () => {
    const code = `<!DOCTYPE html>
<html>
<head>
    <title>Test</title>
</head>
</html>`;
    expect(detectLanguage(code)).toBe("html");
  });

  it("should detect HTML from html tag", () => {
    const code = `<html>
<body>
    <h1>Hello</h1>
</body>
</html>`;
    expect(detectLanguage(code)).toBe("html");
  });

  it("should detect CSS from media queries", () => {
    const code = `@media screen and (max-width: 600px) {
    body {
        font-size: 14px;
    }
}`;
    expect(detectLanguage(code)).toBe("css");
  });

  it("should detect Markdown from headers", () => {
    const code = `# Main Title
## Subtitle
This is some content.`;
    expect(detectLanguage(code)).toBe("markdown");
  });

  it("should default to javascript for unknown patterns", () => {
    const code = `some random code that doesn't match any pattern`;
    expect(detectLanguage(code)).toBe("javascript");
  });

  it("should handle empty string", () => {
    const code = ``;
    expect(detectLanguage(code)).toBe("javascript");
  });

  it("should handle whitespace-only code", () => {
    const code = `   
    
    `;
    expect(detectLanguage(code)).toBe("javascript");
  });

  it("should match first pattern when multiple patterns could match", () => {
    // This code has both import (JavaScript) and interface (TypeScript) patterns
    const code = `import { Component } from 'react';
interface Props {
    name: string;
}`;
    expect(detectLanguage(code)).toBe("javascript"); // JavaScript pattern comes first
  });

  it("should handle multiline code correctly", () => {
    const code = `
    import React from 'react';
    
    const component = () => {
        return <div>Hello</div>;
    };
    `;
    expect(detectLanguage(code)).toBe("javascript");
  });

  it("should detect patterns with leading whitespace", () => {
    const code = `    def my_function():
        return True`;
    expect(detectLanguage(code)).toBe("python");
  });

  it("should handle YAML-like content but default to javascript", () => {
    // The actual implementation doesn't detect YAML from document separator
    const code = `---
name: John
age: 30`;
    expect(detectLanguage(code)).toBe("yaml");
  });
});
