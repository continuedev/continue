import { useCallback, useEffect, useState } from "react";

import { useServiceContainer } from "../services/ServiceContainerContext.js";
import { ServiceResult } from "../services/types.js";

/**
 * React hook for consuming services reactively
 * Automatically subscribes to service changes and provides loading/error states
 */
export function useService<T>(serviceName: string): ServiceResult<T> & {
  reload: () => Promise<void>;
} {
  const container = useServiceContainer();
  const [result, setResult] = useState<ServiceResult<T>>(() =>
    container.getSync<T>(serviceName),
  );

  useEffect(() => {
    // Get initial state
    const initialResult = container.getSync<T>(serviceName);
    setResult(initialResult);

    // Auto-load if idle
    if (initialResult.state === "idle") {
      container.load<T>(serviceName).catch(() => {
        // Error is handled by the service container and will trigger the error event
      });
    }

    // Set up event listeners
    const onLoading = () => {
      setResult((prev) => ({ ...prev, state: "loading", error: null }));
    };

    const onReady = (value: T) => {
      setResult({
        value,
        state: "ready",
        error: null,
        lastUpdated: new Date(),
      });
    };

    const onError = (error: Error) => {
      setResult((prev) => ({
        ...prev,
        state: "error",
        error,
        lastUpdated: new Date(),
      }));
    };

    const onChanged = (value: T) => {
      setResult((prev) => ({
        ...prev,
        value,
        error: null,
        lastUpdated: new Date(),
      }));
    };

    // Subscribe to events
    container.on(`${serviceName}:loading`, onLoading);
    container.on(`${serviceName}:ready`, onReady);
    container.on(`${serviceName}:error`, onError);
    container.on(`${serviceName}:changed`, onChanged);

    // Cleanup
    return () => {
      container.off(`${serviceName}:loading`, onLoading);
      container.off(`${serviceName}:ready`, onReady);
      container.off(`${serviceName}:error`, onError);
      container.off(`${serviceName}:changed`, onChanged);
    };
  }, [serviceName, container]);

  const reload = async (): Promise<void> => {
    await container.reload(serviceName);
  };

  return {
    ...result,
    reload,
  };
}

/**
 * Hook for consuming multiple services
 */
export function useServices<T extends Record<string, any>>(
  serviceNames: (keyof T)[],
): {
  services: Partial<T>;
  loading: boolean;
  error: Error | null;
  allReady: boolean;
} {
  const container = useServiceContainer();

  const getServiceStates = useCallback(() => {
    const services: Partial<T> = {};
    let hasLoading = false;
    let hasError: Error | null = null;

    for (const serviceName of serviceNames) {
      const result = container.getSync(serviceName as string);

      if (result.state === "loading") {
        hasLoading = true;
      } else if (result.state === "error") {
        hasError = result.error;
      } else if (result.state === "idle") {
        // Auto-load idle services
        container.load(serviceName as string).catch(() => {});
      } else if (result.state === "ready" && result.value !== null) {
        services[serviceName] = result.value as T[keyof T];
      } else {
      }
    }

    return {
      hasLoading,
      hasError,
      services,
    };
  }, [serviceNames, container]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [services, setServices] = useState<Partial<T>>(
    getServiceStates().services,
  );

  useEffect(() => {
    // Set up listeners for all services
    const listeners: Array<() => void> = [];

    for (const serviceName of serviceNames) {
      const name = serviceName as string;

      const onAnyChange = () => {
        const { hasLoading, hasError, services } = getServiceStates();
        setLoading(hasLoading);
        setError(hasError);
        setServices(services);
      };

      container.on(`${name}:loading`, onAnyChange);
      container.on(`${name}:ready`, onAnyChange);
      container.on(`${name}:error`, onAnyChange);
      container.on(`${name}:changed`, onAnyChange);

      listeners.push(() => {
        container.off(`${name}:loading`, onAnyChange);
        container.off(`${name}:ready`, onAnyChange);
        container.off(`${name}:error`, onAnyChange);
        container.off(`${name}:changed`, onAnyChange);
      });
    }

    // Cleanup
    return () => {
      listeners.forEach((cleanup) => cleanup());
    };
  }, [serviceNames.join(","), container, getServiceStates]);

  const allReady = serviceNames.every((name) =>
    container.isReady(name as string),
  );

  return { services, loading, error, allReady };
}
