import { useEffect, useState } from "react";

const hljsToTextMate = {
  ".hljs-comment": ["comment"],
  ".hljs-tag": ["tag"],

  ".hljs-doctag": ["keyword"],
  ".hljs-keyword": ["keyword"],
  ".hljs-meta .hljs-keyword": ["keyword"],
  ".hljs-template-tag": ["keyword"],
  ".hljs-template-variable": ["keyword"],
  ".hljs-type": ["keyword"],
  ".hljs-variable.language_": ["keyword"],

  ".hljs-title": ["title", "function", "class"],
  ".hljs-title.class_": ["title", "function", "class", "variable"],
  ".hljs-title.class_.inherited__": ["title", "function", "class", "variable"],
  ".hljs-title.function_": [
    "support.function",
    "entity.name.function",
    "title",
    "function",
    "class",
  ],

  ".hljs-built_in": [
    "support.function",
    "entity.name.function",
    "title",
    "function",
    "class",
  ],

  ".hljs-name": ["constant"],

  ".hljs-attr": ["variable", "operator", "number"],
  ".hljs-attribute": ["attribute", "variable", "operator", "number"],
  ".hljs-literal": ["variable", "operator", "number"],
  ".hljs-meta": ["variable", "operator", "number"],
  ".hljs-number": ["constant.numeric", "number", "variable", "operator"],
  ".hljs-operator": ["variable", "operator", "number"],
  ".hljs-variable": ["variable", "operator", "number"],
  ".hljs-selector-attr": ["variable", "operator", "number"],
  ".hljs-selector-class": ["variable", "operator", "number"],
  ".hljs-selector-id": ["variable", "operator", "number"],

  ".hljs-regexp": ["string"],
  ".hljs-string": ["string"],
  ".hljs-meta .hljs-string": ["string"],

  ".hljs-params": ["variable", "operator", "number"],
};

function constructTheme(tmTheme: any): any {
  const rules = tmTheme["rules"] || [];

  const tokenToForeground = {};
  rules.forEach(({ token, foreground }) => {
    if (!foreground || !token) {
      return;
    }
    tokenToForeground[token] = foreground;
  });

  const theme = {};
  Object.keys(hljsToTextMate).forEach((className) => {
    const tokens = hljsToTextMate[className];
    for (const scope of tokens) {
      if (tokenToForeground[scope]) {
        theme[className] = tokenToForeground[scope];
        break;
      }
    }
  });

  return theme;
}

export function useVscTheme() {
  const [theme, setTheme] = useState<any>(
    constructTheme((window as any).fullColorTheme || {})
  );

  useEffect(() => {
    const listener = (e) => {
      if (e.data.type === "setTheme") {
        (window as any).fullColorTheme = e.data.theme;
        setTheme(constructTheme(e.data.theme));
      }
    };
    window.addEventListener("message", listener);
    return () => {
      window.removeEventListener("message", listener);
    };
  }, []);

  return theme;
}
