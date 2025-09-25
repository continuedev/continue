// Compact JSON-LD generator snippet for Continue Documentation
// This can be embedded inline in MDX files

(function () {
  const baseData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    isPartOf: {
      "@type": "WebSite",
      name: "Continue Documentation",
      url: "https://docs.continue.dev",
    },
    publisher: {
      "@type": "Organization",
      name: "Continue",
      url: "https://continue.dev",
      logo: {
        "@type": "ImageObject",
        url: "https://docs.continue.dev/logo/light.svg",
      },
    },
  };

  const path = window.location.pathname;
  const title = document.title;
  const description =
    document.querySelector('meta[name="description"]')?.content ||
    "Continue AI coding agent documentation";

  let jsonLD = {
    ...baseData,
    name: title,
    description: description,
    url: `https://docs.continue.dev${path}`,
  };

  // Add page-specific structured data
  if (path.includes("/features/")) {
    jsonLD["@type"] = "TechArticle";
    jsonLD.about = {
      "@type": "SoftwareApplication",
      name: "Continue",
    };
  } else if (path.includes("/getting-started/") || path.includes("/guides/")) {
    jsonLD["@type"] = "HowTo";
    jsonLD.about = {
      "@type": "SoftwareApplication",
      name: "Continue",
    };
  }

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(jsonLD, null, 2);
  document.head.appendChild(script);
})();
