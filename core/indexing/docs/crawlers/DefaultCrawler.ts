import { PageData } from "../DocsCrawler";

export class DefaultCrawler {
  async *crawl(): AsyncGenerator<PageData> {}
}
