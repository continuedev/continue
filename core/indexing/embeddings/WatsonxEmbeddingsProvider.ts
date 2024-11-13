import {
  EmbeddingsProviderName,
  EmbedOptions,
  FetchFunction,
} from "../../index.js";
import { withExponentialBackoff } from "../../util/withExponentialBackoff.js";

import BaseEmbeddingsProvider, {
  IBaseEmbeddingsProvider,
} from "./BaseEmbeddingsProvider.js";

let accessToken = {
    expiration: 0,
    token: "",
};


class WatsonxEmbeddingsProvider extends BaseEmbeddingsProvider {
  static providerName: EmbeddingsProviderName = "watsonx";
  static maxBatchSize = 1000;
  static defaultOptions: Partial<EmbedOptions> | undefined = {
    model: "ibm/slate-125m-english-rtrvr-v2",
  };

  async getBearerToken(): Promise<{ token: string; expiration: number }> {
    if (
      this.options.apiBase?.includes("cloud.ibm.com")
    ) {
      // watsonx SaaS
      const wxToken = await (
        await fetch(
          `https://iam.cloud.ibm.com/identity/token?apikey=${this.options.apiKey}&grant_type=urn:ibm:params:oauth:grant-type:apikey`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
            },
          },
        )
      ).json();
      return {
        token: wxToken["access_token"],
        expiration: wxToken["expiration"],
      };
    } else {
      // watsonx Software
      if (!this.options.apiKey?.includes(":")) {
        // Using ZenApiKey auth
        return {
          token: this.options.apiKey ?? "",
          expiration: -1,
        };
      } else {
        // Using username/password auth
        const userPass = this.options.apiKey?.split(":");
        const wxToken = await (
          await fetch(`${this.options.apiBase}/icp4d-api/v1/authorize`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              username: userPass[0],
              password: userPass[1],
            }),
          })
        ).json();
        const wxTokenExpiry = await (
          await fetch(
            `${this.options.apiBase}/usermgmt/v1/user/tokenExpiry`,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${wxToken["token"]}`,
              },
            },
          )
        ).json();
        return {
          token: wxToken["token"],
          expiration: wxTokenExpiry["exp"],
        };
      }
    }
  }
  async getSingleBatchEmbedding(batch: string[]) {
    var now = new Date().getTime() / 1000;
    if (
      accessToken === undefined ||
      now > accessToken.expiration ||
      accessToken.token === undefined
    ) {
      accessToken = await this.getBearerToken();
    } else {
      console.log(
        `Reusing token (expires in ${(accessToken.expiration - now) / 60
        } mins)`,
      );
    }
    return await withExponentialBackoff<number[][]>(async () => {
      const payload: any = {
        inputs: batch,
        parameters: {
          truncate_input_tokens: 500,
          return_options: { input_text: false },
        },
        model_id: this.options.model,
        project_id: this.options.projectId,
      };
      const headers = {
        "Content-Type": "application/json",
        Authorization: `${accessToken.expiration === -1 ? "ZenApiKey" : "Bearer"
          } ${accessToken.token}`,
      };
      const resp = await this.fetch(
        new URL(
          `${this.options.apiBase}/ml/v1/text/embeddings?version=${this.options.apiVersion}`,
        ),
        {
          method: "POST",
          body: JSON.stringify(payload),
          headers: headers,
        },
      );

      if (!resp.ok) {
        throw new Error(`Failed to embed chunk: ${await resp.text()}`);
      }
      const data = await resp.json();
      const embeddings = data.results;

      if (!embeddings || embeddings.length === 0) {
        throw new Error("Watsonx generated empty embedding");
      }
      return embeddings.map((e: any) => e.embedding);
    });
  }

  async embed(chunks: string[]) {
    const batchedChunks = this.getBatchedChunks(chunks);
    const results = await Promise.all(
      batchedChunks.map((batch) => this.getSingleBatchEmbedding(batch)),
    );
    return results.flat();
  }
}

export default WatsonxEmbeddingsProvider;
