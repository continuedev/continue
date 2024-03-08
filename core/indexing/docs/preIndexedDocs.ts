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
];

export default configs;
