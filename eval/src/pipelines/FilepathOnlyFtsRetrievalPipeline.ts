import BaseRetrievalPipeline, {
  RetrievalPipelineRunArguments,
} from "@continuedev/core/dist/context/retrieval/pipelines/BaseRetrievalPipeline.js";
import { deduplicateChunks } from "@continuedev/core/dist/context/retrieval/util.js";

export default class FilepathOnlyFtsRetrievalPipeline extends BaseRetrievalPipeline {
  async run(args: RetrievalPipelineRunArguments) {
    return deduplicateChunks(
      await this.retrieveFts(args, this.options.nRetrieve, "path"),
    );
  }
}
