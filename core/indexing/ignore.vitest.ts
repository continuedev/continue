import { describe, expect, it } from "vitest";
import {
  DEFAULT_SECURITY_IGNORE_DIRS,
  DEFAULT_SECURITY_IGNORE_FILETYPES,
  defaultFileAndFolderSecurityIgnores,
  isSecurityConcern,
} from "./ignore";

describe("isSecurityConcern", () => {
  describe("Security file types", () => {
    it("should detect environment files as security concerns", () => {
      expect(isSecurityConcern(".env")).toBe(true);
      expect(isSecurityConcern(".env.local")).toBe(true);
      expect(isSecurityConcern(".env.production")).toBe(true);
      expect(isSecurityConcern("config/.env")).toBe(true);
      expect(isSecurityConcern("/path/to/.env")).toBe(true);
      expect(isSecurityConcern("file:///path/to/.env")).toBe(true);
    });

    it("should detect configuration files as security concerns", () => {
      expect(isSecurityConcern("config.json")).toBe(true);
      expect(isSecurityConcern("config.yaml")).toBe(true);
      expect(isSecurityConcern("config.yml")).toBe(true);
      expect(isSecurityConcern("settings.json")).toBe(true);
      expect(isSecurityConcern("appsettings.json")).toBe(true);
      expect(isSecurityConcern("appsettings.development.json")).toBe(true);
      expect(isSecurityConcern("appsettings.production.json")).toBe(true);
    });

    it("should detect certificate and key files as security concerns", () => {
      expect(isSecurityConcern("private.key")).toBe(true);
      expect(isSecurityConcern("certificate.pem")).toBe(true);
      expect(isSecurityConcern("server.crt")).toBe(true);
      expect(isSecurityConcern("keystore.jks")).toBe(true);
      expect(isSecurityConcern("ssl/server.key")).toBe(true);
      expect(isSecurityConcern("/etc/ssl/certs/server.pem")).toBe(true);
    });

    it("should detect database files as security concerns", () => {
      expect(isSecurityConcern("database.db")).toBe(true);
      expect(isSecurityConcern("users.sqlite")).toBe(true);
      expect(isSecurityConcern("data.sqlite3")).toBe(true);
      expect(isSecurityConcern("app.mdb")).toBe(true);
      expect(isSecurityConcern("data/users.db")).toBe(true);
    });

    it("should detect credential files as security concerns", () => {
      expect(isSecurityConcern("app.secret")).toBe(true);
      expect(isSecurityConcern("api.secrets")).toBe(true);
      expect(isSecurityConcern("auth.json")).toBe(true);
      expect(isSecurityConcern("api.token")).toBe(true);
      expect(isSecurityConcern("access.token")).toBe(true);
    });

    it("should detect backup files as security concerns", () => {
      expect(isSecurityConcern("database.bak")).toBe(true);
      expect(isSecurityConcern("config.backup")).toBe(true);
      expect(isSecurityConcern("settings.old")).toBe(true);
      expect(isSecurityConcern("app.orig")).toBe(true);
    });

    it("should detect Docker override files as security concerns", () => {
      expect(isSecurityConcern("docker-compose.override.yml")).toBe(true);
      expect(isSecurityConcern("docker-compose.override.yaml")).toBe(true);
    });

    it("should detect SSH and GPG files as security concerns", () => {
      expect(isSecurityConcern("id_rsa")).toBe(true);
      expect(isSecurityConcern("id_dsa")).toBe(true);
      expect(isSecurityConcern("id_ecdsa")).toBe(true);
      expect(isSecurityConcern("id_ed25519")).toBe(true);
      expect(isSecurityConcern("private.ppk")).toBe(true);
      expect(isSecurityConcern("secret.gpg")).toBe(true);
    });
  });

  describe("Security directories", () => {
    it("should detect environment directories as security concerns", () => {
      expect(isSecurityConcern(".env/")).toBe(true);
      expect(isSecurityConcern("env/")).toBe(true);
      expect(isSecurityConcern(".env/config")).toBe(true);
    });

    it("should detect cloud provider directories as security concerns", () => {
      expect(isSecurityConcern(".aws/")).toBe(true);
      expect(isSecurityConcern(".gcp/")).toBe(true);
      expect(isSecurityConcern(".azure/")).toBe(true);
      expect(isSecurityConcern(".kube/")).toBe(true);
      expect(isSecurityConcern(".docker/")).toBe(true);
      expect(isSecurityConcern(".aws/credentials")).toBe(true);
      expect(isSecurityConcern(".kube/config")).toBe(true);
    });

    it("should detect secret directories as security concerns", () => {
      expect(isSecurityConcern("secrets/")).toBe(true);
      expect(isSecurityConcern(".secrets/")).toBe(true);
      expect(isSecurityConcern("private/")).toBe(true);
      expect(isSecurityConcern(".private/")).toBe(true);
      expect(isSecurityConcern("certs/")).toBe(true);
      expect(isSecurityConcern("certificates/")).toBe(true);
      expect(isSecurityConcern("keys/")).toBe(true);
      expect(isSecurityConcern(".ssh/")).toBe(true);
      expect(isSecurityConcern(".gnupg/")).toBe(true);
      expect(isSecurityConcern(".gpg/")).toBe(true);
    });

    it("should detect continue directory as security concern", () => {
      expect(isSecurityConcern(".continue/config.json")).toBe(true);
    });

    it("should detect temporary secret directories as security concerns", () => {
      expect(isSecurityConcern("tmp/secrets/")).toBe(true);
      expect(isSecurityConcern("temp/secrets/")).toBe(true);
      expect(isSecurityConcern(".tmp/")).toBe(true);
      expect(isSecurityConcern("tmp/secrets/api.key")).toBe(true);
    });
  });

  describe("Path variations", () => {
    it("should handle absolute paths", () => {
      expect(isSecurityConcern("/home/user/.env")).toBe(true);
      expect(isSecurityConcern("/var/www/.secrets/")).toBe(true);
      expect(isSecurityConcern("/etc/ssl/private.key")).toBe(true);
    });

    it("should handle URI schemes", () => {
      expect(isSecurityConcern("file:///home/user/.env")).toBe(true);
      expect(isSecurityConcern("file:///var/secrets/api.key")).toBe(true);
    });

    it("should handle nested paths", () => {
      expect(isSecurityConcern("project/config/.env")).toBe(true);
      expect(isSecurityConcern("src/main/resources/application.secret")).toBe(
        true,
      );
      expect(isSecurityConcern("backend/certs/server.key")).toBe(true);
    });

    // it("should handle Windows-style paths", () => {
    //   expect(isSecurityConcern("C:\\Users\\user\\.env")).toBe(true);
    //   expect(isSecurityConcern("D:\\projects\\app\\secrets\\")).toBe(true);
    // });
  });

  describe("Non-security files", () => {
    it("should not flag regular source code files", () => {
      expect(isSecurityConcern("src/main.js")).toBe(false);
      expect(isSecurityConcern("components/App.tsx")).toBe(false);
      expect(isSecurityConcern("utils/helper.py")).toBe(false);
      expect(isSecurityConcern("models/User.java")).toBe(false);
      expect(isSecurityConcern("styles/main.css")).toBe(false);
    });

    it("should not flag regular configuration files", () => {
      expect(isSecurityConcern("package.json")).toBe(false);
      expect(isSecurityConcern("tsconfig.json")).toBe(false);
      expect(isSecurityConcern("webpack.config.js")).toBe(false);
      expect(isSecurityConcern("babel.config.js")).toBe(false);
      expect(isSecurityConcern("jest.config.js")).toBe(false);
    });

    it("should not flag documentation files", () => {
      expect(isSecurityConcern("README.md")).toBe(false);
      expect(isSecurityConcern("CHANGELOG.md")).toBe(false);
      expect(isSecurityConcern("docs/api.md")).toBe(false);
      expect(isSecurityConcern("LICENSE")).toBe(false);
    });

    it("should not flag regular directories", () => {
      expect(isSecurityConcern("src/")).toBe(false);
      expect(isSecurityConcern("components/")).toBe(false);
      expect(isSecurityConcern("utils/")).toBe(false);
      expect(isSecurityConcern("tests/")).toBe(false);
      expect(isSecurityConcern("docs/")).toBe(false);
    });

    it("should not flag files with similar names but different extensions", () => {
      expect(isSecurityConcern("environment.js")).toBe(false);
      expect(isSecurityConcern("config-template.json")).toBe(false);
      expect(isSecurityConcern("secret-utils.js")).toBe(false);
      expect(isSecurityConcern("token-validator.ts")).toBe(false);
    });

    it("should not flag legitimate source files with token/credentials in name", () => {
      expect(isSecurityConcern("tokens.py")).toBe(false);
      expect(isSecurityConcern("tokens.go")).toBe(false);
      expect(isSecurityConcern("tokens.js")).toBe(false);
      expect(isSecurityConcern("credentials.py")).toBe(false);
      expect(isSecurityConcern("credentials.go")).toBe(false);
      expect(isSecurityConcern("credentials.ts")).toBe(false);
      expect(isSecurityConcern("token_manager.py")).toBe(false);
      expect(isSecurityConcern("credential_helper.js")).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty strings", () => {
      expect(isSecurityConcern("")).toBe(false);
    });

    it("should handle paths with only separators", () => {
      expect(isSecurityConcern("/")).toBe(false);
    });

    it("should handle paths with multiple extensions", () => {
      expect(isSecurityConcern("backup.env.old")).toBe(true); // matches *.old
      expect(isSecurityConcern("config.json.bak")).toBe(true); // matches *.bak
      expect(isSecurityConcern("server.key.backup")).toBe(true); // matches *.backup
    });

    it("should handle files in root vs subdirectories", () => {
      expect(isSecurityConcern(".env")).toBe(true);
      expect(isSecurityConcern("project/.env")).toBe(true);
      expect(isSecurityConcern("deeply/nested/path/.env")).toBe(true);
    });
  });

  describe("Pattern matching consistency", () => {
    it("should match all defined security file patterns", () => {
      // Test a sample from each category to ensure patterns work
      DEFAULT_SECURITY_IGNORE_FILETYPES.forEach((pattern) => {
        // Create a test file name that should match the pattern
        let testFile: string;
        if (pattern.startsWith("*.")) {
          testFile = `test${pattern.substring(1)}`;
        } else if (pattern.includes("*")) {
          testFile = pattern.replace("*", "test");
        } else {
          testFile = pattern;
        }

        expect(isSecurityConcern(testFile)).toBe(true);
      });
    });

    it("should match all defined security directory patterns", () => {
      DEFAULT_SECURITY_IGNORE_DIRS.forEach((pattern) => {
        // Test the directory pattern directly
        expect(isSecurityConcern(pattern)).toBe(true);

        // Test a file inside the directory
        const fileInDir = `${pattern}testfile.txt`;
        expect(isSecurityConcern(fileInDir)).toBe(true);
      });
    });
  });

  describe("Integration with ignore library", () => {
    it("should use the same ignore instance as defaultFileAndFolderSecurityIgnores", () => {
      // Test that our function uses the same logic as the exported ignore instance
      const testFiles = [
        ".env",
        "secrets/api.key",
        ".aws/credentials",
        "regular-file.js",
      ];

      testFiles.forEach((file) => {
        const functionResult = isSecurityConcern(file);
        const ignoreResult = defaultFileAndFolderSecurityIgnores.ignores(file);
        expect(functionResult).toBe(ignoreResult);
      });
    });
  });
});
