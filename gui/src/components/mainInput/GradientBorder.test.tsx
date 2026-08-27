import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GradientBorder } from "./GradientBorder";

// styled-components injects generated rules into document stylesheets,
// so inspect the css rules matching the rendered element's class names
// (whitespace stripped to tolerate cssText serialization differences)
function getCssForElement(element: HTMLElement): string {
  const classNames = Array.from(element.classList);
  const cssTexts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      const styleRule = rule as CSSStyleRule;
      if (
        styleRule.selectorText &&
        classNames.some((name) => styleRule.selectorText.includes(name))
      ) {
        cssTexts.push(styleRule.cssText);
      }
    }
  }
  return cssTexts.join("\n").replace(/\s+/g, "");
}

describe("GradientBorder", () => {
  it("runs the rainbow animation while loading by default (no config provided)", () => {
    const { container } = render(
      <GradientBorder loading={1}>
        <div>content</div>
      </GradientBorder>,
    );
    const css = getCssForElement(container.firstChild as HTMLElement);
    expect(css).toContain("infinite");
    expect(css).not.toContain("animation-name:none");
  });

  it("runs the rainbow animation when loading and rainbowEffectEnabled is true", () => {
    const { container } = render(
      <GradientBorder loading={1} rainbowEffectEnabled={true}>
        <div>content</div>
      </GradientBorder>,
    );
    const css = getCssForElement(container.firstChild as HTMLElement);
    expect(css).toContain("infinite");
    expect(css).not.toContain("animation-name:none");
  });

  it("does not run the rainbow animation when rainbowEffectEnabled is false, even while loading", () => {
    const { container } = render(
      <GradientBorder loading={1} rainbowEffectEnabled={false}>
        <div>content</div>
      </GradientBorder>,
    );
    const css = getCssForElement(container.firstChild as HTMLElement);
    expect(css).not.toContain("infinite");
    expect(css).toContain("animation-name:none");
  });

  it("does not run the rainbow animation when not loading", () => {
    const { container } = render(
      <GradientBorder loading={0} borderColor="#1e1e1e">
        <div>content</div>
      </GradientBorder>,
    );
    const css = getCssForElement(container.firstChild as HTMLElement);
    expect(css).not.toContain("infinite");
    expect(css).toContain("animation-name:none");
  });

  it("still renders its children when the rainbow effect is disabled", () => {
    const { getByText } = render(
      <GradientBorder loading={1} rainbowEffectEnabled={false}>
        <div>content</div>
      </GradientBorder>,
    );
    expect(getByText("content")).toBeInTheDocument();
  });
});
