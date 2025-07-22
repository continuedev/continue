import { useEffect, useState } from 'react';
import { serviceContainer } from '../services/ServiceContainer.js';
import { ServiceResult } from '../services/types.js';

/**
 * React hook for consuming services reactively
 * Automatically subscribes to service changes and provides loading/error states
 */
export function useService<T>(serviceName: string): ServiceResult<T> & {
  reload: () => Promise<void>;
} {
  const [result, setResult] = useState<ServiceResult<T>>(() => 
    serviceContainer.getSync<T>(serviceName)
  );

  useEffect(() => {
    // Get initial state
    const initialResult = serviceContainer.getSync<T>(serviceName);
    setResult(initialResult);

    // Auto-load if idle
    if (initialResult.state === 'idle') {
      serviceContainer.load<T>(serviceName).catch(() => {
        // Error is handled by the service container and will trigger the error event
      });
    }

    // Set up event listeners
    const onLoading = () => {
      setResult(prev => ({ ...prev, state: 'loading', error: null }));
    };

    const onReady = (value: T) => {
      setResult({
        value,
        state: 'ready',
        error: null,
        lastUpdated: new Date()
      });
    };

    const onError = (error: Error) => {
      setResult(prev => ({
        ...prev,
        state: 'error',
        error,
        lastUpdated: new Date()
      }));
    };

    const onChanged = (value: T) => {
      setResult(prev => ({
        ...prev,
        value,
        error: null,
        lastUpdated: new Date()
      }));
    };

    // Subscribe to events
    serviceContainer.on(`${serviceName}:loading`, onLoading);
    serviceContainer.on(`${serviceName}:ready`, onReady);
    serviceContainer.on(`${serviceName}:error`, onError);
    serviceContainer.on(`${serviceName}:changed`, onChanged);

    // Cleanup
    return () => {
      serviceContainer.off(`${serviceName}:loading`, onLoading);
      serviceContainer.off(`${serviceName}:ready`, onReady);
      serviceContainer.off(`${serviceName}:error`, onError);
      serviceContainer.off(`${serviceName}:changed`, onChanged);
    };
  }, [serviceName]);

  const reload = async (): Promise<void> => {
    await serviceContainer.reload(serviceName);
  };

  return {
    ...result,
    reload
  };
}

/**
 * Hook for consuming multiple services
 */
export function useServices<T extends Record<string, any>>(
  serviceNames: (keyof T)[]
): { 
  services: Partial<T>; 
  loading: boolean; 
  error: Error | null;
  allReady: boolean;
} {
  const [services, setServices] = useState<Partial<T>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const updateState = () => {
      const newServices: Partial<T> = {};
      let hasLoading = false;
      let hasError: Error | null = null;
      let allReady = true;

      for (const serviceName of serviceNames) {
        const result = serviceContainer.getSync(serviceName as string);
        
        if (result.state === 'loading') {
          hasLoading = true;
          allReady = false;
        } else if (result.state === 'error') {
          hasError = result.error;
          allReady = false;
        } else if (result.state === 'idle') {
          allReady = false;
          // Auto-load idle services
          serviceContainer.load(serviceName as string).catch(() => {});
        } else if (result.state === 'ready' && result.value !== null) {
          newServices[serviceName] = result.value as T[keyof T];
        } else {
          allReady = false;
        }
      }

      setServices(newServices);
      setLoading(hasLoading);
      setError(hasError);
    };

    // Initial state
    updateState();

    // Set up listeners for all services
    const listeners: Array<() => void> = [];
    
    for (const serviceName of serviceNames) {
      const name = serviceName as string;
      
      const onAnyChange = () => updateState();
      
      serviceContainer.on(`${name}:loading`, onAnyChange);
      serviceContainer.on(`${name}:ready`, onAnyChange);
      serviceContainer.on(`${name}:error`, onAnyChange);
      serviceContainer.on(`${name}:changed`, onAnyChange);
      
      listeners.push(() => {
        serviceContainer.off(`${name}:loading`, onAnyChange);
        serviceContainer.off(`${name}:ready`, onAnyChange);
        serviceContainer.off(`${name}:error`, onAnyChange);
        serviceContainer.off(`${name}:changed`, onAnyChange);
      });
    }

    // Cleanup
    return () => {
      listeners.forEach(cleanup => cleanup());
    };
  }, [serviceNames.join(',')]);

  const allReady = serviceNames.every(name => 
    serviceContainer.isReady(name as string)
  );

  return { services, loading, error, allReady };
}