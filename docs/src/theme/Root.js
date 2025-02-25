import React from "react";

function TabsSetDefaultValue() {
  React.useEffect(() => {
    // Only set if it's not already set
    if (!localStorage.getItem("docusaurus.tab.config-example")) {
      localStorage.setItem("docusaurus.tab.config-example", "json");
    }
  }, []);

  return null;
}

export default function Root({ children }) {
  return (
    <>
      <TabsSetDefaultValue />
      {children}
    </>
  );
}
