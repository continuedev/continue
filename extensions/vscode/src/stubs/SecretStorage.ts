import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import * as vscode from "vscode";

const ENCRYPTION_KEY_NAME = "dev.continue.continue";

/**
 * vscode.SecretStorage is not reliable (often loads older values for a key)
 * but keytar cannot be used in vscode extensions without majorly complicating the build
 * so we store the encryption key in vscode.SecrteStorage, and handle the encrypted data ourselves
 */
export class SecretStorage {
  private globalStoragePath: string;
  private secrets: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this.globalStoragePath = context.globalStorageUri.fsPath;
    if (!fs.existsSync(this.globalStoragePath)) {
      fs.mkdirSync(this.globalStoragePath);
    }
    this.secrets = context.secrets;
  }

  private algorithm = "aes-256-gcm";
  private keyLength = 32; // 256 bits
  private ivLength = 16; // 128 bits
  private saltLength = 64;
  private tagLength = 16;

  async getOrCreateEncryptionKey(): Promise<Buffer> {
    let key = await this.secrets.get(ENCRYPTION_KEY_NAME);
    if (!key) {
      key = crypto.randomBytes(this.keyLength).toString("hex");
      await this.secrets.store(ENCRYPTION_KEY_NAME, key);
    }
    return Buffer.from(key, "hex");
  }

  async encrypt(data: string, filePath: string): Promise<void> {
    const key = await this.getOrCreateEncryptionKey();
    const salt = crypto.randomBytes(this.saltLength);
    const iv = crypto.randomBytes(this.ivLength);

    const cipher: crypto.CipherGCM = crypto.createCipheriv(
      this.algorithm,
      key,
      iv,
    ) as crypto.CipherGCM;
    const encrypted = Buffer.concat([
      cipher.update(data, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const result = Buffer.concat([salt, iv, tag, encrypted]);
    fs.writeFileSync(filePath, result);
  }

  async decrypt(filePath: string): Promise<string> {
    const key = await this.getOrCreateEncryptionKey();
    const data = fs.readFileSync(filePath);

    // Validate minimum data size to detect corruption early
    const minSize = this.saltLength + this.ivLength + this.tagLength;
    if (data.length < minSize) {
      throw new Error(
        `Corrupted cache file: insufficient data (${data.length} bytes, expected at least ${minSize})`,
      );
    }

    const salt = data.subarray(0, this.saltLength);
    const iv = data.subarray(this.saltLength, this.saltLength + this.ivLength);
    const tag = data.subarray(
      this.saltLength + this.ivLength,
      this.saltLength + this.ivLength + this.tagLength,
    );
    const encrypted = data.subarray(
      this.saltLength + this.ivLength + this.tagLength,
    );

    const decipher: crypto.DecipherGCM = crypto.createDecipheriv(
      this.algorithm,
      key,
      iv,
    ) as crypto.DecipherGCM;
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }

  private keyToFilepath(key: string): string {
    // Replace invalid characters with underscores
    const sanitizedKey = key.replace(/[\\/:*?"<>|]/g, "_");
    return path.join(this.globalStoragePath, `${sanitizedKey}.bin`);
  }

  async store(key: string, value: string): Promise<void> {
    const filePath = this.keyToFilepath(key);
    await this.encrypt(value, filePath);
  }

  async get(key: string): Promise<string | undefined> {
    const filePath = this.keyToFilepath(key);
    if (fs.existsSync(filePath)) {
      const value = await this.decrypt(filePath);
      return value;
    }
    return undefined;
  }

  async delete(key: string): Promise<void> {
    const filePath = this.keyToFilepath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Successfully deleted cache file: ${filePath}`);
    }
  }
}
