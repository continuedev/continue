import React, { createContext, useContext } from "react";

import { ServiceContainer } from "./ServiceContainer.js";

import { serviceContainer as defaultContainer } from "./index.js";

const ServiceContainerContext =
  createContext<ServiceContainer>(defaultContainer);

export function ServiceContainerProvider({
  children,
  container = defaultContainer,
}: {
  children: React.ReactNode;
  container?: ServiceContainer;
}) {
  return (
    <ServiceContainerContext.Provider value={container}>
      {children}
    </ServiceContainerContext.Provider>
  );
}

export function useServiceContainer() {
  return useContext(ServiceContainerContext);
}
