import { modelEnvFromDescription } from "./util";

describe("modelEnvFromDescription", () => {
  const base = {
    title: "t",
    provider: "bedrock",
    underlyingProviderName: "",
    model: "m",
  };

  it("collects Bedrock settings, skipping empty values", () => {
    expect(
      modelEnvFromDescription({
        ...base,
        region: "eu-west-1",
        profile: "work",
        crossRegionInference: "auto",
        sessionToken: "",
      } as any),
    ).toEqual({
      region: "eu-west-1",
      profile: "work",
      crossRegionInference: "auto",
    });
  });

  it("returns undefined when there is nothing provider-specific", () => {
    expect(modelEnvFromDescription(base as any)).toBeUndefined();
  });
});
