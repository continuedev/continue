// Flexprice SDK base URL and API key (use environment variables in production)
const FLEXPRICE_BASE_URL = 'https://api.cloud.flexprice.io/v1';

// Use global fetch for testing compatibility
const getFetch = (): typeof fetch => {
  return globalThis.fetch;
};

/**
 * Generic fetch wrapper with retry logic and error handling
 */
async function flexpriceFetch(endpoint: string, options: RequestInit = {}, retries: number = 3): Promise<unknown> {
  const url = `${FLEXPRICE_BASE_URL}${endpoint}`;
  const apiKey = process.env.FLEXPRICE_API_KEY;
  const config: RequestInit = {
    ...options,
    headers: {
      'x-api-key': apiKey || '',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const fetchFn = getFetch();
      const response = await fetchFn(url, config);
      if (!response.ok) {
        const errorData = await response.json() as { error?: { details?: string } };
        throw new Error(`Flexprice API Error ${response.status}: ${errorData.error?.details || 'Unknown error'}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

/**
 * Types based on Flexprice API docs
 */
interface SyncConfig {
  invoice: { inbound?: boolean; outbound?: boolean };
  plan: { inbound?: boolean; outbound?: boolean };
  subscription: { inbound?: boolean; outbound?: boolean };
}

interface CreateConnectionRequest {
  name: string;
  provider_type: 'flexprice' | 'stripe' | 's3';
  encrypted_secret_data?: Record<string, unknown>; // Specific to provider
  metadata?: Record<string, unknown>;
  sync_config: SyncConfig;
}

interface ConnectionResponse {
  id: string;
  name: string;
  provider_type: string;
  status: string;
  sync_config: SyncConfig;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  environment_id: string;
  tenant_id: string;
  metadata?: Record<string, unknown>;
}

interface UpdateConnectionRequest {
  name?: string;
  metadata?: Record<string, unknown>;
  sync_config?: SyncConfig;
}

interface SearchConnectionsRequest {
  connection_ids?: string[];
  end_time?: string;
  expand?: string;
  filters?: Array<{
    data_type: string;
    field: string;
    operator: string;
    value: unknown;
  }>;
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
  provider_type?: string;
  sort?: Array<{ direction: 'asc' | 'desc'; field: string }>;
  start_time?: string;
  status?: string;
}

/**
 * CREATE: Create a new connection
 */
export async function createConnection(data: CreateConnectionRequest): Promise<ConnectionResponse> {
  try {
    const response = await flexpriceFetch('/connections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response as ConnectionResponse;
  } catch (error) {
    console.error('Error creating connection:', error);
    throw error;
  }
}

/**
 * READ: List/Search connections
 */
export async function getConnections(searchParams: SearchConnectionsRequest = {}): Promise<{
  connections: ConnectionResponse[];
  limit: number;
  offset: number;
  total: number;
}> {
  try {
    const response = await flexpriceFetch('/connections/search', {
      method: 'POST',
      body: JSON.stringify(searchParams),
    });
    return response as {
      connections: ConnectionResponse[];
      limit: number;
      offset: number;
      total: number;
    };
  } catch (error) {
    console.error('Error fetching connections:', error);
    throw error;
  }
}

/**
 * UPDATE: Update an existing connection by ID
 */
export async function updateConnection(id: string, updates: UpdateConnectionRequest): Promise<ConnectionResponse> {
  try {
    const response = await flexpriceFetch(`/connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response as ConnectionResponse;
  } catch (error) {
    console.error('Error updating connection:', error);
    throw error;
  }
}

/**
 * DELETE: Delete a connection by ID (assumed based on CRUD convention)
 */
export async function deleteConnection(id: string): Promise<{ success: boolean }> {
  try {
    const response = await flexpriceFetch(`/connections/${id}`, {
      method: 'DELETE',
    });
    return { success: true }; // Assuming 204 No Content on success
  } catch (error) {
    console.error('Error deleting connection:', error);
    throw error;
  }
}

// Example usage (for demonstration):
/*
// Create a connection
const newConn = await createConnection({
  name: 'My Stripe Connection',
  provider_type: 'stripe',
  encrypted_secret_data: {
    stripe: {
      account_id: 'acct_123',
      publishable_key: 'pk_live_...',
      secret_key: 'sk_live_...',
      webhook_secret: 'whsec_...',
    },
  },
  sync_config: {
    invoice: { inbound: true, outbound: true },
    plan: { inbound: true, outbound: true },
    subscription: { inbound: true, outbound: true },
  },
});

// List connections
const connections = await getConnections({ limit: 10 });

// Update a connection
const updated = await updateConnection('conn-id', { name: 'Updated Name' });

// Delete a connection
await deleteConnection('conn-id');
*/
