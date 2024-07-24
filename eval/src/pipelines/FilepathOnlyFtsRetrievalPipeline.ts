import BaseRetrievalPipeline, {
  RetrievalPipelineRunArguments,
} from "@continuedev/core/dist/context/retrieval/pipelines/BaseRetrievalPipeline.js";

export default class FilepathOnlyFtsRetrievalPipeline extends BaseRetrievalPipeline {
  async run(args: RetrievalPipelineRunArguments) {
    return await this.retrieveFts(args, this.options.nFinal, "path");
  }
}
