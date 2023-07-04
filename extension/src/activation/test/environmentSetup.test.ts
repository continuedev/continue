const child_process = require("child_process");
import { platform } from "os";
import { getPythonPipCommands } from "../environmentSetup";

jest.mock("os");
jest.mock("child_process");

function mockPythonVersionMappings(mappings: { [pythonCmd: string]: string }) {
  (child_process.exec as jest.Mock).mockImplementation(
    (command: string, options: any) => {
      const pythonCmd = command.split(" ")[0];
      if (pythonCmd in mappings) {
        return Promise.resolve([mappings[pythonCmd], ""]);
      } else {
        return Promise.resolve(["", stubStderr]);
      }
    }
  );
}

const stubStderr =
  "This is a stub stderr, but will be checked only for existence.";
describe("getPythonPipCommands", () => {
  describe("on Windows", () => {
    it("should return the correct Python and Pip commands", async () => {
      (platform as jest.Mock).mockReturnValue("win32");
      mockPythonVersionMappings({
        python: "Python 3.8.0",
      });

      const [pythonCmd, pipCmd] = await getPythonPipCommands();

      expect(pythonCmd).toBe("python");
      expect(pipCmd).toBe("pip");

      jest.restoreAllMocks();
    });
    describe("on MacOS", () => {
      (platform as jest.Mock).mockReturnValue("darwin");
      it("should check through all python versions after finding 3.7", async () => {
        mockPythonVersionMappings({
          python: "",
          python3: "Python 3.7.0",
          "python3.11": "Python 3.11.0",
        });

        const [pythonCmd, pipCmd] = await getPythonPipCommands();

        expect(pythonCmd).toBe("python3.11");
        expect(pipCmd).toBe("pip3.11");

        jest.restoreAllMocks();
      });

      it("should use python3 if that maps to valid version", async () => {
        mockPythonVersionMappings({
          python: "",
          python3: "Python 3.8.0",
        });

        const [pythonCmd, pipCmd] = await getPythonPipCommands();

        expect(pythonCmd).toBe("python3");
        expect(pipCmd).toBe("pip3");

        jest.restoreAllMocks();
      });
    });
  });
});
