// Polyfill fetch for Node.js test environment
import fetch from 'node-fetch';
globalThis.fetch = fetch as any;

import { jest } from '@jest/globals';
import { createConnection, getConnections, updateConnection, deleteConnection } from './connections';

// Mock the fetch module
describe('Flexprice Connections API CRUD Operations', () => {
  const mockResponse = {
    id: 'conn-test-id',
    name: 'Test Connection',
    provider_type: 'stripe',
    status: 'published',
    sync_config: {
      invoice: { inbound: true, outbound: true },
      plan: { inbound: true, outbound: true },
      subscription: { inbound: true, outbound: true },
    },
    created_at: '2023-10-27T10:00:00Z',
    created_by: 'test-user',
    updated_at: '2023-10-27T10:00:00Z',
    updated_by: 'test-user',
    environment_id: 'env-test',
    tenant_id: 'tenant-test',
  };

  const mockConnectionsList = {
    connections: [mockResponse],
    limit: 1,
    offset: 0,
    total: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FLEXPRICE_API_KEY = 'test-api-key';
    // Mock fetch globally
    globalThis.fetch = jest.fn() as any;
  });

  describe('createConnection', () => {
    it('should create a new connection successfully', async () => {
      (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const createData = {
        name: 'Test Connection',
        provider_type: 'stripe' as const,
        sync_config: {
          invoice: { inbound: true, outbound: true },
          plan: { inbound: true, outbound: true },
          subscription: { inbound: true, outbound: true },
        },
      };

      const result = await createConnection(createData);
      expect(result).toEqual(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledWith('https://api.cloud.flexprice.io/v1/connections', {
        method: 'POST',
        body: JSON.stringify(createData),
        headers: {
          'x-api-key': 'test-api-key',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle API errors', async () => {
      (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { details: 'Invalid request' } }),
      } as any);

      const createData = {
        name: '',
        provider_type: 'stripe' as const,
        sync_config: {
          invoice: { inbound: true, outbound: true },
          plan: { inbound: true, outbound: true },
          subscription: { inbound: true, outbound: true },
        },
      };

      await expect(createConnection(createData)).rejects.toThrow('Flexprice API Error 400: Invalid request');
    }, 10000);

    it('should handle 401 Unauthorized errors', async () => {
      (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { details: 'Unauthorized' } }),
      } as any);

      const createData = {
        name: 'Test Connection',
        provider_type: 'stripe' as const,
        sync_config: {
          invoice: { inbound: true, outbound: true },
          plan: { inbound: true, outbound: true },
          subscription: { inbound: true, outbound: true },
        },
      };

      await expect(createConnection(createData)).rejects.toThrow('Flexprice API Error 401: Unauthorized');
    }, 10000);

    it('should handle 403 Forbidden errors', async () => {
      (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { details: 'Forbidden' } }),
      } as any);

      const createData = {
        name: 'Test Connection',
        provider_type: 'stripe' as const,
        sync_config: {
          invoice: { inbound: true, outbound: true },
          plan: { inbound: true, outbound: true },
          subscription: { inbound: true, outbound: true },
        },
      };

      await expect(createConnection(createData)).rejects.toThrow('Flexprice API Error 403: Forbidden');
    }, 10000);

    it('should handle 500 Internal Server Error', async () => {
      (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { details: 'Internal Server Error' } }),
      } as any);

      const createData = {
        name: 'Test Connection',
        provider_type: 'stripe' as const,
        sync_config: {
          invoice: { inbound: true, outbound: true },
          plan: { inbound: true, outbound: true },
          subscription: { inbound: true, outbound: true },
        },
      };

      await expect(createConnection(createData)).rejects.toThrow('Flexprice API Error 500: Internal Server Error');
    }, 10000);

    it('should retry on network errors', async () => {
      (globalThis.fetch as jest.MockedFunction<typeof fetch>)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as any);

      const createData = {
        name: 'Test Connection',
        provider_type: 'stripe' as const,
        sync_config: {
          invoice: { inbound: true, outbound: true },
          plan: { inbound: true, outbound: true },
          subscription: { inbound: true, outbound: true },
        },
      };

      const result = await createConnection(createData);
      expect(result).toEqual(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    }, 10000);
  });
  
  describe('Error Scenarios', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      globalThis.fetch = jest.fn() as any;
    });
  
    describe('Missing API Key', () => {
      it('should handle missing API key', async () => {
        delete process.env.FLEXPRICE_API_KEY;

        (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: { details: 'Unauthorized' } }),
        } as any);

        const createData = {
          name: 'Test Connection',
          provider_type: 'stripe' as const,
          sync_config: {
            invoice: { inbound: true, outbound: true },
            plan: { inbound: true, outbound: true },
            subscription: { inbound: true, outbound: true },
          },
        };

        await expect(createConnection(createData)).rejects.toThrow('Flexprice API Error 401: Unauthorized');
      }, 10000);
    });
  
    describe('Different Provider Types', () => {
      it('should create connection with flexprice provider', async () => {
        process.env.FLEXPRICE_API_KEY = 'test-api-key';
  
        (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockResponse, provider_type: 'flexprice' }),
        } as any);
  
        const createData = {
          name: 'Flexprice Connection',
          provider_type: 'flexprice' as const,
          sync_config: {
            invoice: { inbound: true, outbound: true },
            plan: { inbound: true, outbound: true },
            subscription: { inbound: true, outbound: true },
          },
        };
  
        const result = await createConnection(createData);
        expect(result.provider_type).toBe('flexprice');
      });
  
      it('should create connection with s3 provider', async () => {
        (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockResponse, provider_type: 's3' }),
        } as any);
  
        const createData = {
          name: 'S3 Connection',
          provider_type: 's3' as const,
          sync_config: {
            invoice: { inbound: true, outbound: true },
            plan: { inbound: true, outbound: true },
            subscription: { inbound: true, outbound: true },
          },
        };
  
        const result = await createConnection(createData);
        expect(result.provider_type).toBe('s3');
      });
    });
  
    describe('Sync Configuration Variations', () => {
      it('should handle partial sync config', async () => {
        (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockResponse,
            sync_config: {
              invoice: { inbound: true },
              plan: { outbound: false },
              subscription: { inbound: false, outbound: true },
            },
          }),
        } as any);
  
        const createData = {
          name: 'Partial Sync Connection',
          provider_type: 'stripe' as const,
          sync_config: {
            invoice: { inbound: true },
            plan: { outbound: false },
            subscription: { inbound: false, outbound: true },
          },
        };
  
        const result = await createConnection(createData);
        expect(result.sync_config.invoice.inbound).toBe(true);
        expect(result.sync_config.plan.outbound).toBe(false);
        expect(result.sync_config.subscription.inbound).toBe(false);
        expect(result.sync_config.subscription.outbound).toBe(true);
      });
    });
  
    describe('Network and Timeout Scenarios', () => {
      it('should handle network timeout in getConnections', async () => {
        (globalThis.fetch as jest.MockedFunction<typeof fetch>)
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockRejectedValueOnce(new Error('Network timeout'));

        await expect(getConnections()).rejects.toThrow('Network timeout');
        expect(globalThis.fetch).toHaveBeenCalledTimes(3);
      }, 10000);
  
      it('should handle network timeout in updateConnection', async () => {
        (globalThis.fetch as jest.MockedFunction<typeof fetch>)
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockRejectedValueOnce(new Error('Network timeout'));

        const updates = { name: 'Updated Name' };
        await expect(updateConnection('conn-test-id', updates)).rejects.toThrow('Network timeout');
        expect(globalThis.fetch).toHaveBeenCalledTimes(3);
      }, 10000);
  
      it('should handle network timeout in deleteConnection', async () => {
        (globalThis.fetch as jest.MockedFunction<typeof fetch>)
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockRejectedValueOnce(new Error('Network timeout'));

        await expect(deleteConnection('conn-test-id')).rejects.toThrow('Network timeout');
        expect(globalThis.fetch).toHaveBeenCalledTimes(3);
      }, 10000);
    });
  
    describe('Malformed Data', () => {
      it('should handle malformed JSON response', async () => {
        (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: true,
          json: async () => {
            throw new Error('Invalid JSON');
          },
        } as any);

        await expect(getConnections()).rejects.toThrow('Invalid JSON');
      }, 10000);
  
      it('should handle unexpected response structure', async () => {
        (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: true,
          json: async () => 'unexpected string response',
        } as any);
  
        const result = await getConnections();
        expect(result).toBe('unexpected string response');
      });
    });
  });
  
  describe('getConnections', () => {
    it('should fetch connections successfully', async () => {
      (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockConnectionsList,
      } as any);

      const searchParams = { limit: 10, status: 'published' };
      const result = await getConnections(searchParams);
      expect(result).toEqual(mockConnectionsList);
      expect(globalThis.fetch).toHaveBeenCalledWith('https://api.cloud.flexprice.io/v1/connections/search', {
        method: 'POST',
        body: JSON.stringify(searchParams),
        headers: {
          'x-api-key': 'test-api-key',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should use default empty params when none provided', async () => {
      (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockConnectionsList,
      } as any);

      await getConnections();
      expect(globalThis.fetch).toHaveBeenCalledWith('https://api.cloud.flexprice.io/v1/connections/search', expect.objectContaining({
        body: JSON.stringify({}),
      }));
    });

    it('should handle search with multiple parameters', async () => {
      (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockConnectionsList,
      } as any);

      const searchParams = {
        limit: 20,
        offset: 10,
        status: 'published',
        provider_type: 'stripe',
        order: 'desc' as const,
      };
      const result = await getConnections(searchParams);
      expect(result).toEqual(mockConnectionsList);
      expect(globalThis.fetch).toHaveBeenCalledWith('https://api.cloud.flexprice.io/v1/connections/search', {
        method: 'POST',
        body: JSON.stringify(searchParams),
        headers: {
          'x-api-key': 'test-api-key',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle search with filters', async () => {
      (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockConnectionsList,
      } as any);

      const searchParams = {
        filters: [
          {
            data_type: 'connection',
            field: 'name',
            operator: 'contains',
            value: 'test',
          },
        ],
        limit: 5,
      };
      const result = await getConnections(searchParams);
      expect(result).toEqual(mockConnectionsList);
      expect(globalThis.fetch).toHaveBeenCalledWith('https://api.cloud.flexprice.io/v1/connections/search', {
        method: 'POST',
        body: JSON.stringify(searchParams),
        headers: {
          'x-api-key': 'test-api-key',
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('updateConnection', () => {
    it('should update a connection successfully', async () => {
      (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockResponse, name: 'Updated Connection' }),
      } as any);

      const updates = { name: 'Updated Connection' };
      const result = await updateConnection('conn-test-id', updates);
      expect(result.name).toBe('Updated Connection');
      expect(globalThis.fetch).toHaveBeenCalledWith('https://api.cloud.flexprice.io/v1/connections/conn-test-id', {
        method: 'PUT',
        body: JSON.stringify(updates),
        headers: {
          'x-api-key': 'test-api-key',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle partial updates', async () => {
      (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockResponse, sync_config: { ...mockResponse.sync_config, plan: { inbound: false, outbound: true } } }),
      } as any);

      const updates = { sync_config: { invoice: { inbound: true, outbound: true }, plan: { inbound: false, outbound: true }, subscription: { inbound: true, outbound: true } } };
      const result = await updateConnection('conn-test-id', updates);
      expect(result.sync_config.plan.inbound).toBe(false);
      expect(result.sync_config.plan.outbound).toBe(true);
    });

    it('should handle update errors', async () => {
      (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { details: 'Connection not found' } }),
      } as any);

      const updates = { name: 'Updated Name' };
      await expect(updateConnection('non-existent-id', updates)).rejects.toThrow('Flexprice API Error 404: Connection not found');
    }, 10000);
  });

  describe('deleteConnection', () => {
    it('should delete a connection successfully', async () => {
      (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as any);

      const result = await deleteConnection('conn-test-id');
      expect(result).toEqual({ success: true });
      expect(globalThis.fetch).toHaveBeenCalledWith('https://api.cloud.flexprice.io/v1/connections/conn-test-id', {
        method: 'DELETE',
        headers: {
          'x-api-key': 'test-api-key',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle delete errors', async () => {
      (globalThis.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { details: 'Connection not found' } }),
      } as any);

      await expect(deleteConnection('non-existent-id')).rejects.toThrow('Flexprice API Error 404: Connection not found');
    }, 10000);
  });
});
