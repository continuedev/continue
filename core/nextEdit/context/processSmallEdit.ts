import { IDE, Position } from "../..";
import { GetLspDefinitionsFunction } from "../../autocomplete/types";
import { ConfigHandler } from "../../config/ConfigHandler";
import { NextEditProvider } from "../NextEditProvider";
import { EditAggregator } from "./aggregateEdits";
import { BeforeAfterDiff, createDiff, DiffFormatType } from "./diffFormatting";
import { processNextEditData } from "./processNextEditData";

export const processSmallEdit = async (
  beforeAfterdiff: BeforeAfterDiff,
  cursorPosBeforeEdit: Position,
  cursorPosAfterPrevEdit: Position,
  configHandler: ConfigHandler,
  getDefsFromLspFunction: GetLspDefinitionsFunction,
  ide: IDE,
) => {
  NextEditProvider.getInstance().addDiffToContext(
    createDiff({
      beforeContent: beforeAfterdiff.beforeContent,
      afterContent: beforeAfterdiff.afterContent,
      filePath: beforeAfterdiff.filePath,
      diffType: DiffFormatType.Unified,
      contextLines: 5, // NOTE: This can change depending on experiments!
    }),
  );

  // Get the current context data from the most recent message
  const currentData = (EditAggregator.getInstance() as any)
    .latestContextData || {
    configHandler: configHandler,
    getDefsFromLspFunction: getDefsFromLspFunction,
    recentlyEditedRanges: [],
    recentlyVisitedRanges: [],
  };

  void processNextEditData({
    filePath: beforeAfterdiff.filePath,
    beforeContent: beforeAfterdiff.beforeContent,
    afterContent: beforeAfterdiff.afterContent,
    cursorPosBeforeEdit: cursorPosBeforeEdit,
    cursorPosAfterPrevEdit: cursorPosAfterPrevEdit,
    ide: ide,
    configHandler: currentData.configHandler,
    getDefinitionsFromLsp: currentData.getDefsFromLspFunction,
    recentlyEditedRanges: currentData.recentlyEditedRanges,
    recentlyVisitedRanges: currentData.recentlyVisitedRanges,
    workspaceDir: currentData.workspaceDir,
  });
};
