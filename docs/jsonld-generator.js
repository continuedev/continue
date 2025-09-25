// JSON-LD Generator for Continue Documentation
// This script dynamically generates structured data based on page content

(function () {
  "use strict";

  // Base organization data
  const baseOrganizationData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Continue",
    description:
      "Open source AI-powered coding agent with customizable components for chat, autocomplete, edit, and agent workflows in VS Code and JetBrains IDEs",
    url: "https://continue.dev",
    logo: {
      "@type": "ImageObject",
      url: "https://docs.continue.dev/logo/light.svg",
      width: 200,
      height: 50,
    },
    foundingDate: "2023",
    sameAs: [
      "https://github.com/continuedev/continue",
      "https://discord.gg/NWtdYexhMs",
      "https://twitter.com/continuedev",
      "https://linkedin.com/company/continuedev",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: "https://discord.gg/NWtdYexhMs",
    },
    offers: {
      "@type": "Offer",
      name: "Continue AI Coding Agent",
      description:
        "Free open source AI coding agent with premium team and enterprise features",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      category: "Software Development Tools",
    },
  };

  // Base software application data
  const baseSoftwareData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Continue",
    applicationCategory: "DeveloperApplication",
    operatingSystem: ["Windows", "macOS", "Linux"],
    description:
      "Open source AI-powered coding agent with customizable components for chat, autocomplete, edit, and agent workflows",
    url: "https://continue.dev",
    downloadUrl: [
      "https://marketplace.visualstudio.com/items?itemName=Continue.continue",
      "https://plugins.jetbrains.com/plugin/22707-continue-extension",
    ],
    softwareVersion: "latest",
    datePublished: "2023-01-01",
    dateModified: new Date().toISOString().split("T")[0],
    publisher: {
      "@type": "Organization",
      name: "Continue",
      url: "https://continue.dev",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    screenshot: "https://continue.dev/images/continue-screenshot.png",
    featureList: [
      "AI-powered code chat",
      "Intelligent autocomplete",
      "Code editing assistance",
      "Agent workflows",
      "Multi-model support",
      "VS Code integration",
      "JetBrains integration",
      "CLI support",
    ],
  };

  // Wait for the page to load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeJSONLD);
  } else {
    initializeJSONLD();
  }

  function initializeJSONLD() {
    // Check if JSON-LD is already initialized
    if (window.jsonLDInitialized) {
      return;
    }
    window.jsonLDInitialized = true;

    generatePageSpecificJSONLD();
  }

  function generatePageSpecificJSONLD() {
    const currentPath = window.location.pathname;
    const pageTitle = document.title || "Continue Documentation";
    const pageDescription =
      getMetaDescription() || baseOrganizationData.description;
    const canonicalUrl =
      getCanonicalUrl() || `https://docs.continue.dev${currentPath}`;

    let jsonLDData;

    // Generate different structured data based on the current page
    if (
      currentPath === "/" ||
      currentPath === "/index" ||
      currentPath.includes("/home")
    ) {
      // Homepage - Use organization and software data
      jsonLDData = [
        {
          ...baseOrganizationData,
          mainEntity: {
            ...baseSoftwareData,
            url: canonicalUrl,
          },
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Continue Documentation",
          description: pageDescription,
          url: "https://docs.continue.dev",
          publisher: {
            "@type": "Organization",
            name: "Continue",
            url: "https://continue.dev",
          },
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate:
                "https://docs.continue.dev/search?q={search_term_string}",
            },
            "query-input": "required name=search_term_string",
          },
        },
      ];
    } else if (
      currentPath.includes("/getting-started") ||
      currentPath.includes("/install")
    ) {
      // Getting started pages
      jsonLDData = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        publisher: {
          "@type": "Organization",
          name: "Continue",
          url: "https://continue.dev",
        },
        about: {
          "@type": "SoftwareApplication",
          name: "Continue",
          description: "AI-powered coding agent",
        },
        step: extractHowToSteps(),
      };
    } else if (currentPath.includes("/features/")) {
      // Feature pages
      const featureName = extractFeatureName(currentPath, pageTitle);
      jsonLDData = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        headline: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        datePublished: "2023-01-01",
        dateModified: new Date().toISOString().split("T")[0],
        publisher: {
          "@type": "Organization",
          name: "Continue",
          url: "https://continue.dev",
        },
        about: {
          "@type": "SoftwareApplication",
          name: "Continue",
          applicationSubCategory: featureName,
        },
        mainEntity: {
          "@type": "Thing",
          name: featureName,
          description: pageDescription,
        },
      };
    } else if (
      currentPath.includes("/customize/") ||
      currentPath.includes("/customization/")
    ) {
      // Customization and configuration pages
      jsonLDData = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        headline: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        datePublished: "2023-01-01",
        dateModified: new Date().toISOString().split("T")[0],
        publisher: {
          "@type": "Organization",
          name: "Continue",
          url: "https://continue.dev",
        },
        about: {
          "@type": "SoftwareApplication",
          name: "Continue",
        },
        genre: "software configuration",
      };
    } else if (currentPath.includes("/guides/")) {
      // Guide pages
      jsonLDData = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        datePublished: "2023-01-01",
        dateModified: new Date().toISOString().split("T")[0],
        publisher: {
          "@type": "Organization",
          name: "Continue",
          url: "https://continue.dev",
        },
        about: {
          "@type": "SoftwareApplication",
          name: "Continue",
        },
        step: extractHowToSteps(),
      };
    } else if (currentPath.includes("/hub/")) {
      // Hub pages
      jsonLDData = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        isPartOf: {
          "@type": "WebSite",
          name: "Continue Documentation",
          url: "https://docs.continue.dev",
        },
        publisher: {
          "@type": "Organization",
          name: "Continue",
          url: "https://continue.dev",
        },
        about: {
          "@type": "Product",
          name: "Continue Hub",
          description:
            "Platform for creating, sharing, and using custom AI code assistants",
        },
      };
    } else if (currentPath.includes("/reference/")) {
      // Reference pages
      jsonLDData = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        headline: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        datePublished: "2023-01-01",
        dateModified: new Date().toISOString().split("T")[0],
        publisher: {
          "@type": "Organization",
          name: "Continue",
          url: "https://continue.dev",
        },
        about: {
          "@type": "SoftwareApplication",
          name: "Continue",
        },
        genre: "technical reference",
      };
    } else if (
      currentPath.includes("/troubleshooting") ||
      currentPath.includes("/faqs")
    ) {
      // FAQ and troubleshooting pages
      jsonLDData = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        publisher: {
          "@type": "Organization",
          name: "Continue",
          url: "https://continue.dev",
        },
        mainEntity: extractFAQs(),
      };
    } else {
      // Default page structure
      jsonLDData = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        isPartOf: {
          "@type": "WebSite",
          name: "Continue Documentation",
          url: "https://docs.continue.dev",
        },
        publisher: {
          "@type": "Organization",
          name: "Continue",
          url: "https://continue.dev",
        },
      };
    }

    // Add JSON-LD to the page
    addJSONLDToPage(jsonLDData);
  }

  function getMetaDescription() {
    const metaDesc = document.querySelector('meta[name="description"]');
    return metaDesc ? metaDesc.getAttribute("content") : null;
  }

  function getCanonicalUrl() {
    const canonical = document.querySelector('link[rel="canonical"]');
    return canonical ? canonical.getAttribute("href") : null;
  }

  function extractFeatureName(path, title) {
    if (path.includes("/agent")) return "AI Agent";
    if (path.includes("/chat")) return "AI Chat";
    if (path.includes("/edit")) return "Code Editing";
    if (path.includes("/autocomplete")) return "Code Autocomplete";

    // Fallback to extracting from title
    return title.split(" - ")[0] || "Continue Feature";
  }

  function extractHowToSteps() {
    const steps = [];
    const headings = document.querySelectorAll("h2, h3");

    headings.forEach((heading, index) => {
      if (heading.textContent && heading.textContent.trim()) {
        steps.push({
          "@type": "HowToStep",
          position: index + 1,
          name: heading.textContent.trim(),
          text: getNextParagraph(heading)?.textContent?.trim() || "",
        });
      }
    });

    return steps.length > 0
      ? steps.slice(0, 10)
      : [
          {
            "@type": "HowToStep",
            position: 1,
            name: "Follow the documentation",
            text: "Read through the complete guide for detailed instructions.",
          },
        ];
  }

  function extractFAQs() {
    const faqs = [];
    const headings = document.querySelectorAll("h2, h3");

    headings.forEach((heading) => {
      if (heading.textContent && heading.textContent.includes("?")) {
        faqs.push({
          "@type": "Question",
          name: heading.textContent.trim(),
          acceptedAnswer: {
            "@type": "Answer",
            text:
              getNextParagraph(heading)?.textContent?.trim() ||
              "Please refer to the documentation for detailed information.",
          },
        });
      }
    });

    return faqs.length > 0
      ? faqs.slice(0, 20)
      : [
          {
            "@type": "Question",
            name: "How do I get started with Continue?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Visit our getting started guide to install and configure Continue for your development environment.",
            },
          },
        ];
  }

  function getNextParagraph(element) {
    let next = element.nextElementSibling;
    while (next && next.tagName !== "P") {
      next = next.nextElementSibling;
      if (
        !next ||
        ["H1", "H2", "H3", "H4", "H5", "H6"].includes(next.tagName)
      ) {
        break;
      }
    }
    return next;
  }

  function addJSONLDToPage(data) {
    // Remove existing JSON-LD scripts added by this generator
    const existingScripts = document.querySelectorAll(
      'script[data-json-ld-generator="continue"]',
    );
    existingScripts.forEach((script) => script.remove());

    // Handle both single objects and arrays
    const dataArray = Array.isArray(data) ? data : [data];

    dataArray.forEach((jsonLD) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-json-ld-generator", "continue");
      script.textContent = JSON.stringify(jsonLD, null, 2);
      document.head.appendChild(script);
    });
  }

  // Re-run JSON-LD generation on page changes (for SPA navigation)
  if (window.history && window.history.pushState) {
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args);
      setTimeout(() => {
        window.jsonLDInitialized = false;
        generatePageSpecificJSONLD();
      }, 100);
    };

    window.addEventListener("popstate", () => {
      setTimeout(() => {
        window.jsonLDInitialized = false;
        generatePageSpecificJSONLD();
      }, 100);
    });
  }
})();
