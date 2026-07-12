import fetch from 'node-fetch';
import {
  ModelsResponse,
  ImagesResponse,
  CreatorsResponse,
  TagsResponse,
  Model,
  ModelVersionResponse,
  ModelsResponseSchema,
  ImagesResponseSchema,
  CreatorsResponseSchema,
  TagsResponseSchema,
  ModelSchema,
  ModelVersionResponseSchema,
  ModelType,
  SortOrder,
  TimePeriod,
  ImageSort,
  NSFWLevel,
  CommercialUse,
  EnumsResponse,
  EnumsResponseSchema,
  CurrentUser,
  CurrentUserSchema,
  UsersResponse,
  UsersResponseSchema,
  PermissionsCheckResponse,
  PermissionsCheckResponseSchema,
  VaultGetResponse,
  VaultGetResponseSchema,
  VaultAllResponse,
  VaultAllResponseSchema,
  VaultCheckResponse,
  VaultCheckResponseSchema,
  VaultToggleResponse,
  VaultToggleResponseSchema,
  ModelVersionMini,
  ModelVersionMiniSchema,
  BulkHashLookupResponse,
  BulkHashLookupResponseSchema,
  BulkHashIdsResponse,
  BulkHashIdsResponseSchema,
} from './types.js';

export interface ModelsParams {
  limit?: number;
  page?: number;
  query?: string;
  tag?: string;
  username?: string;
  types?: string[];
  sort?: string;
  period?: string;
  favorites?: boolean;
  hidden?: boolean;
  primaryFileOnly?: boolean;
  allowNoCredit?: boolean;
  allowDerivatives?: boolean;
  allowDifferentLicenses?: boolean;
  allowCommercialUse?: string;
  nsfw?: boolean;
  supportsGeneration?: boolean;
  ids?: number[];
  baseModels?: string[];
  checkpointType?: string;
  fromPlatform?: boolean;
  earlyAccess?: boolean;
  cursor?: string;
}

export interface UsersParams {
  ids?: number[];
  query?: string;
}

export interface PermissionsCheckParams {
  entityIds: number[];
  entityType?: string;
  permission?: string;
  userId?: number;
}

export interface VaultItemsParams {
  limit?: number;
  page?: number;
  query?: string;
  types?: string[];
  categories?: string[];
  baseModels?: string[];
  dateCreatedFrom?: string;
  dateCreatedTo?: string;
  dateAddedFrom?: string;
  dateAddedTo?: string;
  sort?: string;
}

export interface ImagesParams {
  limit?: number;
  page?: number;
  postId?: number;
  modelId?: number;
  modelVersionId?: number;
  username?: string;
  nsfw?: boolean | string;
  sort?: string;
  period?: string;
}

export interface CreatorsParams {
  limit?: number;
  page?: number;
  query?: string;
}

export interface TagsParams {
  limit?: number;
  page?: number;
  query?: string;
}

export class CivitaiClient {
  private baseUrl = 'https://civitai.com/api/v1';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private buildUrl(endpoint: string, params: Record<string, any> = {}): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    // The API key is sent via the Authorization header in makeRequest, never
    // as a query param — URLs surface in tool output, logs, and error text.

    // Add other parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, v.toString()));
        } else {
          url.searchParams.set(key, value.toString());
        }
      }
    });

    return url.toString();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Exponential backoff with jitter, capped low so a single tool call stays
  // responsive. Honors Retry-After when the server sends one — ignoring an
  // explicit backpressure signal in favor of our own schedule is exactly the
  // kind of client behavior that gets flagged as abusive.
  private computeBackoffMs(attempt: number, retryAfterHeader: string | null): number {
    const cap = 3000;
    if (retryAfterHeader) {
      const seconds = Number(retryAfterHeader);
      if (!Number.isNaN(seconds)) {
        return Math.min(seconds * 1000, cap);
      }
      const untilDate = Date.parse(retryAfterHeader) - Date.now();
      if (!Number.isNaN(untilDate) && untilDate > 0) {
        return Math.min(untilDate, cap);
      }
    }
    const base = 300 * 3 ** attempt; // 300ms, then 900ms
    return Math.min(base + Math.random() * base * 0.3, cap);
  }

  private async makeRequest<T>(
    url: string,
    schema: any,
    options: { method?: string; body?: unknown; retryable?: boolean } = {}
  ): Promise<T> {
    const method = options.method ?? 'GET';
    // POST is only safe to auto-retry when it's actually a read (e.g. a bulk
    // hash lookup sent as POST for body size). Mutations like vault toggling
    // must opt out, since replaying them on a lost response would flip state
    // back rather than confirm it.
    const retryable = options.retryable ?? method === 'GET';
    const maxRetries = 2;

    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'civitai-mcp-server/1.0.0',
            ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
          },
          ...(options.body !== undefined && { body: JSON.stringify(options.body) })
        });

        if (!response.ok) {
          const transient = response.status === 502 || response.status === 503 || response.status === 504;
          if (retryable && transient && attempt < maxRetries) {
            await this.sleep(this.computeBackoffMs(attempt, response.headers.get('retry-after')));
            continue;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return schema.parse(data);
      } catch (error) {
        throw new Error(`API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  // Endpoints under /me, /vault/* require a token; fail fast with a clear
  // message instead of letting these 401 with no context.
  private requireAuth(): void {
    if (!this.apiKey) {
      throw new Error('This endpoint requires CIVITAI_API_KEY to be set.');
    }
  }

  async getModels(params: ModelsParams = {}): Promise<ModelsResponse> {
    const url = this.buildUrl('/models', params);
    return this.makeRequest<ModelsResponse>(url, ModelsResponseSchema);
  }

  async getModel(modelId: number): Promise<Model> {
    const url = this.buildUrl(`/models/${modelId}`);
    return this.makeRequest<Model>(url, ModelSchema);
  }

  async getModelVersion(modelVersionId: number): Promise<ModelVersionResponse> {
    const url = this.buildUrl(`/model-versions/${modelVersionId}`);
    return this.makeRequest<ModelVersionResponse>(url, ModelVersionResponseSchema);
  }

  async getModelVersionByHash(hash: string): Promise<ModelVersionResponse> {
    const url = this.buildUrl(`/model-versions/by-hash/${hash}`);
    return this.makeRequest<ModelVersionResponse>(url, ModelVersionResponseSchema);
  }

  async getImages(params: ImagesParams = {}): Promise<ImagesResponse> {
    const url = this.buildUrl('/images', params);
    return this.makeRequest<ImagesResponse>(url, ImagesResponseSchema);
  }

  async getCreators(params: CreatorsParams = {}): Promise<CreatorsResponse> {
    const url = this.buildUrl('/creators', params);
    return this.makeRequest<CreatorsResponse>(url, CreatorsResponseSchema);
  }

  async getTags(params: TagsParams = {}): Promise<TagsResponse> {
    const url = this.buildUrl('/tags', params);
    return this.makeRequest<TagsResponse>(url, TagsResponseSchema);
  }

  // Helper methods for downloading
  getDownloadUrl(modelVersionId: number): string {
    // Never embed the API key here: this URL is returned to the caller in
    // plain text. Authenticated downloads must append their own token.
    return `${this.baseUrl}/download/models/${modelVersionId}`;
  }

  // Search helper methods
  async searchModels(query: string, options: Partial<ModelsParams> = {}): Promise<ModelsResponse> {
    return this.getModels({ query, ...options });
  }

  async searchModelsByTag(tag: string, options: Partial<ModelsParams> = {}): Promise<ModelsResponse> {
    return this.getModels({ tag, ...options });
  }

  async searchModelsByCreator(username: string, options: Partial<ModelsParams> = {}): Promise<ModelsResponse> {
    return this.getModels({ username, ...options });
  }

  async getModelsByType(type: string, options: Partial<ModelsParams> = {}): Promise<ModelsResponse> {
    return this.getModels({ types: [type], ...options });
  }

  // Utility methods
  async getPopularModels(period: string = 'Week', limit: number = 20): Promise<ModelsResponse> {
    return this.getModels({
      sort: 'Most Downloaded',
      period,
      limit,
      nsfw: false
    });
  }

  async getLatestModels(limit: number = 20): Promise<ModelsResponse> {
    return this.getModels({
      sort: 'Newest',
      limit,
      nsfw: false
    });
  }

  async getTopRatedModels(period: string = 'AllTime', limit: number = 20): Promise<ModelsResponse> {
    return this.getModels({
      sort: 'Highest Rated',
      period,
      limit,
      nsfw: false
    });
  }

  // Enums
  async getEnums(): Promise<EnumsResponse> {
    const url = this.buildUrl('/enums');
    return this.makeRequest<EnumsResponse>(url, EnumsResponseSchema);
  }

  // Users
  async getCurrentUser(): Promise<CurrentUser> {
    this.requireAuth();
    const url = this.buildUrl('/me');
    return this.makeRequest<CurrentUser>(url, CurrentUserSchema);
  }

  async lookupUsers(params: UsersParams = {}): Promise<UsersResponse> {
    const url = this.buildUrl('/users', {
      ids: params.ids?.join(','),
      query: params.query,
    });
    return this.makeRequest<UsersResponse>(url, UsersResponseSchema);
  }

  // Permissions
  async checkPermissions(params: PermissionsCheckParams): Promise<PermissionsCheckResponse> {
    const url = this.buildUrl('/permissions/check', {
      entityIds: params.entityIds.join(','),
      entityType: params.entityType,
      permission: params.permission,
      userId: params.userId,
    });
    return this.makeRequest<PermissionsCheckResponse>(url, PermissionsCheckResponseSchema);
  }

  // Vault
  async getVault(): Promise<VaultGetResponse> {
    this.requireAuth();
    const url = this.buildUrl('/vault/get');
    return this.makeRequest<VaultGetResponse>(url, VaultGetResponseSchema);
  }

  async getVaultItems(params: VaultItemsParams = {}): Promise<VaultAllResponse> {
    this.requireAuth();
    const url = this.buildUrl('/vault/all', {
      limit: params.limit,
      page: params.page,
      query: params.query,
      types: params.types?.join(','),
      categories: params.categories?.join(','),
      baseModels: params.baseModels?.join(','),
      dateCreatedFrom: params.dateCreatedFrom,
      dateCreatedTo: params.dateCreatedTo,
      dateAddedFrom: params.dateAddedFrom,
      dateAddedTo: params.dateAddedTo,
      sort: params.sort,
    });
    return this.makeRequest<VaultAllResponse>(url, VaultAllResponseSchema);
  }

  async checkVaultItems(modelVersionIds: number[]): Promise<VaultCheckResponse> {
    this.requireAuth();
    const url = this.buildUrl('/vault/check-vault', {
      modelVersionIds: modelVersionIds.join(','),
    });
    return this.makeRequest<VaultCheckResponse>(url, VaultCheckResponseSchema);
  }

  async toggleVaultVersion(modelVersionId: number): Promise<VaultToggleResponse> {
    this.requireAuth();
    const url = this.buildUrl('/vault/toggle-version', { modelVersionId });
    return this.makeRequest<VaultToggleResponse>(url, VaultToggleResponseSchema, { method: 'POST' });
  }

  // Bulk model-version hash lookups
  async getModelVersionsByHash(hashes: string[]): Promise<BulkHashLookupResponse> {
    if (hashes.length === 0 || hashes.length > 100) {
      throw new Error('hashes must contain between 1 and 100 SHA256 hashes.');
    }
    const url = this.buildUrl('/model-versions/by-hash');
    return this.makeRequest<BulkHashLookupResponse>(url, BulkHashLookupResponseSchema, {
      method: 'POST',
      body: hashes,
      retryable: true, // read-only lookup, just POSTed for body size
    });
  }

  async getModelVersionIdsByHash(hashes: string[]): Promise<BulkHashIdsResponse> {
    if (hashes.length === 0 || hashes.length > 10000) {
      throw new Error('hashes must contain between 1 and 10,000 SHA256 hashes.');
    }
    const url = this.buildUrl('/model-versions/by-hash/ids');
    return this.makeRequest<BulkHashIdsResponse>(url, BulkHashIdsResponseSchema, {
      method: 'POST',
      body: hashes,
      retryable: true, // read-only lookup, just POSTed for body size
    });
  }

  async getModelVersionMini(modelVersionId: number, epoch?: number): Promise<ModelVersionMini> {
    const url = this.buildUrl(`/model-versions/mini/${modelVersionId}`, { epoch });
    return this.makeRequest<ModelVersionMini>(url, ModelVersionMiniSchema);
  }
}
