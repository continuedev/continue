import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as plist from "plist";

export interface MdmKeys {
  licenseKey: string;
}

const CONTINUE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz1pFVzsW2UScSnaPAwFp
93QU4+txtyJj8AOC3Kx7YkX1d48DGU2Fy1he7SXPHgcuhXYIqfWGn/Vy/4yJxXD7
HlU8RM7LlWHRk7ecAvF4WtxZDjPE0OSG5T69w5f7tMCtQPQseInCKqleJuCjxrvA
zyTWTwKA1S6e+KxXS/kbqsumriljFujNr6Gmh8ygDnpF055Xo0vTenkMipVw/oYn
U0EHx5ic+Fmcob3EyOj25lu/CVYtU1Rn8jPbrBOMiIq5sePh2QXOwGRsuTiZk2mP
LXSsjLbeWHifRrQ18wj/PC990E33QaFGNFp0NcBXMPbq5eKYKEzKZ0GsxtLoGxar
FQIDAQAB
-----END PUBLIC KEY-----`;

interface LicenseKeyUnsignedData {
  apiUrl: string;
}

export interface LicenseKey {
  signature: string;
  data: string;
  unsignedData: LicenseKeyUnsignedData;
}

export interface LicenseKeyData {
  customerId: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * MDM Manager Singleton Class
 * Handles MDM operations and caches license key data
 */
export class MdmManager {
  private static instance: MdmManager;
  private cachedLicenseKey: LicenseKey | undefined;
  private cacheExpiry: Date | undefined;
  // Cache duration in milliseconds (default: 5 minutes)
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  private constructor() {
    // Private constructor to prevent direct instantiation
  }
  /**
   * Get the singleton instance of MDM Manager
   */
  public static getInstance(): MdmManager {
    if (!MdmManager.instance) {
      MdmManager.instance = new MdmManager();
    }
    return MdmManager.instance;
  }

  /**
   * Clear the cached license key data
   */
  public clearCache(): void {
    this.cachedLicenseKey = undefined;
    this.cacheExpiry = undefined;
  }

  /**
   * Read and validate MDM keys from the operating system's configuration files or registry.
   * Uses caching for performance.
   */
  public getLicenseKeyData(): LicenseKey | undefined {
    try {
      // Return cached value if it's still valid
      if (
        this.cachedLicenseKey &&
        this.cacheExpiry &&
        this.cacheExpiry > new Date()
      ) {
        return this.cachedLicenseKey;
      }

      const mdmKeys = this.readMdmKeys();

      if (mdmKeys) {
        const { isValid, licenseKeyData } = this.validateLicenseKey(
          mdmKeys.licenseKey,
        );

        if (!isValid) {
          console.error("Invalid license key found: ", mdmKeys.licenseKey);
          return undefined;
        }

        // Cache the result with expiry time
        this.cachedLicenseKey = licenseKeyData;
        this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION);

        return licenseKeyData;
      }

      return undefined;
    } catch (e) {
      console.warn("Error reading MDM keys: ", e);
      return undefined;
    }
  }

  /**
   * Store the license key in the appropriate OS-specific location.
   */
  public setMdmLicenseKey(licenseKey: string): boolean {
    try {
      // Validate the license key first
      const { isValid, licenseKeyData } = this.validateLicenseKey(licenseKey);
      if (!isValid) {
        return false;
      }

      const platform = os.platform();
      let success = false;

      switch (platform) {
        case "darwin":
          success = this.writeMdmKeysMacOS(licenseKey);
          break;

        case "win32":
          success = this.writeMdmKeysWindows(licenseKey);
          break;

        case "linux":
          success = this.writeMdmKeysLinux(licenseKey);
          break;

        default:
          console.error(
            `Setting MDM keys not supported on platform: ${platform}`,
          );
          return false;
      }

      // Update cache if write was successful
      if (success && licenseKeyData) {
        this.cachedLicenseKey = licenseKeyData;
        this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION);
      }

      return success;
    } catch (error) {
      console.error("Error setting MDM license key:", error);
      return false;
    }
  }

  /**
   * Validate a license key
   */
  validateLicenseKey(licenseKey: string): {
    isValid: boolean;
    licenseKeyData?: LicenseKey;
  } {
    try {
      // Decode the base64 license key
      const decodedString = Buffer.from(licenseKey, "base64").toString("utf8");
      const { data, signature, unsignedData } = JSON.parse(decodedString);

      // Verify the signature
      const verify = crypto.createVerify("SHA256");
      verify.update(data);
      verify.end();

      const isValid = verify.verify(CONTINUE_PUBLIC_KEY, signature, "base64");

      if (!isValid) return { isValid: false };

      // Check license expiration
      const licenseData: LicenseKeyData = JSON.parse(data);
      const expirationDate = new Date(licenseData.expiresAt);
      const now = new Date();

      const isNotExpired = expirationDate > now;

      if (!isNotExpired) return { isValid: false };

      // Return both validation result and license key data
      const licenseKeyData: LicenseKey = {
        signature,
        data,
        unsignedData,
      };

      return { isValid: true, licenseKeyData };
    } catch (error) {
      console.error("License validation error:", error);
      return { isValid: false };
    }
  }

  // Common locations for MDM configurations
  private readonly MACOS_MDM_PATHS = [
    // Organization-specific MDM plist
    "/Library/Managed Preferences/dev.continue.app.plist",
    // User-specific MDM plist
    path.join(
      os.homedir(),
      "Library/Managed Preferences/dev.continue.app.plist",
    ),
  ];

  private readonly LINUX_MDM_PATHS = [
    // System-wide configuration
    "/etc/continue/mdm.json",
    "/var/lib/continue/mdm.json",
    // User-specific configuration
    path.join(os.homedir(), ".config/continue/mdm.json"),
  ];

  private readMdmKeys(): MdmKeys | undefined {
    const platform = os.platform();

    switch (platform) {
      case "darwin":
        return this.readMdmKeysMacOS();

      case "win32":
        return this.readMdmKeysWindows();

      case "linux":
        return this.readMdmKeysLinux();

      default:
        console.error(`MDM keys not supported on platform: ${platform}`);
        return undefined;
    }
  }

  private readMdmKeysMacOS(): MdmKeys | undefined {
    try {
      // Try to find a valid MDM configuration file
      for (const mdmPath of this.MACOS_MDM_PATHS) {
        if (fs.existsSync(mdmPath)) {
          // Read the file content
          const fileContent = fs.readFileSync(mdmPath, "utf8");

          try {
            // Parse the plist file using the plist package
            const config = plist.parse(fileContent) as
              | { licenseKey: string | undefined }
              | undefined;

            if (config && config?.licenseKey) {
              // Extract the license key from the configuration
              return { licenseKey: config?.licenseKey };
            } else {
              console.error("Invalid MDM configuration format");
            }
          } catch (parseError) {
            console.error(`Error parsing MDM configuration: ${parseError}`);
          }
        }
      }

      return undefined;
    } catch (error) {
      console.error("Error reading macOS MDM keys:", error);
      return undefined;
    }
  }

  private readMdmKeysWindows(): MdmKeys | undefined {
    try {
      // For Windows, we need to read from the registry
      // Using regedit or another synchronous registry access module
      const { execSync } = require("child_process");

      // Path to the registry where MDM configuration is stored
      const regPath = "HKLM\\Software\\Continue\\MDM";
      const userRegPath = "HKCU\\Software\\Continue\\MDM";

      // Try to read from HKEY_LOCAL_MACHINE first
      try {
        // Use REG QUERY command to read registry values
        const licenseKeyCmd = `reg query "${regPath}" /v licenseKey`;
        const licenseKeyOutput = execSync(licenseKeyCmd, { encoding: "utf8" });
        // Extract values from command output
        const licenseKey = this.extractRegValue(licenseKeyOutput);
        if (licenseKey) {
          return { licenseKey };
        }
      } catch (error) {
        // Registry key might not exist, fallback to HKEY_CURRENT_USER
      }

      // Try HKEY_CURRENT_USER if not found in HKEY_LOCAL_MACHINE
      try {
        const licenseKeyCmd = `reg query "${userRegPath}" /v licenseKey`;
        const licenseKeyOutput = execSync(licenseKeyCmd, { encoding: "utf8" });
        // Extract values from command output
        const licenseKey = this.extractRegValue(licenseKeyOutput);
        if (licenseKey) {
          return { licenseKey };
        }
      } catch (error) {
        // Registry key might not exist in HKCU either
      }

      return undefined;
    } catch (error) {
      console.error("Error reading Windows MDM keys:", error);
      return undefined;
    }
  }

  // Helper function to extract registry values from reg query output
  private extractRegValue(output: string): string | undefined {
    const match = output.match(/REG_SZ\s+(.+)$/m);
    return match ? match[1].trim() : undefined;
  }

  private readMdmKeysLinux(): MdmKeys | undefined {
    try {
      // Try to find a valid MDM configuration file
      for (const mdmPath of this.LINUX_MDM_PATHS) {
        if (fs.existsSync(mdmPath)) {
          // Read the file content
          const fileContent = fs.readFileSync(mdmPath, "utf8");

          try {
            // Parse the JSON configuration file
            const config = JSON.parse(fileContent);

            // Check if required key is present
            if (config.licenseKey) {
              return {
                licenseKey: config.licenseKey,
              };
            }
          } catch (parseError) {
            console.error(
              `Error parsing Linux MDM configuration: ${parseError}`,
            );
          }
        }
      }

      return undefined;
    } catch (error) {
      console.error("Error reading Linux MDM keys:", error);
      return undefined;
    }
  }

  private writeMdmKeysMacOS(licenseKey: string): boolean {
    try {
      // Write to user-specific MDM plist
      const userMdmPath = path.join(
        os.homedir(),
        "Library/Managed Preferences/dev.continue.app.plist",
      );

      const config = {
        licenseKey,
      };

      // Ensure directory exists
      fs.mkdirSync(path.dirname(userMdmPath), { recursive: true });

      // Write the plist file
      const plistContent = plist.build(config);
      fs.writeFileSync(userMdmPath, plistContent, "utf8");

      return true;
    } catch (error) {
      console.error("Error writing macOS MDM keys:", error);
      return false;
    }
  }

  private writeMdmKeysWindows(licenseKey: string): boolean {
    try {
      const { execSync } = require("child_process");

      // Use HKEY_CURRENT_USER to avoid needing admin privileges
      const userRegPath = "HKCU\\Software\\Continue\\MDM";

      // Create the registry key if it doesn't exist
      try {
        execSync(`reg add "${userRegPath}" /f`);
      } catch (error) {
        // Key might already exist
      }

      // Set the license key
      execSync(
        `reg add "${userRegPath}" /v licenseKey /t REG_SZ /d "${licenseKey}" /f`,
      );

      return true;
    } catch (error) {
      console.error("Error writing Windows MDM keys:", error);
      return false;
    }
  }

  private writeMdmKeysLinux(licenseKey: string): boolean {
    try {
      // Write to user-specific configuration
      const userMdmPath = path.join(os.homedir(), ".config/continue/mdm.json");

      const config = {
        licenseKey,
      };

      // Ensure directory exists
      fs.mkdirSync(path.dirname(userMdmPath), { recursive: true });

      // Write the JSON configuration file
      fs.writeFileSync(userMdmPath, JSON.stringify(config, null, 2), "utf8");

      return true;
    } catch (error) {
      console.error("Error writing Linux MDM keys:", error);
      return false;
    }
  }
}

// Export convenience functions that use the singleton
export function validateLicenseKey(licenseKey: string): {
  isValid: boolean;
  licenseKeyData?: LicenseKey;
} {
  return MdmManager.getInstance().validateLicenseKey(licenseKey);
}

export function getLicenseKeyData(): LicenseKey | undefined {
  return MdmManager.getInstance().getLicenseKeyData();
}

export function setMdmLicenseKey(licenseKey: string): boolean {
  return MdmManager.getInstance().setMdmLicenseKey(licenseKey);
}
