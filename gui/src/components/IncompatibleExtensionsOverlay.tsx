import { ExtensionConflictReport, ExtensionInfo } from "core";
import React, { useContext } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import GraniteLogo from "../granite/GraniteLogo";

function generateIncompatibleExtensionsBlock(
  conflictingExtensions: ExtensionInfo[],
): React.ReactNode {
  const formatName = (name: string) => (
    <span className="font-bold italic">{name}</span>
  );
  switch (conflictingExtensions.length) {
    case 0:
      return null;
    case 1:
      return formatName(conflictingExtensions[0].name);
    case 2:
      return (
        <>
          {formatName(conflictingExtensions[0].name)} and{" "}
          {formatName(conflictingExtensions[1].name)}
        </>
      );
    default:
      return (
        <>
          {conflictingExtensions.slice(0, -1).map((e, i) => (
            <React.Fragment key={e.name}>
              {i > 0 && ", "}
              {formatName(e.name)}
            </React.Fragment>
          ))}
          {", and "}
          {formatName(
            conflictingExtensions[conflictingExtensions.length - 1].name,
          )}
        </>
      );
  }
}

function IncompatibleExtensionsOverlay({
  conflictingInfo,
}: {
  conflictingInfo: ExtensionConflictReport;
}) {
  const ideMessenger = useContext(IdeMessengerContext);

  const incompatibleExtensionNames = generateIncompatibleExtensionsBlock(
    conflictingInfo.conflictingExtensions,
  );

  const openExtensionSettings = () => {
    ideMessenger.post("openExtensionSettings", {
      extensions: conflictingInfo.conflictingExtensions.map(
        (extension) => extension.id,
      ),
    });
  };

  return (
    <div className="fade-in-overlay absolute z-50 flex h-full w-full flex-col items-center justify-center">
      <GraniteLogo alt="Granite.Code Logo" className="mb-2 h-24 w-24" />
      <h1 className="mb-2 p-2 text-center text-xl">
        Incompatible Extension Enabled
      </h1>
      <p className="p-2 text-center font-medium text-gray-400">
        <span className="font-bold italic">
          {conflictingInfo.currentExtension.name}
        </span>{" "}
        cannot be used while the {incompatibleExtensionNames}{" "}
        {conflictingInfo.conflictingExtensions.length > 1
          ? "extensions are"
          : "extension is"}{" "}
        enabled. Please disable {incompatibleExtensionNames} from the extension{" "}
        <a onClick={openExtensionSettings} href="#">
          settings
        </a>
        .
      </p>
    </div>
  );
}

export default IncompatibleExtensionsOverlay;
