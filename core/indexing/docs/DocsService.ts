import type {
  ContinueConfig,
  DocsIndexingDetails,
  IDE,
  IndexingStatus,
  SiteIndexingConfig,
  Chunk,
} from "../..";
import type { ConfigHandler } from "../../config/ConfigHandler";
import type { IMessenger } from "../../protocol/messenger";
import type { FromCoreProtocol, ToCoreProtocol } from "../../protocol";
import type { ILLM } from "../..";

/* -------------------- Types -------------------- */

export interface SqliteDocsRow {
  title: string;
  startUrl: string;
  favicon: string;
}

/* -------------------- Helpers -------------------- */

export function embedModelsAreEqual(
  _llm1: ILLM | null | undefined,
  _llm2: ILLM | null | undefined,
): boolean {
  return false;
}

/* -------------------- Class -------------------- */

export default class DocsService {
  /* ---------- static API ---------- */

  static lance = null;
  static lanceTableName = "docs";
  static sqlitebTableName = "docs";

  static defaultEmbeddingsProvider = undefined;

  private static instance?: DocsService;

  static createSingleton(
    _configHandler: ConfigHandler,
    _ide: IDE,
    _messenger?: IMessenger<ToCoreProtocol, FromCoreProtocol>,
  ): DocsService {
    const svc = new DocsService();
    DocsService.instance = svc;
    return svc;
  }

  static getSingleton(): DocsService | undefined {
    return DocsService.instance;
  }

  /* ---------- instance API ---------- */

  readonly statuses: Map<string, IndexingStatus> = new Map();
  isInitialized: Promise<void> = Promise.resolve();
  isSyncing = false;

  private constructor() {
    // intentionally empty
  }

  setGithubToken(_token: string): void {}

  initStatuses(): Promise<void> {
    return Promise.resolve();
  }

  abort(_startUrl: string): void {}

  syncDocsWithPrompt(_reIndex = false): Promise<void> {
    return Promise.resolve();
  }

  hasMetadata(_startUrl: string): Promise<boolean> {
    return Promise.resolve(false);
  }

  listMetadata(): Promise<SqliteDocsRow[]> {
    return Promise.resolve([]);
  }

  reindexDoc(_startUrl: string): Promise<void> {
    return Promise.resolve();
  }

  indexAndAdd(
    _siteIndexingConfig: SiteIndexingConfig,
    _forceReindex = false,
  ): Promise<void> {
    return Promise.resolve();
  }

  retrieveChunksFromQuery(
    _query: string,
    _startUrl: string,
    _nRetrieve: number,
  ): Promise<Chunk[]> {
    return Promise.resolve([]);
  }

  getDetails(_startUrl: string): Promise<DocsIndexingDetails> {
    return Promise.reject(
      new Error("DocsService is disabled in this air-gapped build"),
    );
  }

  retrieveChunks(
    _startUrl: string,
    _vector: number[],
    _nRetrieve: number,
    _isRetry = false,
  ): Promise<Chunk[]> {
    return Promise.resolve([]);
  }

  getIndexedPages(_startUrl: string): Promise<Set<string>> {
    return Promise.resolve(new Set());
  }

  getFavicon(_startUrl: string): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }

  delete(_startUrl: string): Promise<void> {
    return Promise.resolve();
  }
}
