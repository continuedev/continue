import GraniteLogo from "../granite/GraniteLogo";
function IncompatibleExtensionsOverlay() {
  return (
    <div className="fade-in-overlay absolute z-50 flex flex-col h-full w-full items-center justify-center">
      <GraniteLogo alt="Granite.Code Logo" className="mb-2 h-24 w-24" />
      <h1 className="mb-2 text-xl text-center p-2">Incompatible Extension Enabled</h1>
      <p className="text-center p-2 font-medium text-gray-400">Granite.Code cannot be used while the Continue extension is enabled. Please disable Continue from the extension settings.</p>
    </div>
  );
}

export default IncompatibleExtensionsOverlay;
