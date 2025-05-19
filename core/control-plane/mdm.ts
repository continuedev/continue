import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as plist from "plist";

export interface MdmKeys {
  licenseKey: string;
  apiUrl: string;
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

export interface LicenseData {
  customerId: string;
  createdAt: string;
  expiresAt: string;
}

export function validateLicenseKey(licenseKey: string): boolean {
  try {
    // Decode the base64 license key
    const decodedString = Buffer.from(licenseKey, "base64").toString("utf8");
    const { data, signature } = JSON.parse(decodedString);

    // Verify the signature
    const verify = crypto.createVerify("SHA256");
    verify.update(data);
    verify.end();

    const isValid = verify.verify(CONTINUE_PUBLIC_KEY, signature, "base64");

    if (!isValid) return false;

    // Check license expiration
    const licenseData: LicenseData = JSON.parse(data);
    const expirationDate = new Date(licenseData.expiresAt);
    const now = new Date();

    return expirationDate > now;
  } catch (error) {
    console.error("License validation error:", error);
    return false;
  }
}

function readMdmKeysMacOS(): MdmKeys | undefined {
  try {
    // MDM configuration is typically stored in /Library/Managed Preferences/ on macOS
    // The filename is often the bundle identifier of the application
    const mdmPaths = [
      // Organization-specific MDM plist
      "/Library/Managed Preferences/dev.continue.app.plist",
      // User-specific MDM plist
      path.join(
        os.homedir(),
        "Library/Managed Preferences/dev.continue.app.plist",
      ),
    ];

    // Try to find a valid MDM configuration file
    for (const mdmPath of mdmPaths) {
      if (fs.existsSync(mdmPath)) {
        // Read the file content
        const fileContent = fs.readFileSync(mdmPath, "utf8");

        try {
          // Parse the plist file using the plist package
          const config = plist.parse(fileContent);

          // Extract the relevant fields from the config
          // Config is an array of alternating keys and values
          if (Array.isArray(config)) {
            const configObj: Record<string, string> = {};

            // Convert array format [key1, value1, key2, value2, ...] to object
            for (let i = 0; i < config.length; i += 2) {
              if (i + 1 < config.length) {
                const key = config[i];
                const value = config[i + 1];
                if (typeof key === "string") {
                  configObj[key] = value as string;
                }
              }
            }

            // Check if required keys are present
            if (configObj.licenseKey && configObj.apiUrl) {
              return {
                licenseKey: configObj.licenseKey,
                apiUrl: configObj.apiUrl,
              };
            }
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

function readMdmKeysWindows(): MdmKeys | undefined {
  // Windows typically uses registry or special folders for MDM configurations
  throw new Error("MDM keys for Windows not implemented yet");
}

function readMdmKeysLinux(): MdmKeys | undefined {
  try {
    // Common locations for MDM configurations in Linux systems
    const mdmPaths = [
      // System-wide configuration
      "/etc/continue/mdm.json",
      "/var/lib/continue/mdm.json",
      // User-specific configuration
      path.join(os.homedir(), ".config/continue/mdm.json"),
    ];

    // Try to find a valid MDM configuration file
    for (const mdmPath of mdmPaths) {
      if (fs.existsSync(mdmPath)) {
        // Read the file content
        const fileContent = fs.readFileSync(mdmPath, "utf8");

        try {
          // Parse the JSON configuration file
          const config = JSON.parse(fileContent);

          // Check if required keys are present
          if (config.licenseKey && config.apiUrl) {
            return {
              licenseKey: config.licenseKey,
              apiUrl: config.apiUrl,
            };
          }
        } catch (parseError) {
          console.error(`Error parsing Linux MDM configuration: ${parseError}`);
        }
      }
    }

    return undefined;
  } catch (error) {
    console.error("Error reading Linux MDM keys:", error);
    return undefined;
  }
}

function readMdmKeys(): MdmKeys | undefined {
  const platform = os.platform();

  switch (platform) {
    case "darwin":
      return readMdmKeysMacOS();

    case "win32":
      return readMdmKeysWindows();

    case "linux":
      return readMdmKeysLinux();

    default:
      console.error(`MDM keys not supported on platform: ${platform}`);
      return undefined;
  }
}

/**
 * Read and validate MDM keys from the operating system's configuration files or registry.
 */
export function getMdmKeys(): MdmKeys | undefined {
  try {
    const mdmKeys = readMdmKeys();

    if (mdmKeys) {
      if (!validateLicenseKey(mdmKeys.licenseKey)) {
        console.error("Invalid license key found: ", mdmKeys.licenseKey);
        return undefined;
      }

      return mdmKeys;
    }

    return undefined;
  } catch (e) {
    console.warn("Error reading MDM keys: ", e);
    return undefined;
  }
}
