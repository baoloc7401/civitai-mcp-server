import { z } from 'zod';

// Schemas for the Civitai Orchestration API (https://orchestration.civitai.com).
// Unlike the site API these responses are generated from an OpenAPI spec, but
// they are heavily polymorphic (step bodies discriminate on $type, generation
// inputs on engine), so we keep everything optional + passthrough per
// .claude/rules/zod-schemas.md: an unseen field or status must never fail parse().

// Known workflow/step statuses (kept as z.string() on purpose — new statuses
// must not break parsing): unassigned, preparing, scheduled, processing,
// succeeded, failed, expired, canceled.

// Buzz cost breakdown returned on workflows (including whatif dry-runs).
export const WorkflowCostSchema = z.object({
  base: z.number().optional(),
  total: z.number().optional(),
  tips: z.any().optional(), // number in some responses, object breakdown in others
  factors: z.record(z.any()).nullable().optional(),
  fixed: z.record(z.any()).nullable().optional(),
  fees: z.record(z.any()).nullable().optional(),
}).passthrough();

// Output blob (image/video/audio). URLs are signed and expire.
export const OrchestrationBlobSchema = z.object({
  id: z.string().optional(),
  available: z.boolean().optional(),
  url: z.string().nullable().optional(),
  urlExpiresAt: z.string().nullable().optional(),
  previewUrl: z.string().nullable().optional(),
  previewUrlExpiresAt: z.string().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  nsfwLevel: z.union([z.string(), z.number()]).nullable().optional(),
  blockedReason: z.string().nullable().optional(),
  jobId: z.string().nullable().optional(),
  type: z.string().optional(),
}).passthrough();

export const WorkflowStepSchema = z.object({
  $type: z.string().optional(),
  name: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  estimatedProgressRate: z.number().nullable().optional(),
  // Polymorphic per $type — e.g. textToImage output is { images: Blob[] },
  // promptEnhancement output is { enhancedPrompt, issues, recommendations }.
  input: z.record(z.any()).nullable().optional(),
  output: z.record(z.any()).nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
}).passthrough();

// A workflow, as returned by SubmitWorkflow, GetWorkflow, and (in envelope
// form) the recipe endpoints. Everything optional: whatif dry-runs omit id
// and timestamps, and recipe responses may return a bare step output instead
// of a full envelope — passthrough lets the formatter probe for both shapes.
export const WorkflowSchema = z.object({
  id: z.string().nullable().optional(),
  status: z.string().optional(),
  createdAt: z.string().optional(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  cost: WorkflowCostSchema.nullable().optional(),
  transactions: z.any().optional(),
  tags: z.array(z.string()).nullable().optional(),
  steps: z.array(WorkflowStepSchema).optional(),
  metadata: z.record(z.any()).nullable().optional(),
  nsfwLevel: z.union([z.string(), z.number()]).nullable().optional(),
}).passthrough();

// GET /v2/consumer/workflows — paged list. Cursor field name verified live
// against the API; both spellings kept permissively.
export const WorkflowsPageSchema = z.object({
  items: z.array(WorkflowSchema).optional(),
  next: z.string().nullable().optional(),
  nextCursor: z.union([z.string(), z.number()]).nullable().optional(),
}).passthrough();

// GET /v2/resources/{air}
export const ResourceInfoSchema = z.object({
  air: z.string().optional(),
  size: z.number().optional(),
  hashes: z.record(z.string()).optional(),
  downloadUrls: z.array(z.string()).optional(),
  resourceName: z.string().nullable().optional(),
  versionName: z.string().nullable().optional(),
  canGenerate: z.boolean().optional(),
  checkPermission: z.boolean().optional(),
  earlyAccessEndsAt: z.string().nullable().optional(),
  freeTrialLimit: z.number().nullable().optional(),
  requiresAuthorization: z.boolean().nullable().optional(),
  fileFormat: z.string().optional(),
  hasMatureContentRestriction: z.boolean().optional(),
  hasNSFWContentRestriction: z.boolean().optional(),
  invalidateAt: z.string().nullable().optional(),
}).passthrough();

// Request-side shapes (plain interfaces, matching the ModelsParams style —
// the server validates these, we don't).

export interface RunOptions {
  /** true = validate + return a Buzz cost estimate without executing. */
  whatif?: boolean;
  /** Seconds to block waiting for completion (server caps requests at 100s). */
  wait?: number;
}

export interface WorkflowStepTemplate {
  $type: string;
  input: Record<string, unknown>;
  name?: string;
  priority?: string;
  timeout?: string;
  retries?: number;
  metadata?: Record<string, unknown>;
}

export interface SubmitWorkflowBody {
  steps: WorkflowStepTemplate[];
  tags?: string[];
  metadata?: Record<string, unknown>;
  /** Idempotency key, 1-128 chars [A-Za-z0-9_-]. */
  externalId?: string;
}

export interface TextToImageInput {
  prompt: string;
  negativePrompt?: string;
  /** AIR of the checkpoint, e.g. urn:air:sdxl:checkpoint:civitai:827184@2514310 */
  model?: string;
  /** AIR -> { strength?, triggerWord? } for LoRAs/embeddings. */
  additionalNetworks?: Record<string, { strength?: number; triggerWord?: string }>;
  scheduler?: string;
  steps?: number;
  cfgScale?: number;
  width?: number;
  height?: number;
  seed?: number;
  clipSkip?: number;
  quantity?: number;
  batchSize?: number;
  outputFormat?: string;
  sourceImage?: string;
  /** The API's own field name has this typo — kept verbatim. */
  sourceImageDenoiseStrenght?: number;
  [key: string]: unknown;
}

/** imageGen / videoGen inputs discriminate on engine; the per-engine fields
 *  are passed through untouched and validated server-side (whatif surfaces
 *  validation errors without spending Buzz). */
export interface EngineInput {
  engine: string;
  prompt?: string;
  [key: string]: unknown;
}

export interface ImageUpscalerInput {
  /** URL, DataURL, or base64 string. */
  image: string;
  /** Upscaler model AIR. */
  model?: string;
  /** 1-3; each repeat doubles the resolution. */
  numberOfRepeats?: number;
}

export interface PromptEnhancementInput {
  /** Target ecosystem: sd1, sdxl, flux, ltx2. */
  ecosystem: string;
  prompt: string;
  negativePrompt?: string;
  /** 0.0-1.0, default 0.7. */
  temperature?: number;
  instruction?: string;
  images?: string[];
}

export interface QueryWorkflowsParams {
  cursor?: string;
  take?: number;
  tags?: string[];
  query?: string;
  ascending?: boolean;
  fromDate?: string;
  toDate?: string;
  excludeFailed?: boolean;
}

// Type exports
export type WorkflowCost = z.infer<typeof WorkflowCostSchema>;
export type OrchestrationBlob = z.infer<typeof OrchestrationBlobSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowsPage = z.infer<typeof WorkflowsPageSchema>;
export type ResourceInfo = z.infer<typeof ResourceInfoSchema>;
