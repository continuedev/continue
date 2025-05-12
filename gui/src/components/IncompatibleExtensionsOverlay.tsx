import { ExtensionConflictReport, ExtensionInfo } from "core";
import GraniteLogo from "../granite/GraniteLogo";

function generateIncompatibleExtensionsString(
  conflictingExtensions: ExtensionInfo[],
): string {
  switch (conflictingExtensions.length) {
    case 0:
      return "";
    case 1:
      return conflictingExtensions[0].name;
    case 2:
      return `${conflictingExtensions[0].name} and ${conflictingExtensions[1].name}`;
    default:
      const res = conflictingExtensions
        .map((e) => e.name)
        .slice(0, -1)
        .join(", ");
      return `${res}, and ${conflictingExtensions[conflictingExtensions.length - 1].name}`;
  }
}

function IncompatibleExtensionsOverlay({
  conflictingInfo,
}: {
  conflictingInfo: ExtensionConflictReport;
}) {
  // Currently, we only conflict with Continue
  // This logic might need a tweak if we have more incompatible extensions in the future
  const incompatibleExtensionNames = generateIncompatibleExtensionsString(
    conflictingInfo.conflictingExtensions,
  );
  return (
    <div className="fade-in-overlay absolute z-50 flex h-full w-full flex-col items-center justify-center">
      <GraniteLogo alt="Granite.Code Logo" className="mb-2 h-24 w-24" />
      <h1 className="mb-2 p-2 text-center text-xl">
        Incompatible Extension Enabled
      </h1>
      <p className="p-2 text-center font-medium text-gray-400">{`${conflictingInfo.currentExtension.name} cannot be used while the ${incompatibleExtensionNames} ${conflictingInfo.conflictingExtensions.length > 1 ? "extensions are" : "extension is"} enabled. Please disable ${incompatibleExtensionNames} from the extension settings.`}</p>
    </div>
  );
}

export default IncompatibleExtensionsOverlay;
