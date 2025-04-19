import { BlockType } from "@continuedev/config-yaml";
import { CloudArrowUpIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import HeaderButtonWithToolTip from "../../gui/HeaderButtonWithToolTip";

/**
 * Button for publishing a block to the Hub
 */
interface PublishBlockButtonProps {
  /** Path to the block file on disk */
  blockFilepath: string;
  /** Type of block */
  blockType: BlockType;
}

export const PublishBlockButton: React.FC<PublishBlockButtonProps> = ({
  blockFilepath,
  blockType,
}) => {
  const ideMessenger = useContext(IdeMessengerContext);

  async function handlePublish() {
    const fileContent = await ideMessenger.request("readFile", {
      filepath: blockFilepath,
    });

    if (fileContent.status !== "success") {
      ideMessenger.post("showToast", [
        "error",
        "Failed to read contents of file",
      ]);
      return;
    }

    const encodedContent = encodeURIComponent(fileContent.content);

    ideMessenger.request("controlPlane/openUrl", {
      path: `new?type=block&blockType=${blockType}&blockContent=${encodedContent}`,
      orgSlug: undefined,
    });
  }

  return (
    <HeaderButtonWithToolTip onClick={handlePublish} text="Publish">
      <CloudArrowUpIcon className="h-3 w-3 text-gray-400" />
    </HeaderButtonWithToolTip>
  );
};
