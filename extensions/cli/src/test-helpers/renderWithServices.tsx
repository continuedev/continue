import { render } from "ink-testing-library";
import React from "react";

import { ServiceContainerProvider } from "../services/ServiceContainerContext.js";

import {
  createTestServiceContainer,
  TestServiceContainer,
} from "./testServiceContainer.js";

export interface RenderWithServicesOptions {
  services?: Record<string, any>;
  container?: TestServiceContainer;
}

export interface RenderWithServicesResult {
  container: TestServiceContainer;
  lastFrame: () => string | undefined;
  stdin: {
    write: (input: string) => void;
  };
  frames: string[];
  unmount: () => void;
  rerender: (element: React.ReactElement) => void;
}

export function renderWithServices(
  ui: React.ReactElement,
  options?: RenderWithServicesOptions,
): RenderWithServicesResult {
  const container = options?.container || createTestServiceContainer();

  // Register default services if provided
  if (options?.services) {
    Object.entries(options.services).forEach(([name, value]) => {
      container.register(name, () => Promise.resolve(value));
    });
  }

  const rendered = render(
    <ServiceContainerProvider container={container}>
      {ui}
    </ServiceContainerProvider>,
  );

  return {
    ...rendered,
    container,
  };
}
