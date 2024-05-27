export interface SiteIndexingConfig {
  startUrl: string;
  title: string;
  rootUrl: string;
}

const configs: SiteIndexingConfig[] = [
  {
    title: "Jinja",
    startUrl: "https://jinja.palletsprojects.com/en/3.1.x/",
    rootUrl: "https://jinja.palletsprojects.com/en/3.1.x/",
  },
  {
    title: "React",
    startUrl: "https://react.dev/reference/",
    rootUrl: "https://react.dev/reference/",
  },
  {
    title: "PostHog",
    startUrl: "https://posthog.com/docs",
    rootUrl: "https://posthog.com/docs",
  },
  {
    title: "Express",
    startUrl: "https://expressjs.com/en/5x/api.html",
    rootUrl: "https://expressjs.com/en/5x/",
  },
  {
    title: "OpenAI",
    startUrl: "https://platform.openai.com/docs/",
    rootUrl: "https://platform.openai.com/docs/",
  },
  {
    title: "Prisma",
    startUrl: "https://www.prisma.io/docs",
    rootUrl: "https://www.prisma.io/docs",
  },
  {
    title: "Boto3",
    startUrl:
      "https://boto3.amazonaws.com/v1/documentation/api/latest/index.html",
    rootUrl: "https://boto3.amazonaws.com/v1/documentation/api/latest/",
  },
  {
    title: "Pytorch",
    startUrl: "https://pytorch.org/docs/stable/",
    rootUrl: "https://pytorch.org/docs/stable/",
  },
  {
    title: "Redis",
    startUrl: "https://redis.io/docs/",
    rootUrl: "https://redis.io/docs/",
  },
  {
    title: "Axios",
    startUrl: "https://axios-http.com/docs/intro",
    rootUrl: "https://axios-http.com/docs",
  },
  {
    title: "Redwood JS",
    startUrl: "https://redwoodjs.com/docs/introduction",
    rootUrl: "https://redwoodjs.com/docs",
  },
  {
    title: "GraphQL",
    startUrl: "https://graphql.org/learn/",
    rootUrl: "https://graphql.org/learn/",
  },
  {
    title: "Typescript",
    startUrl: "https://www.typescriptlang.org/docs/",
    rootUrl: "https://www.typescriptlang.org/docs/",
  },
  {
    title: "Jest",
    startUrl: "https://jestjs.io/docs/getting-started",
    rootUrl: "https://jestjs.io/docs",
  },
  {
    title: "Tailwind CSS",
    startUrl: "https://tailwindcss.com/docs/installation",
    rootUrl: "https://tailwindcss.com/docs",
  },
  {
    title: "Vue.js",
    startUrl: "https://vuejs.org/guide/introduction.html",
    rootUrl: "https://vuejs.org",
  },
  {
    title: "Svelte",
    startUrl: "https://svelte.dev/docs/introduction",
    rootUrl: "https://svelte.dev/docs",
  },
  {
    title: "GitHub Actions",
    startUrl: "https://docs.github.com/en/actions",
    rootUrl: "https://docs.github.com/en/actions",
  },
  {
    title: "NodeJS",
    startUrl: "https://nodejs.org/docs/latest/api/",
    rootUrl: "https://nodejs.org/docs/latest/api/",
  },
  {
    title: "Socket.io",
    startUrl: "https://socket.io/docs/v4/",
    rootUrl: "https://socket.io/docs/v4/",
  },
  {
    title: "Gradle",
    startUrl: "https://docs.gradle.org/current/userguide/userguide.html",
    rootUrl: "https://docs.gradle.org/current",
  },
  {
    title: "Redux Toolkit",
    startUrl: "https://redux-toolkit.js.org/introduction/getting-started",
    rootUrl: "https://redux-toolkit.js.org",
  },
  {
    title: "Chroma",
    startUrl: "https://docs.trychroma.com/",
    rootUrl: "https://docs.trychroma.com/",
  },
  {
    title: "SQLite",
    startUrl: "https://www.sqlite.org/docs.html",
    rootUrl: "https://www.sqlite.org",
  },
  {
    title: "Redux",
    startUrl: "https://redux.js.org/introduction/getting-started",
    rootUrl: "https://redux.js.org",
  },
  {
    title: "Prettier",
    startUrl: "https://prettier.io/docs/en/",
    rootUrl: "https://prettier.io/docs/en/",
  },
  {
    title: "VS Code Extension API",
    startUrl: "https://code.visualstudio.com/api",
    rootUrl: "https://code.visualstudio.com/api",
  },
  {
    title: "Continue",
    startUrl: "https://docs.continue.dev/intro",
    rootUrl: "https://docs.continue.dev",
  },
  {
    title: "jQuery",
    startUrl: "https://api.jquery.com/",
    rootUrl: "https://api.jquery.com/",
  },
  {
    title: "Python",
    startUrl: "https://docs.python.org/3/",
    rootUrl: "https://docs.python.org/3/",
  },
  {
    title: "Rust",
    startUrl: "https://doc.rust-lang.org/book/",
    rootUrl: "https://doc.rust-lang.org/book/",
  },
  {
    title: "IntelliJ Platform SDK",
    startUrl: "https://plugins.jetbrains.com/docs/intellij/welcome.html",
    rootUrl: "https://plugins.jetbrains.com/docs/intellij",
  },
  {
    title: "Docker",
    startUrl: "https://docs.docker.com/",
    rootUrl: "https://docs.docker.com/",
  },
  {
    title: "NPM",
    startUrl: "https://docs.npmjs.com/",
    rootUrl: "https://docs.npmjs.com/",
  },
  {
    title: "TipTap",
    startUrl: "https://tiptap.dev/docs/editor/introduction",
    rootUrl: "https://tiptap.dev/docs",
  },
  {
    title: "esbuild",
    startUrl: "https://esbuild.github.io/",
    rootUrl: "https://esbuild.github.io/",
  },
  {
    title: "Tree Sitter",
    startUrl: "https://tree-sitter.github.io/tree-sitter/",
    rootUrl: "https://tree-sitter.github.io/tree-sitter/",
  },
  {
    title: "Netlify",
    startUrl: "https://docs.netlify.com/",
    rootUrl: "https://docs.netlify.com/",
  },
  {
    title: "Replicate",
    startUrl: "https://replicate.com/docs",
    rootUrl: "https://replicate.com/docs",
  },
  {
    title: "HTML",
    startUrl: "https://www.w3schools.com/html/default.asp",
    rootUrl: "https://www.w3schools.com/html",
  },
  {
    title: "CSS",
    startUrl: "https://www.w3schools.com/css/default.asp",
    rootUrl: "https://www.w3schools.com/css",
  },
  {
    title: "Langchain",
    startUrl: "https://python.langchain.com/docs/get_started/introduction",
    rootUrl: "https://python.langchain.com/docs",
  },
  {
    title: "WooCommerce",
    startUrl: "https://developer.woocommerce.com/docs/",
    rootUrl: "https://developer.woocommerce.com/docs/",
  },
  {
    title: "WordPress",
    startUrl: "https://developer.wordpress.org/reference/",
    rootUrl: "https://developer.wordpress.org/reference/",
  },
  {
    title: "PySide6",
    startUrl: "https://doc.qt.io/qtforpython-6/quickstart.html",
    rootUrl: "https://doc.qt.io/qtforpython-6/api.html",
  },
  {
    title: "Bootstrap",
    startUrl: "https://getbootstrap.com/docs/5.3/getting-started/introduction/",
    rootUrl: "https://getbootstrap.com/docs/5.3/",
  },
  {
    title: "Alpine.js",
    startUrl: "https://alpinejs.dev/start-here",
    rootUrl: "https://alpinejs.dev/",
  },
  {
    title: "C# Language Reference",
    startUrl: "https://learn.microsoft.com/en-us/dotnet/csharp/",
    rootUrl: "https://learn.microsoft.com/en-us/dotnet/csharp/",
  },
];

export default configs;
