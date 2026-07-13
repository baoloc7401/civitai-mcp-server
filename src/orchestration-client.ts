import fetch from 'node-fetch';
import {
  Workflow,
  WorkflowSchema,
  WorkflowsPage,
  WorkflowsPageSchema,
  ResourceInfo,
  ResourceInfoSchema,
  RunOptions,
  SubmitWorkflowBody,
  TextToImageInput,
  EngineInput,
  ImageUpscalerInput,
  PromptEnhancementInput,
  QueryWorkflowsParams,
} from './orchestration-types.js';

// Client for the Civitai Orchestration API — the paid generation/compute
// backend at https://orchestration.civitai.com. Uses the same CIVITAI_API_KEY
// Bearer token as CivitaiClient, but unlike the site API every endpoint here
// requires it. Submitting workflows without whatif=true spends real Buzz.
export class CivitaiOrchestrationClient {
  private baseUrl = 'https://orchestration.civitai.com';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  // buildUrl / sleep / computeBackoffMs / makeRequest are duplicated by hand
  // from civitai-client.ts (kept in sync manually — see
  // .claude/rules/security.md). Not extracted into a shared base class:
  // this makeRequest diverges (204 handling, error-body reporting,
  // whatif-aware retryability) and the v1 client stays untouched.

  private buildUrl(endpoint: string, params: Record<string, any> = {}): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    // The API key is sent via the Authorization header in makeRequest, never
    // as a query param — URLs surface in tool output, logs, and error text.

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
  // responsive. Honors Retry-After when the server sends one.
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

  // Every orchestration endpoint 401s without a token; fail fast with a clear
  // message instead.
  private requireAuth(): void {
    if (!this.apiKey) {
      throw new Error('The Civitai Orchestration API requires CIVITAI_API_KEY to be set.');
    }
  }

  private async makeRequest<T>(
    url: string,
    schema: any,
    options: { method?: string; body?: unknown; retryable?: boolean } = {}
  ): Promise<T> {
    const method = options.method ?? 'GET';
    // Real workflow submissions must never auto-retry (a replay would charge
    // Buzz twice); whatif dry-runs and DELETE cancels are safe and opt in.
    const retryable = options.retryable ?? method === 'GET';
    const maxRetries = 2;

    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'civitai-mcp-server/1.1.0',
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
          // Orchestration returns JSON problem-details with actionable
          // validation messages — surface the body, unlike the site client.
          let detail = '';
          try {
            detail = (await response.text()).slice(0, 500);
          } catch {
            // body unreadable — status line alone will have to do
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}${detail ? ` — ${detail}` : ''}`);
        }

        // DELETE cancel returns 204 No Content.
        if (response.status === 204) {
          return undefined as T;
        }

        const data = await response.json();
        return schema.parse(data);
      } catch (error) {
        throw new Error(`Orchestration API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  // Workflows

  async submitWorkflow(body: SubmitWorkflowBody, opts: RunOptions = {}): Promise<Workflow> {
    this.requireAuth();
    const url = this.buildUrl('/v2/consumer/workflows', {
      whatif: opts.whatif || undefined,
      wait: opts.wait,
    });
    return this.makeRequest<Workflow>(url, WorkflowSchema, {
      method: 'POST',
      body,
      retryable: opts.whatif === true, // dry-runs are reads; real submits spend Buzz
    });
  }

  async getWorkflow(workflowId: string, wait?: number): Promise<Workflow> {
    this.requireAuth();
    const url = this.buildUrl(`/v2/consumer/workflows/${encodeURIComponent(workflowId)}`, { wait });
    return this.makeRequest<Workflow>(url, WorkflowSchema);
  }

  async queryWorkflows(params: QueryWorkflowsParams = {}): Promise<WorkflowsPage> {
    this.requireAuth();
    const url = this.buildUrl('/v2/consumer/workflows', params);
    return this.makeRequest<WorkflowsPage>(url, WorkflowsPageSchema);
  }

  async cancelWorkflow(workflowId: string): Promise<void> {
    this.requireAuth();
    const url = this.buildUrl(`/v2/consumer/workflows/${encodeURIComponent(workflowId)}`);
    await this.makeRequest<void>(url, WorkflowSchema.optional(), {
      method: 'DELETE',
      retryable: true, // cancel is idempotent
    });
  }

  // Typed generation helpers — each submits a single-step workflow through
  // submitWorkflow rather than the /v2/consumer/recipes/* shortcuts. Verified
  // live: the recipe endpoints return a bare step output with no workflow id
  // (nothing to poll for long jobs) and their whatif responses carry no cost,
  // while the workflows endpoint returns the full envelope (id, cost,
  // transactions.insufficientBuzz) in both modes.

  private runStep(type: string, input: Record<string, unknown>, opts: RunOptions = {}): Promise<Workflow> {
    return this.submitWorkflow({ steps: [{ $type: type, input }] }, opts);
  }

  async textToImage(input: TextToImageInput, opts: RunOptions = {}): Promise<Workflow> {
    // The API requires cfgScale/seed and defaults model to an SD1.5
    // checkpoint; fill them here so the tool only requires a prompt.
    const body = {
      cfgScale: 7.5,
      seed: Math.floor(Math.random() * 4294967295),
      ...input,
    };
    return this.runStep('textToImage', body, opts);
  }

  async imageGen(input: EngineInput, opts: RunOptions = {}): Promise<Workflow> {
    return this.runStep('imageGen', input, opts);
  }

  async videoGen(input: EngineInput, opts: RunOptions = {}): Promise<Workflow> {
    return this.runStep('videoGen', input, opts);
  }

  async upscaleImage(input: ImageUpscalerInput, opts: RunOptions = {}): Promise<Workflow> {
    return this.runStep('imageUpscaler', input as unknown as Record<string, unknown>, opts);
  }

  async enhancePrompt(input: PromptEnhancementInput, opts: RunOptions = {}): Promise<Workflow> {
    return this.runStep('promptEnhancement', input as unknown as Record<string, unknown>, opts);
  }

  // Resources

  async getResource(air: string): Promise<ResourceInfo> {
    this.requireAuth();
    const url = this.buildUrl(`/v2/resources/${encodeURIComponent(air)}`);
    return this.makeRequest<ResourceInfo>(url, ResourceInfoSchema);
  }
}
