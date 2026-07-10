import { z } from 'zod';

// Enums
export const NSFWLevel = z.enum(['None', 'Soft', 'Mature', 'X']);
export const ModelType = z.enum([
  'Checkpoint',
  'TextualInversion',
  'Hypernetwork',
  'AestheticGradient',
  'LORA',
  'LoCon',
  'DoRA',
  'Controlnet',
  'Upscaler',
  'MotionModule',
  'VAE',
  'TextEncoder',
  'UNet',
  'CLIPVision',
  'Poses',
  'Wildcards',
  'Workflows',
  'Detection',
  'VisionLanguage',
  'CLIP',
  'LLM',
  'Other'
]);

export const ModelMode = z.enum(['Archived', 'TakenDown']).nullable().optional();
export const SortOrder = z.enum(['Highest Rated', 'Most Downloaded', 'Newest']);  
export const TimePeriod = z.enum(['AllTime', 'Year', 'Month', 'Week', 'Day']);
export const ImageSort = z.enum(['Most Reactions', 'Most Comments', 'Newest']);
export const CommercialUse = z.enum(['None', 'Image', 'Rent', 'Sell']);
export const FileFormat = z.enum(['SafeTensor', 'PickleTensor', 'Diffusers', 'GGUF', 'Other']);
export const FileSize = z.enum(['full', 'pruned']);
export const FloatingPoint = z.enum(['fp8', 'fp16', 'bf16', 'fp32', 'nf4']);

// Base schemas - API has inconsistent metadata structure
export const MetadataSchema = z.object({
  totalItems: z.number().optional(),
  currentPage: z.number().optional(), 
  pageSize: z.number().optional(),
  totalPages: z.number().optional(),
  nextPage: z.string().optional(),
  prevPage: z.string().optional(),
  nextCursor: z.union([z.number(), z.string()]).optional(), // Sometimes string, sometimes number
});

export const StatsSchema = z.object({
  downloadCount: z.number().optional(),
  favoriteCount: z.number().optional(),
  commentCount: z.number().optional(),
  ratingCount: z.number().optional(),
  rating: z.number().optional(),
  cryCount: z.number().optional(),
  laughCount: z.number().optional(),
  likeCount: z.number().optional(),
  heartCount: z.number().optional(),
  dislikeCount: z.number().optional(),
});

export const CreatorSchema = z.object({
  username: z.string(),
  image: z.string().nullable().optional(),
  modelCount: z.number().optional(),
  link: z.string().optional(),
});

export const FileMetadataSchema = z.object({
  fp: FloatingPoint.nullable().optional(),
  size: FileSize.nullable().optional(),
  format: FileFormat.nullable().optional(),
}).optional();

export const ModelFileSchema = z.object({
  sizeKb: z.number().optional(),
  pickleScanResult: z.string().optional(),
  virusScanResult: z.string().optional(),
  scannedAt: z.string().nullable().optional(),
  primary: z.boolean().optional(),
  metadata: FileMetadataSchema,
});

export const ImageSchema = z.object({
  id: z.number().optional(), // Some API responses don't include ID
  url: z.string(),
  hash: z.string().nullable().optional(), // API returns null for some images
  width: z.number(),
  height: z.number(),
  nsfw: z.boolean().optional(),
  nsfwLevel: z.union([NSFWLevel, z.number()]).optional(), // API sometimes returns numbers
  createdAt: z.string().optional(),
  postId: z.number().optional(),
  stats: StatsSchema.optional(),
  meta: z.record(z.any()).nullable().optional(),
  username: z.string().optional(),
  modelVersionIds: z.array(z.number()).optional(),
  type: z.string().optional(),
  browsingLevel: z.number().optional(),
});

export const ModelVersionSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  downloadUrl: z.string().optional(),
  trainedWords: z.array(z.string()).optional(),
  files: z.array(ModelFileSchema).optional(),
  images: z.array(ImageSchema).optional(),
  stats: StatsSchema.optional(),
  index: z.number().optional(),
  baseModel: z.string().optional(),
});

export const ModelSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  type: ModelType,
  nsfw: z.boolean(),
  tags: z.array(z.string()),
  mode: ModelMode,
  creator: CreatorSchema.optional(), // Some models (e.g. certain utility types) omit creator
  stats: StatsSchema.optional(),
  modelVersions: z.array(ModelVersionSchema),
  poi: z.boolean().optional(),
});

export const TagSchema = z.object({
  name: z.string(),
  modelCount: z.number().optional(),
  link: z.string().optional(),
});

// API Response schemas
export const ModelsResponseSchema = z.object({
  items: z.array(ModelSchema),
  metadata: MetadataSchema,
});

export const ImagesResponseSchema = z.object({
  items: z.array(ImageSchema),
  metadata: MetadataSchema,
});

export const CreatorsResponseSchema = z.object({
  items: z.array(CreatorSchema),
  metadata: MetadataSchema,
});

export const TagsResponseSchema = z.object({
  items: z.array(TagSchema),
  metadata: MetadataSchema,
});

export const ModelVersionResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(), // API returns null when version has no description
  model: z.object({
    name: z.string(),
    type: ModelType,
    nsfw: z.boolean(),
    poi: z.boolean().optional(),
    mode: ModelMode,
  }),
  modelId: z.number(),
  createdAt: z.string(),
  downloadUrl: z.string(),
  trainedWords: z.array(z.string()),
  files: z.array(ModelFileSchema),
  stats: StatsSchema,
  images: z.array(ImageSchema),
});

// Enums discovery
export const EnumsResponseSchema = z.object({
  ModelType: z.array(z.string()).optional(),
  ModelFileType: z.array(z.string()).optional(),
  ActiveBaseModel: z.array(z.string()).optional(),
  BaseModel: z.array(z.string()).optional(),
  BaseModelType: z.array(z.string()).optional(),
});

// Current user
export const CurrentUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  tier: z.string().optional(),
  status: z.string().optional(),
  isMember: z.boolean().optional(),
  subscriptions: z.array(z.string()).optional(),
});

// User lookup
export const UserLookupItemSchema = z.object({
  id: z.number(),
  username: z.string(),
  avatarNsfw: z.union([z.string(), z.number()]).nullable().optional(), // docs say string, live API returns a number
});

export const UsersResponseSchema = z.object({
  items: z.array(UserLookupItemSchema),
});

// Generation permission check - empty entityIds returns [], otherwise a map of id -> boolean
export const PermissionsCheckResponseSchema = z.union([
  z.record(z.string(), z.boolean()),
  z.array(z.never()),
]);

// Vault
export const VaultSchema = z.object({
  userId: z.number(),
  storageKb: z.number().optional(),
  usedStorageKb: z.number().optional(),
  meta: z.record(z.any()).optional(),
  updatedAt: z.string().optional(),
});

export const VaultGetResponseSchema = z.object({
  vault: VaultSchema.nullable(),
});

export const VaultItemFileSchema = z.object({
  id: z.number().optional(),
  sizeKB: z.number().optional(),
  url: z.string().optional(),
  displayName: z.string().optional(),
});

export const VaultItemSchema = z.object({
  id: z.number().optional(),
  vaultId: z.number().optional(),
  status: z.string().optional(),
  modelVersionId: z.number().optional(),
  modelId: z.number().optional(),
  modelName: z.string().optional(),
  versionName: z.string().optional(),
  creatorId: z.number().optional(),
  creatorName: z.string().optional(),
  type: z.string().optional(),
  baseModel: z.string().optional(),
  category: z.string().nullable().optional(),
  modelSizeKb: z.number().optional(),
  detailsSizeKb: z.number().optional(),
  imagesSizeKb: z.number().optional(),
  createdAt: z.string().optional(),
  addedAt: z.string().optional(),
  refreshedAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  meta: z.record(z.any()).optional(),
  coverImageUrl: z.string().nullable().optional(),
  files: z.array(VaultItemFileSchema).optional(),
});

export const VaultAllResponseSchema = z.object({
  items: z.array(VaultItemSchema),
  totalItems: z.number().optional(),
  currentPage: z.number().optional(),
  pageSize: z.number().optional(),
  totalPages: z.number().optional(),
});

export const VaultCheckResponseSchema = z.array(
  z.object({
    modelVersionId: z.number(),
    vaultItem: VaultItemSchema.nullable(),
  })
);

export const VaultToggleResponseSchema = z.object({
  success: z.boolean(),
  vaultId: z.number().optional(),
});

// Minimal model version
export const ModelVersionMiniSchema = z.object({
  air: z.string().optional(),
  versionName: z.string().optional(),
  modelName: z.string().optional(),
  baseModel: z.string().optional(),
  availability: z.string().optional(),
  publishedAt: z.string().nullable().optional(),
  size: z.number().optional(),
  fileType: z.string().optional(),
  fileName: z.string().optional(),
  hashes: z.record(z.string()).optional(),
  downloadUrls: z.array(z.string()).optional(),
  format: z.string().optional(),
  canGenerate: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  requireAuth: z.boolean().optional(),
  checkPermission: z.boolean().optional(),
  earlyAccessEndsAt: z.string().nullable().optional(),
  freeTrialLimit: z.number().nullable().optional(),
  additionalResourceCharge: z.boolean().optional(),
  minor: z.boolean().optional(),
  sfwOnly: z.boolean().optional(),
});

// Bulk model-version hash lookups
export const BulkHashLookupResponseSchema = z.array(ModelVersionResponseSchema);

export const BulkHashIdsResponseSchema = z.array(
  z.object({
    modelVersionId: z.number(),
    hash: z.string(),
  })
);

// Type exports
export type Model = z.infer<typeof ModelSchema>;
export type ModelVersion = z.infer<typeof ModelVersionSchema>;
export type Image = z.infer<typeof ImageSchema>;
export type Creator = z.infer<typeof CreatorSchema>;
export type Tag = z.infer<typeof TagSchema>;
export type ModelsResponse = z.infer<typeof ModelsResponseSchema>;
export type ImagesResponse = z.infer<typeof ImagesResponseSchema>;
export type CreatorsResponse = z.infer<typeof CreatorsResponseSchema>;
export type TagsResponse = z.infer<typeof TagsResponseSchema>;
export type ModelVersionResponse = z.infer<typeof ModelVersionResponseSchema>;
export type EnumsResponse = z.infer<typeof EnumsResponseSchema>;
export type CurrentUser = z.infer<typeof CurrentUserSchema>;
export type UserLookupItem = z.infer<typeof UserLookupItemSchema>;
export type UsersResponse = z.infer<typeof UsersResponseSchema>;
export type PermissionsCheckResponse = z.infer<typeof PermissionsCheckResponseSchema>;
export type Vault = z.infer<typeof VaultSchema>;
export type VaultGetResponse = z.infer<typeof VaultGetResponseSchema>;
export type VaultItem = z.infer<typeof VaultItemSchema>;
export type VaultAllResponse = z.infer<typeof VaultAllResponseSchema>;
export type VaultCheckResponse = z.infer<typeof VaultCheckResponseSchema>;
export type VaultToggleResponse = z.infer<typeof VaultToggleResponseSchema>;
export type ModelVersionMini = z.infer<typeof ModelVersionMiniSchema>;
export type BulkHashLookupResponse = z.infer<typeof BulkHashLookupResponseSchema>;
export type BulkHashIdsResponse = z.infer<typeof BulkHashIdsResponseSchema>;
