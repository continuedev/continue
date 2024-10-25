import { SiteIndexingConfig } from "../../";

const preIndexedDocs: Record<
  SiteIndexingConfig["startUrl"],
  SiteIndexingConfig
> = {
  "https://jinja.palletsprojects.com/en/3.1.x/": {
    title: "Jinja",
    startUrl: "https://jinja.palletsprojects.com/en/3.1.x/",
    rootUrl: "https://jinja.palletsprojects.com/en/3.1.x/",
    faviconUrl: "https://jinja.palletsprojects.com/favicon.ico",
  },
  "https://react.dev/reference/": {
    title: "React",
    startUrl: "https://react.dev/reference/",
    rootUrl: "https://react.dev/reference/",
    faviconUrl: "https://react.dev/favicon.ico",
  },
  "https://posthog.com/docs": {
    title: "PostHog",
    startUrl: "https://posthog.com/docs",
    rootUrl: "https://posthog.com/docs",
    faviconUrl: "https://posthog.com/favicon.ico",
  },
  "https://expressjs.com/en/5x/api.html": {
    title: "Express",
    startUrl: "https://expressjs.com/en/5x/api.html",
    rootUrl: "https://expressjs.com/en/5x/",
    faviconUrl: "https://expressjs.com/favicon.ico",
  },
  "https://platform.openai.com/docs/": {
    title: "OpenAI",
    startUrl: "https://platform.openai.com/docs/",
    rootUrl: "https://platform.openai.com/docs/",
    faviconUrl: "https://platform.openai.com/favicon.ico",
  },
  "https://www.prisma.io/docs": {
    title: "Prisma",
    startUrl: "https://www.prisma.io/docs",
    rootUrl: "https://www.prisma.io/docs",
    faviconUrl: "https://www.prisma.io/favicon.ico",
  },
  "https://boto3.amazonaws.com/v1/documentation/api/latest/index.html": {
    title: "Boto3",
    startUrl:
      "https://boto3.amazonaws.com/v1/documentation/api/latest/index.html",
    rootUrl: "https://boto3.amazonaws.com/v1/documentation/api/latest/",
    faviconUrl: "https://boto3.amazonaws.com/favicon.ico",
  },
  "https://pytorch.org/docs/stable/": {
    title: "Pytorch",
    startUrl: "https://pytorch.org/docs/stable/",
    rootUrl: "https://pytorch.org/docs/stable/",
    faviconUrl: "https://pytorch.org/favicon.ico",
  },
  "https://redis.io/docs/": {
    title: "Redis",
    startUrl: "https://redis.io/docs/",
    rootUrl: "https://redis.io/docs/",
    faviconUrl: "https://redis.io/favicon.ico",
  },
  "https://axios-http.com/docs/intro": {
    title: "Axios",
    startUrl: "https://axios-http.com/docs/intro",
    rootUrl: "https://axios-http.com/docs",
    faviconUrl: "https://axios-http.com/favicon.ico",
  },
  "https://redwoodjs.com/docs/introduction": {
    title: "Redwood JS",
    startUrl: "https://redwoodjs.com/docs/introduction",
    rootUrl: "https://redwoodjs.com/docs",
    faviconUrl: "https://redwoodjs.com/favicon.ico",
  },
  "https://graphql.org/learn/": {
    title: "GraphQL",
    startUrl: "https://graphql.org/learn/",
    rootUrl: "https://graphql.org/learn/",
    faviconUrl: "https://graphql.org/favicon.ico",
  },
  "https://www.typescriptlang.org/docs/": {
    title: "Typescript",
    startUrl: "https://www.typescriptlang.org/docs/",
    rootUrl: "https://www.typescriptlang.org/docs/",
    faviconUrl: "https://www.typescriptlang.org/favicon.ico",
  },
  "https://jestjs.io/docs/getting-started": {
    title: "Jest",
    startUrl: "https://jestjs.io/docs/getting-started",
    rootUrl: "https://jestjs.io/docs",
    faviconUrl: "https://jestjs.io/favicon.ico",
  },
  "https://tailwindcss.com/docs/installation": {
    title: "Tailwind CSS",
    startUrl: "https://tailwindcss.com/docs/installation",
    rootUrl: "https://tailwindcss.com/docs",
    faviconUrl: "https://tailwindcss.com/favicon.ico",
  },
  "https://vuejs.org/guide/introduction.html": {
    title: "Vue.js",
    startUrl: "https://vuejs.org/guide/introduction.html",
    rootUrl: "https://vuejs.org",
    faviconUrl: "https://vuejs.org/favicon.ico",
  },
  "https://svelte.dev/docs/introduction": {
    title: "Svelte",
    startUrl: "https://svelte.dev/docs/introduction",
    rootUrl: "https://svelte.dev/docs",
    faviconUrl: "https://svelte.dev/favicon.ico",
  },
  "https://docs.github.com/en/actions": {
    title: "GitHub Actions",
    startUrl: "https://docs.github.com/en/actions",
    rootUrl: "https://docs.github.com/en/actions",
    faviconUrl: "https://docs.github.com/favicon.ico",
  },
  "https://nodejs.org/docs/latest/api/": {
    title: "NodeJS",
    startUrl: "https://nodejs.org/docs/latest/api/",
    rootUrl: "https://nodejs.org/docs/latest/api/",
    faviconUrl: "https://nodejs.org/favicon.ico",
  },
  "https://socket.io/docs/v4/": {
    title: "Socket.io",
    startUrl: "https://socket.io/docs/v4/",
    rootUrl: "https://socket.io/docs/v4/",
    faviconUrl: "https://socket.io/favicon.ico",
  },
  "https://docs.gradle.org/current/userguide/userguide.html": {
    title: "Gradle",
    startUrl: "https://docs.gradle.org/current/userguide/userguide.html",
    rootUrl: "https://docs.gradle.org/current",
    faviconUrl: "https://docs.gradle.org/favicon.ico",
  },
  "https://redux-toolkit.js.org/introduction/getting-started": {
    title: "Redux Toolkit",
    startUrl: "https://redux-toolkit.js.org/introduction/getting-started",
    rootUrl: "https://redux-toolkit.js.org",
    faviconUrl: "https://redux-toolkit.js.org/favicon.ico",
  },
  "https://docs.trychroma.com/": {
    title: "Chroma",
    startUrl: "https://docs.trychroma.com/",
    rootUrl: "https://docs.trychroma.com/",
    faviconUrl: "https://docs.trychroma.com/favicon.ico",
  },
  "https://www.sqlite.org/docs.html": {
    title: "SQLite",
    startUrl: "https://www.sqlite.org/docs.html",
    rootUrl: "https://www.sqlite.org",
    faviconUrl: "https://www.sqlite.org/favicon.ico",
  },
  "https://redux.js.org/introduction/getting-started": {
    title: "Redux",
    startUrl: "https://redux.js.org/introduction/getting-started",
    rootUrl: "https://redux.js.org",
    faviconUrl: "https://redux.js.org/favicon.ico",
  },
  "https://prettier.io/docs/en/": {
    title: "Prettier",
    startUrl: "https://prettier.io/docs/en/",
    rootUrl: "https://prettier.io/docs/en/",
    faviconUrl: "https://prettier.io/favicon.ico",
  },
  "https://code.visualstudio.com/api": {
    title: "VS Code Extension API",
    startUrl: "https://code.visualstudio.com/api",
    rootUrl: "https://code.visualstudio.com/api",
    faviconUrl: "https://code.visualstudio.com/favicon.ico",
  },
  "https://docs.continue.dev/intro": {
    title: "Continue",
    startUrl: "https://docs.continue.dev/intro",
    rootUrl: "https://docs.continue.dev",
    faviconUrl: "https://docs.continue.dev/favicon.ico",
  },
  "https://api.jquery.com/": {
    title: "jQuery",
    startUrl: "https://api.jquery.com/",
    rootUrl: "https://api.jquery.com/",
    faviconUrl: "https://api.jquery.com/favicon.ico",
  },
  "https://docs.python.org/3/": {
    title: "Python",
    startUrl: "https://docs.python.org/3/",
    rootUrl: "https://docs.python.org/3/",
    faviconUrl: "https://docs.python.org/favicon.ico",
  },
  "https://doc.rust-lang.org/book/": {
    title: "Rust",
    startUrl: "https://doc.rust-lang.org/book/",
    rootUrl: "https://doc.rust-lang.org/book/",
    faviconUrl: "https://doc.rust-lang.org/favicon.ico",
  },
  "https://plugins.jetbrains.com/docs/intellij/welcome.html": {
    title: "IntelliJ Platform SDK",
    startUrl: "https://plugins.jetbrains.com/docs/intellij/welcome.html",
    rootUrl: "https://plugins.jetbrains.com/docs/intellij",
    faviconUrl: "https://plugins.jetbrains.com/favicon.ico",
  },
  "https://docs.docker.com/": {
    title: "Docker",
    startUrl: "https://docs.docker.com/",
    rootUrl: "https://docs.docker.com/",
    faviconUrl: "https://docs.docker.com/favicon.ico",
  },
  "https://docs.npmjs.com/": {
    title: "NPM",
    startUrl: "https://docs.npmjs.com/",
    rootUrl: "https://docs.npmjs.com/",
    faviconUrl: "https://docs.npmjs.com/favicon.ico",
  },
  "https://tiptap.dev/docs/editor/introduction": {
    title: "TipTap",
    startUrl: "https://tiptap.dev/docs/editor/introduction",
    rootUrl: "https://tiptap.dev/docs",
    faviconUrl: "https://tiptap.dev/favicon.ico",
  },
  "https://esbuild.github.io/": {
    title: "esbuild",
    startUrl: "https://esbuild.github.io/",
    rootUrl: "https://esbuild.github.io/",
    faviconUrl: "https://esbuild.github.io/favicon.ico",
  },
  "https://tree-sitter.github.io/tree-sitter/": {
    title: "Tree Sitter",
    startUrl: "https://tree-sitter.github.io/tree-sitter/",
    rootUrl: "https://tree-sitter.github.io/tree-sitter/",
    faviconUrl: "https://tree-sitter.github.io/favicon.ico",
  },
  "https://docs.netlify.com/": {
    title: "Netlify",
    startUrl: "https://docs.netlify.com/",
    rootUrl: "https://docs.netlify.com/",
    faviconUrl: "https://docs.netlify.com/favicon.ico",
  },
  "https://replicate.com/docs": {
    title: "Replicate",
    startUrl: "https://replicate.com/docs",
    rootUrl: "https://replicate.com/docs",
    faviconUrl: "https://replicate.com/favicon.ico",
  },
  "https://www.w3schools.com/html/default.asp": {
    title: "HTML",
    startUrl: "https://www.w3schools.com/html/default.asp",
    rootUrl: "https://www.w3schools.com/html",
    faviconUrl: "https://www.w3schools.com/favicon.ico",
  },
  "https://www.w3schools.com/css/default.asp": {
    title: "CSS",
    startUrl: "https://www.w3schools.com/css/default.asp",
    rootUrl: "https://www.w3schools.com/css",
    faviconUrl: "https://www.w3schools.com/favicon.ico",
  },
  "https://python.langchain.com/docs/get_started/introduction": {
    title: "Langchain",
    startUrl: "https://python.langchain.com/docs/get_started/introduction",
    rootUrl: "https://python.langchain.com/docs",
    faviconUrl: "https://python.langchain.com/favicon.ico",
  },
  "https://developer.woocommerce.com/docs/": {
    title: "WooCommerce",
    startUrl: "https://developer.woocommerce.com/docs/",
    rootUrl: "https://developer.woocommerce.com/docs/",
    faviconUrl: "https://developer.woocommerce.com/favicon.ico",
  },
  "https://developer.wordpress.org/reference/": {
    title: "WordPress",
    startUrl: "https://developer.wordpress.org/reference/",
    rootUrl: "https://developer.wordpress.org/reference/",
    faviconUrl: "https://developer.wordpress.org/favicon.ico",
  },
  "https://doc.qt.io/qtforpython-6/quickstart.html": {
    title: "PySide6",
    startUrl: "https://doc.qt.io/qtforpython-6/quickstart.html",
    rootUrl: "https://doc.qt.io/qtforpython-6/api.html",
    faviconUrl: "https://doc.qt.io/favicon.ico",
  },
  "https://getbootstrap.com/docs/5.3/getting-started/introduction/": {
    title: "Bootstrap",
    startUrl: "https://getbootstrap.com/docs/5.3/getting-started/introduction/",
    rootUrl: "https://getbootstrap.com/docs/5.3/",
    faviconUrl: "https://getbootstrap.com/favicon.ico",
  },
  "https://alpinejs.dev/start-here": {
    title: "Alpine.js",
    startUrl: "https://alpinejs.dev/start-here",
    rootUrl: "https://alpinejs.dev/",
    faviconUrl: "https://alpinejs.dev/favicon.ico",
  },
  "https://learn.microsoft.com/en-us/dotnet/csharp/": {
    title: "C# Language Reference",
    startUrl: "https://learn.microsoft.com/en-us/dotnet/csharp/",
    rootUrl: "https://learn.microsoft.com/en-us/dotnet/csharp/",
    faviconUrl: "https://learn.microsoft.com/favicon.ico",
  },
  "https://docs.godotengine.org/en/latest/": {
    title: "Godot",
    startUrl: "https://docs.godotengine.org/en/latest/",
    rootUrl: "https://docs.godotengine.org/en/latest/",
    faviconUrl: "https://godotengine.org/favicon.ico",
  },
  "https://docs.amplify.aws/react/": {
    title: "AWS Amplify (Gen 2)",
    startUrl: "https://docs.amplify.aws/react/start/",
    rootUrl: "https://docs.amplify.aws/react/",
    faviconUrl: "https://docs.amplify.aws/favicon.ico"
  },
  "https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/": {
    title: "AWS SDK for JavaScript v3",
    startUrl: "https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/",
    rootUrl: "https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/",
    faviconUrl: "https://docs.aws.amazon.com/favicon.ico"
  },
  "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-construct-library.html": {
    title: "AWS CDK v2",
    startUrl: "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-construct-library.html",
    rootUrl: "https://docs.aws.amazon.com/cdk/api/v2/docs/",
    faviconUrl: "https://docs.aws.amazon.com/cdk/api/v2/img/favicon-32x32.png"
  },
  "https://awscli.amazonaws.com/v2/documentation/api/latest/index.html": {
    title: "AWS CLI commands",
    startUrl: "https://awscli.amazonaws.com/v2/documentation/api/latest/index.html",
    rootUrl: "https://awscli.amazonaws.com/v2/documentation/api/latest/",
    faviconUrl: "https://docs.aws.amazon.com/favicon.ico"
  }
};

export default preIndexedDocs;
