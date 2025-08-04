import { ToolImpl } from ".";
import { ContextItem } from "../..";
import { getStringArg } from "../parseArgs";
import { TrieveSDK } from 'trieve-ts-sdk';

const DEFAULT_BASE_URL = 'https://api.mintlifytrieve.com';
const SUBDOMAIN = 'docs.continue.dev';
const SERVER_URL = 'https://leaves.mintlify.com';

interface SearchConfig {
  trieveApiKey: string;
  trieveDatasetId: string;
  name: string;
}

interface SearchResult {
  title: string;
  content: string;
  link: string;
}

async function fetchSearchConfiguration(): Promise<SearchConfig> {
  const response = await fetch(`${SERVER_URL}/api/mcp/config/${SUBDOMAIN}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch search configuration: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

async function searchDocs(query: string, config: SearchConfig): Promise<SearchResult[]> {
  const trieve = new TrieveSDK({
    apiKey: config.trieveApiKey,
    datasetId: config.trieveDatasetId,
    baseUrl: DEFAULT_BASE_URL,
  });

  const data = await trieve.autocomplete({
    page_size: 10,
    query,
    search_type: 'fulltext',
    extend_results: true,
    score_threshold: 1,
  });

  if (data.chunks === undefined || data.chunks.length === 0) {
    throw new Error('No results found');
  }

  return data.chunks.map((result) => {
    const { chunk } = result;
    return {
      title: (chunk as any).metadata?.title || 'Untitled',
      content: (chunk as any).chunk_html || '',
      link: (chunk as any).link || '',
    };
  });
}

export const searchContinueDocsImpl: ToolImpl = async (args, extras) => {
  const query = getStringArg(args, "query");
  
  try {
    const config = await fetchSearchConfiguration();
    const results = await searchDocs(query, config);
    
    const contextItems: ContextItem[] = [];
    
    results.forEach((result, index) => {
      const { title, content, link } = result;
      contextItems.push({
        name: `Search Result ${index + 1}: ${title}`,
        description: `Documentation page from Continue docs: ${title}`,
        content: `Title: ${title}\nContent: ${content}\nLink: ${link}`,
      });
    });

    return contextItems;
  } catch (error) {
    return [{
      name: "Search Error",
      description: "Error occurred while searching Continue documentation",
      content: `Failed to search Continue docs: ${error instanceof Error ? error.message : String(error)}`,
    }];
  }
};