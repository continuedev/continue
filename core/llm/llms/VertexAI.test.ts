import VertexAI from "./VertexAI";

describe("VertexAI", () => {
  describe("apiBase construction", () => {
    it("should construct standard regional endpoint for us-central1", () => {
      const vertex = new VertexAI({
        model: "gemini-1.5-pro",
        projectId: "test-project",
        region: "us-central1",
      });
      expect(vertex.apiBase).toBe(
        "https://us-central1-aiplatform.googleapis.com/v1/projects/test-project/locations/us-central1/",
      );
    });

    it("should construct standard regional endpoint for europe-west4", () => {
      const vertex = new VertexAI({
        model: "gemini-1.5-pro",
        projectId: "test-project",
        region: "europe-west4",
      });
      expect(vertex.apiBase).toBe(
        "https://europe-west4-aiplatform.googleapis.com/v1/projects/test-project/locations/europe-west4/",
      );
    });

    it("should construct multi-region endpoint for eu", () => {
      const vertex = new VertexAI({
        model: "gemini-1.5-pro",
        projectId: "test-project",
        region: "eu",
      });
      expect(vertex.apiBase).toBe(
        "https://aiplatform.eu.rep.googleapis.com/v1/projects/test-project/locations/eu/",
      );
    });

    it("should construct multi-region endpoint for us", () => {
      const vertex = new VertexAI({
        model: "gemini-1.5-pro",
        projectId: "test-project",
        region: "us",
      });
      expect(vertex.apiBase).toBe(
        "https://aiplatform.us.rep.googleapis.com/v1/projects/test-project/locations/us/",
      );
    });

    it("should construct endpoint for global location", () => {
      const vertex = new VertexAI({
        model: "gemini-1.5-pro",
        projectId: "test-project",
        region: "global",
      });
      expect(vertex.apiBase).toBe(
        "https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/",
      );
    });

    it("should construct express mode endpoint when apiKey is provided", () => {
      const vertex = new VertexAI({
        model: "gemini-1.5-pro",
        apiKey: "test-api-key",
      });
      expect(vertex.apiBase).toBe("https://aiplatform.googleapis.com/v1/");
    });

    it("should preserve custom apiBase when provided", () => {
      const vertex = new VertexAI({
        model: "gemini-1.5-pro",
        projectId: "test-project",
        region: "us-central1",
        apiBase: "https://my-custom-proxy.example.com/v1/",
      });
      expect(vertex.apiBase).toBe("https://my-custom-proxy.example.com/v1/");
    });
  });
});
