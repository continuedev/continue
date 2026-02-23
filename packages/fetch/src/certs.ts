import { globalAgent } from "https";
import * as fs from "node:fs";
import tls from "node:tls";

/**
 * Extracts content from either a file path or data URI
 */
export function getCertificateContent(input: string): string {
  if (input.startsWith("data:")) {
    // Parse data URI: data:[<mediatype>][;base64],<data>
    const [header, data] = input.split(",");
    if (header.includes("base64")) {
      return Buffer.from(data, "base64").toString("utf8");
    } else {
      return decodeURIComponent(data);
    }
  } else {
    // Assume it's a file path
    return fs.readFileSync(input, "utf8");
  }
}

export class CertsCache {
  private static instance: CertsCache;
  private _fixedCa: string[] = [];
  private _initialized: boolean = false;
  private _customCerts: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): CertsCache {
    if (!CertsCache.instance) {
      CertsCache.instance = new CertsCache();
    }
    return CertsCache.instance;
  }

  get fixedCa(): string[] {
    if (this._initialized) {
      return this._fixedCa;
    }

    const globalCerts: string[] = [];
    if (Boolean(process.env.IS_BINARY)) {
      if (Array.isArray(globalAgent.options.ca)) {
        globalCerts.push(
          ...globalAgent.options.ca.map((cert) => cert.toString()),
        );
      } else if (typeof globalAgent.options.ca !== "undefined") {
        globalCerts.push(globalAgent.options.ca.toString());
      }
    }

    const extraCerts: string[] = [];
    if (process.env.NODE_EXTRA_CA_CERTS) {
      try {
        const content = fs.readFileSync(
          process.env.NODE_EXTRA_CA_CERTS,
          "utf8",
        );
        extraCerts.push(content);
      } catch (error) {
        if (process.env.VERBOSE_FETCH) {
          console.error(
            `Error reading NODE_EXTRA_CA_CERTS file: ${process.env.NODE_EXTRA_CA_CERTS}`,
            error,
          );
        }
      }
    }

    this._fixedCa = Array.from(
      new Set([...tls.rootCertificates, ...globalCerts, ...extraCerts]),
    );
    this._initialized = true;
    return this._fixedCa;
  }

  async getCachedCustomCert(path: string): Promise<string | undefined> {
    if (this._customCerts.has(path)) {
      return this._customCerts.get(path);
    }
    const certContent = getCertificateContent(path);
    this._customCerts.set(path, certContent);
    return certContent;
  }

  async getAllCachedCustomCerts(
    caBundlePath: string[] | string,
  ): Promise<string[]> {
    const paths = Array.isArray(caBundlePath) ? caBundlePath : [caBundlePath];
    const certs: string[] = [];
    await Promise.all(
      paths.map(async (path) => {
        try {
          const certContent = await this.getCachedCustomCert(path);
          if (certContent) {
            certs.push(certContent);
          } else if (process.env.VERBOSE_FETCH) {
            console.warn(`Empty certificate found at ${path}`);
          }
        } catch (error) {
          if (process.env.VERBOSE_FETCH) {
            console.error(
              `Error loading custom certificate from ${path}:`,
              error,
            );
          }
        }
      }),
    );
    return certs;
  }

  async getCa(caBundlePath: undefined | string | string[]): Promise<string[]> {
    if (!caBundlePath) {
      return this.fixedCa;
    }

    const customCerts = await this.getAllCachedCustomCerts(caBundlePath);
    return [...this.fixedCa, ...customCerts];
  }

  async clear(): Promise<void> {
    this._customCerts.clear();
    this._initialized = false;
    this._fixedCa = [];
  }
}
