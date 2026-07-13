#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { CivitaiClient } from './civitai-client.js';
import { CivitaiOrchestrationClient } from './orchestration-client.js';
import { Workflow, WorkflowCost, OrchestrationBlob } from './orchestration-types.js';
import { z } from 'zod';

class CivitaiMCPServer {
  private server: Server;
  private client: CivitaiClient;
  private orchestrationClient: CivitaiOrchestrationClient;

  constructor() {
    this.server = new Server(
      {
        name: 'civitai-mcp-server',
        version: '1.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize clients with API key from environment variable. The same
    // token serves both the site API (civitai.com/api/v1) and the
    // Orchestration API (orchestration.civitai.com).
    const apiKey = process.env.CIVITAI_API_KEY;
    this.client = new CivitaiClient(apiKey);
    this.orchestrationClient = new CivitaiOrchestrationClient(apiKey);

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getTools(),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_models':
            return await this.searchModels(args);
          case 'get_model':
            return await this.getModel(args);
          case 'get_model_version':
            return await this.getModelVersion(args);
          case 'get_model_version_by_hash':
            return await this.getModelVersionByHash(args);
          case 'browse_images':
            return await this.browseImages(args);
          case 'get_creators':
            return await this.getCreators(args);
          case 'get_tags':
            return await this.getTags(args);
          case 'get_popular_models':
            return await this.getPopularModels(args);
          case 'get_latest_models':
            return await this.getLatestModels(args);
          case 'get_top_rated_models':
            return await this.getTopRatedModels(args);
          case 'search_models_by_tag':
            return await this.searchModelsByTag(args);
          case 'search_models_by_creator':
            return await this.searchModelsByCreator(args);
          case 'get_models_by_type':
            return await this.getModelsByType(args);
          case 'get_download_url':
            return await this.getDownloadUrl(args);
          case 'get_enums':
            return await this.getEnums(args);
          case 'get_current_user':
            return await this.getCurrentUser(args);
          case 'lookup_users':
            return await this.lookupUsers(args);
          case 'check_generation_permissions':
            return await this.checkGenerationPermissions(args);
          case 'get_vault':
            return await this.getVault(args);
          case 'list_vault_items':
            return await this.listVaultItems(args);
          case 'check_vault_items':
            return await this.checkVaultItems(args);
          case 'toggle_vault_item':
            return await this.toggleVaultItem(args);
          case 'get_model_versions_by_hash':
            return await this.getModelVersionsByHash(args);
          case 'get_model_version_ids_by_hash':
            return await this.getModelVersionIdsByHash(args);
          case 'get_model_version_mini':
            return await this.getModelVersionMini(args);
          case 'submit_workflow':
            return await this.submitWorkflow(args);
          case 'get_workflow':
            return await this.getWorkflow(args);
          case 'query_workflows':
            return await this.queryWorkflows(args);
          case 'cancel_workflow':
            return await this.cancelWorkflow(args);
          case 'generate_image':
            return await this.generateImage(args);
          case 'generate_video':
            return await this.generateVideo(args);
          case 'upscale_image':
            return await this.upscaleImage(args);
          case 'enhance_prompt':
            return await this.enhancePrompt(args);
          case 'get_orchestrator_resource':
            return await this.getOrchestratorResource(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'search_models',
        description: 'Search for AI models on Civitai with various filters',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query to filter models by name' },
            limit: { type: 'number', description: 'Number of results (1-100, default 20)', minimum: 1, maximum: 100 },
            page: { type: 'number', description: 'Page number for pagination', minimum: 1 },
            types: { 
              type: 'array', 
              items: { 
                type: 'string',
                enum: ['Checkpoint', 'TextualInversion', 'Hypernetwork', 'AestheticGradient', 'LORA', 'LoCon', 'DoRA', 'Controlnet', 'Upscaler', 'MotionModule', 'VAE', 'TextEncoder', 'UNet', 'CLIPVision', 'Poses', 'Wildcards', 'Workflows', 'Detection', 'VisionLanguage', 'CLIP', 'LLM', 'Other']
              },
              description: 'Filter by model types'
            },
            sort: { 
              type: 'string', 
              enum: ['Highest Rated', 'Most Downloaded', 'Newest'],
              description: 'Sort order for results'
            },
            period: {
              type: 'string',
              enum: ['AllTime', 'Year', 'Month', 'Week', 'Day'],
              description: 'Time period for sorting'
            },
            nsfw: { type: 'boolean', description: 'Include NSFW content' },
            baseModels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by base model types (e.g., ["SD 1.5", "SDXL 1.0"])'
            },
            checkpointType: {
              type: 'string',
              enum: ['Standard', 'Trained', 'Merge'],
              description: 'For checkpoint models only'
            },
            fromPlatform: { type: 'boolean', description: 'Only return models trained on Civitai' },
            earlyAccess: { type: 'boolean', description: 'Include early-access versions' },
            cursor: { type: 'string', description: 'Opaque pagination cursor from a previous response’s metadata.nextCursor; required for deep paging past 1000 results' }
          },
        },
      },
      {
        name: 'get_model',
        description: 'Get detailed information about a specific model by ID',
        inputSchema: {
          type: 'object',
          properties: {
            modelId: { type: 'number', description: 'The ID of the model to retrieve' },
          },
          required: ['modelId'],
        },
      },
      {
        name: 'get_model_version',
        description: 'Get detailed information about a specific model version',
        inputSchema: {
          type: 'object',
          properties: {
            modelVersionId: { type: 'number', description: 'The ID of the model version to retrieve' },
          },
          required: ['modelVersionId'],
        },
      },
      {
        name: 'get_model_version_by_hash',
        description: 'Get model version information by file hash',
        inputSchema: {
          type: 'object',
          properties: {
            hash: { type: 'string', description: 'The hash of the model file (AutoV1, AutoV2, SHA256, CRC32, or Blake3)' },
          },
          required: ['hash'],
        },
      },
      {
        name: 'browse_images',
        description: 'Browse AI-generated images from Civitai',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of images to return (1-200, default 100)', minimum: 1, maximum: 200 },
            page: { type: 'number', description: 'Page number for pagination', minimum: 1 },
            modelId: { type: 'number', description: 'Filter images from a specific model' },
            modelVersionId: { type: 'number', description: 'Filter images from a specific model version' },
            postId: { type: 'number', description: 'Get images from a specific post' },
            username: { type: 'string', description: 'Filter images by creator username' },
            nsfw: { 
              type: 'string',
              enum: ['None', 'Soft', 'Mature', 'X'],
              description: 'NSFW content level filter'
            },
            sort: {
              type: 'string',
              enum: ['Most Reactions', 'Most Comments', 'Newest'],
              description: 'Sort order for images'
            },
            period: {
              type: 'string',
              enum: ['AllTime', 'Year', 'Month', 'Week', 'Day'],
              description: 'Time period for sorting'
            }
          },
        },
      },
      {
        name: 'get_creators',
        description: 'Browse and search for model creators on Civitai',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of creators to return (0-200, default 20)', minimum: 0, maximum: 200 },
            page: { type: 'number', description: 'Page number for pagination', minimum: 1 },
            query: { type: 'string', description: 'Search query to filter creators by username' },
          },
        },
      },
      {
        name: 'get_tags',
        description: 'Browse and search for model tags on Civitai',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of tags to return (1-200, default 20)', minimum: 1, maximum: 200 },
            page: { type: 'number', description: 'Page number for pagination', minimum: 1 },
            query: { type: 'string', description: 'Search query to filter tags by name' },
          },
        },
      },
      {
        name: 'get_popular_models',
        description: 'Get the most popular/downloaded models',
        inputSchema: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              enum: ['AllTime', 'Year', 'Month', 'Week', 'Day'],
              description: 'Time period for popularity ranking (default: Week)'
            },
            limit: { type: 'number', description: 'Number of models to return (default: 20)', minimum: 1, maximum: 100 },
          },
        },
      },
      {
        name: 'get_latest_models',
        description: 'Get the newest models uploaded to Civitai',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of models to return (default: 20)', minimum: 1, maximum: 100 },
          },
        },
      },
      {
        name: 'get_top_rated_models',
        description: 'Get the highest rated models',
        inputSchema: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              enum: ['AllTime', 'Year', 'Month', 'Week', 'Day'],
              description: 'Time period for rating ranking (default: AllTime)'
            },
            limit: { type: 'number', description: 'Number of models to return (default: 20)', minimum: 1, maximum: 100 },
          },
        },
      },
      {
        name: 'search_models_by_tag',
        description: 'Search for models by a specific tag',
        inputSchema: {
          type: 'object',
          properties: {
            tag: { type: 'string', description: 'Tag name to search for' },
            limit: { type: 'number', description: 'Number of models to return (default: 20)', minimum: 1, maximum: 100 },
            sort: { 
              type: 'string', 
              enum: ['Highest Rated', 'Most Downloaded', 'Newest'],
              description: 'Sort order for results'
            },
          },
          required: ['tag'],
        },
      },
      {
        name: 'search_models_by_creator',
        description: 'Search for models by a specific creator',
        inputSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Creator username to search for' },
            limit: { type: 'number', description: 'Number of models to return (default: 20)', minimum: 1, maximum: 100 },
            sort: { 
              type: 'string', 
              enum: ['Highest Rated', 'Most Downloaded', 'Newest'],
              description: 'Sort order for results'
            },
          },
          required: ['username'],
        },
      },
      {
        name: 'get_models_by_type',
        description: 'Get models filtered by type (Checkpoint, LORA, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            type: { 
              type: 'string',
              enum: ['Checkpoint', 'TextualInversion', 'Hypernetwork', 'AestheticGradient', 'LORA', 'LoCon', 'DoRA', 'Controlnet', 'Upscaler', 'MotionModule', 'VAE', 'TextEncoder', 'UNet', 'CLIPVision', 'Poses', 'Wildcards', 'Workflows', 'Detection', 'VisionLanguage', 'CLIP', 'LLM', 'Other'],
              description: 'Model type to filter by'
            },
            limit: { type: 'number', description: 'Number of models to return (default: 20)', minimum: 1, maximum: 100 },
            sort: { 
              type: 'string', 
              enum: ['Highest Rated', 'Most Downloaded', 'Newest'],
              description: 'Sort order for results'
            },
          },
          required: ['type'],
        },
      },
      {
        name: 'get_download_url',
        description: 'Get the download URL for a specific model version',
        inputSchema: {
          type: 'object',
          properties: {
            modelVersionId: { type: 'number', description: 'The ID of the model version to get download URL for' },
          },
          required: ['modelVersionId'],
        },
      },
      {
        name: 'get_enums',
        description: 'Get the current set of valid enum values used by the Civitai API (model types, file types, base models). Use this to discover valid values instead of relying on hardcoded lists.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_current_user',
        description: 'Get the Civitai account that CIVITAI_API_KEY belongs to, including membership tier and subscription status. Requires CIVITAI_API_KEY.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'lookup_users',
        description: 'Resolve user IDs to usernames, or search usernames by prefix. Omitting both ids and query returns an arbitrary small set of users, so always pass one.',
        inputSchema: {
          type: 'object',
          properties: {
            ids: { type: 'array', items: { type: 'number' }, description: 'Specific user IDs to look up' },
            query: { type: 'string', description: 'Username prefix to search for' },
          },
        },
      },
      {
        name: 'check_generation_permissions',
        description: 'Check in bulk whether model versions can currently be used for generation (e.g. early-access gating). Useful before submitting a generation job.',
        inputSchema: {
          type: 'object',
          properties: {
            entityIds: { type: 'array', items: { type: 'number' }, description: 'Model version IDs to check' },
            entityType: { type: 'string', enum: ['ModelVersion'], description: 'Kind of entity being checked (currently only ModelVersion is supported)' },
            permission: { type: 'string', enum: ['Generate'], description: 'Permission to check (currently only Generate is supported)' },
            userId: { type: 'number', description: 'Run the check on behalf of this user instead of the token owner' },
          },
          required: ['entityIds'],
        },
      },
      {
        name: 'get_vault',
        description: 'Get the Civitai Vault (persistent model-version collection) belonging to the CIVITAI_API_KEY account. Requires an active paid membership; requires CIVITAI_API_KEY.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_vault_items',
        description: 'List model versions stored in the caller\'s Civitai Vault. Requires CIVITAI_API_KEY and an active paid membership.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Items per page (1-200, default 60)', minimum: 1, maximum: 200 },
            page: { type: 'number', description: '1-indexed page number', minimum: 1 },
            query: { type: 'string', description: 'Substring match against model name, version name, or creator name' },
            types: { type: 'array', items: { type: 'string' }, description: 'Filter by model types (e.g. ["Checkpoint", "LORA"])' },
            categories: { type: 'array', items: { type: 'string' }, description: 'Filter by category' },
            baseModels: { type: 'array', items: { type: 'string' }, description: 'Filter by base models (e.g. ["SDXL 1.0"])' },
            dateCreatedFrom: { type: 'string', description: 'ISO date lower bound on the model version\'s createdAt' },
            dateCreatedTo: { type: 'string', description: 'ISO date upper bound on the model version\'s createdAt' },
            dateAddedFrom: { type: 'string', description: 'ISO date lower bound on when the item was added to the vault' },
            dateAddedTo: { type: 'string', description: 'ISO date upper bound on when the item was added to the vault' },
            sort: { type: 'string', enum: ['Recently Added', 'Recently Created', 'Model Name', 'Model Size'], description: 'Sort order' },
          },
        },
      },
      {
        name: 'check_vault_items',
        description: 'Check which of the given model version IDs are already in the caller\'s Vault. Requires CIVITAI_API_KEY.',
        inputSchema: {
          type: 'object',
          properties: {
            modelVersionIds: { type: 'array', items: { type: 'number' }, description: 'Model version IDs to check' },
          },
          required: ['modelVersionIds'],
        },
      },
      {
        name: 'toggle_vault_item',
        description: 'Add a model version to the caller\'s Vault if it isn\'t there, or remove it if it is. Requires CIVITAI_API_KEY.',
        inputSchema: {
          type: 'object',
          properties: {
            modelVersionId: { type: 'number', description: 'Model version ID to add or remove' },
          },
          required: ['modelVersionId'],
        },
      },
      {
        name: 'get_model_versions_by_hash',
        description: 'Look up full model version details for up to 100 file hashes (SHA256) in a single request. Hashes with no match are silently dropped from the response.',
        inputSchema: {
          type: 'object',
          properties: {
            hashes: { type: 'array', items: { type: 'string' }, description: 'Up to 100 SHA256 file hashes', minItems: 1, maxItems: 100 },
          },
          required: ['hashes'],
        },
      },
      {
        name: 'get_model_version_ids_by_hash',
        description: 'Resolve up to 10,000 file hashes (SHA256) to model version IDs. Cheaper than get_model_versions_by_hash when you only need IDs.',
        inputSchema: {
          type: 'object',
          properties: {
            hashes: { type: 'array', items: { type: 'string' }, description: 'Up to 10,000 SHA256 file hashes', minItems: 1, maxItems: 10000 },
          },
          required: ['hashes'],
        },
      },
      {
        name: 'get_model_version_mini',
        description: 'Get a lightweight model version summary optimized for download/generation checks (canGenerate, requireAuth, downloadUrls) without the heavier images/description/files fields.',
        inputSchema: {
          type: 'object',
          properties: {
            modelVersionId: { type: 'number', description: 'The ID of the model version to retrieve' },
            epoch: { type: 'number', description: 'For private training-result versions, request a specific epoch\'s file' },
          },
          required: ['modelVersionId'],
        },
      },
      // Orchestration API tools (orchestration.civitai.com) — paid generation.
      {
        name: 'generate_image',
        description: 'Generate images on Civitai\'s generation platform. COSTS BUZZ (Civitai\'s paid credit). By default runs as a dry-run returning only a cost estimate — re-invoke with confirmSpend: true to actually spend Buzz and execute. Omit engine to generate with a Civitai checkpoint/LoRA (textToImage); set engine to use a hosted engine like openai or flux2 instead. Requires CIVITAI_API_KEY.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'The text prompt to generate from' },
            negativePrompt: { type: 'string', description: 'Negative prompt (things to avoid)' },
            model: { type: 'string', description: 'AIR of the checkpoint to use, e.g. urn:air:sdxl:checkpoint:civitai:827184@2514310 (default: an SD 1.5 checkpoint). Only used when engine is omitted.' },
            engine: {
              type: 'string',
              enum: ['openai', 'flux1-kontext', 'flux2', 'google', 'wan', 'gemini', 'sdcpp', 'comfy', 'seedream', 'grok', 'fal'],
              description: 'Hosted generation engine. Omit to generate with a Civitai checkpoint via textToImage.'
            },
            engineOptions: { type: 'object', description: 'Engine-specific options (only used with engine), passed through verbatim — e.g. size, quality, model variant. A dry-run surfaces validation errors for free.' },
            width: { type: 'number', description: 'Image width in pixels (64-4084, default 512)', minimum: 64, maximum: 4084 },
            height: { type: 'number', description: 'Image height in pixels (64-4084, default 512)', minimum: 64, maximum: 4084 },
            steps: { type: 'number', description: 'Sampling steps (1-150, default 30)', minimum: 1, maximum: 150 },
            cfgScale: { type: 'number', description: 'CFG scale (1-30, default 7.5)', minimum: 1, maximum: 30 },
            seed: { type: 'number', description: 'Seed (0-4294967295, random if omitted)', minimum: 0, maximum: 4294967295 },
            scheduler: {
              type: 'string',
              enum: ['eulerA', 'euler', 'lms', 'heun', 'dpM2', 'dpM2A', 'dpM2SA', 'dpM2M', 'dpmsde', 'dpmFast', 'dpmAdaptive', 'lmsKarras', 'dpM2Karras', 'dpM2AKarras', 'dpM2SAKarras', 'dpM2MKarras', 'dpmsdeKarras', 'ddim', 'plms', 'uniPC', 'undefined', 'lcm', 'ddpm', 'deis', 'dpM3MSDE'],
              description: 'Sampling scheduler'
            },
            clipSkip: { type: 'number', description: 'CLIP skip value (default 2)' },
            quantity: { type: 'number', description: 'Number of batches to run (1-100, default 1)', minimum: 1, maximum: 100 },
            batchSize: { type: 'number', description: 'Images per batch (1-100, default 1)', minimum: 1, maximum: 100 },
            sourceImage: { type: 'string', description: 'Source image (URL, DataURL, or base64) to trigger img2img' },
            sourceImageDenoiseStrength: { type: 'number', description: 'img2img denoise strength 0.0-1.0; lower preserves more of the source (default 0.8)' },
            additionalNetworks: { type: 'object', description: 'LoRAs/embeddings keyed by AIR, e.g. {"urn:air:sdxl:lora:civitai:123@456": {"strength": 0.8}}' },
            outputFormat: { type: 'string', description: 'Output image format' },
            confirmSpend: { type: 'boolean', description: 'Set true to actually spend Buzz and generate. Omitted or false = dry-run cost estimate only.' },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'generate_video',
        description: 'Generate videos (text-to-video or image-to-video) on Civitai\'s generation platform. COSTS BUZZ (Civitai\'s paid credit). By default runs as a dry-run returning only a cost estimate — re-invoke with confirmSpend: true to actually spend Buzz and execute. Video jobs take minutes; results are retrieved via get_workflow. Requires CIVITAI_API_KEY.',
        inputSchema: {
          type: 'object',
          properties: {
            engine: {
              type: 'string',
              enum: ['kling', 'kling-v3', 'haiper', 'veo3', 'wan', 'minimax', 'vidu', 'vidu-q3', 'sora', 'grok', 'lightricks', 'ltx2', 'ltx2.3', 'hunyuan', 'mochi', 'seedance', 'happyHorse'],
              description: 'Video generation engine'
            },
            prompt: { type: 'string', description: 'The text prompt to generate from' },
            engineOptions: { type: 'object', description: 'Engine-specific options passed through verbatim — e.g. duration, aspectRatio, resolution, sourceImage, seed. A dry-run surfaces validation errors for free.' },
            confirmSpend: { type: 'boolean', description: 'Set true to actually spend Buzz and generate. Omitted or false = dry-run cost estimate only.' },
          },
          required: ['engine', 'prompt'],
        },
      },
      {
        name: 'upscale_image',
        description: 'Upscale an image 2x per repeat (up to 8x with 3 repeats). COSTS BUZZ (Civitai\'s paid credit). By default runs as a dry-run returning only a cost estimate — re-invoke with confirmSpend: true to actually spend Buzz and execute. Requires CIVITAI_API_KEY.',
        inputSchema: {
          type: 'object',
          properties: {
            image: { type: 'string', description: 'The image to upscale: URL, DataURL, or base64 string' },
            model: { type: 'string', description: 'Upscaler model to use, in AIR format' },
            numberOfRepeats: { type: 'number', description: 'Upscale passes (1-3); each doubles the resolution', minimum: 1, maximum: 3 },
            confirmSpend: { type: 'boolean', description: 'Set true to actually spend Buzz and upscale. Omitted or false = dry-run cost estimate only.' },
          },
          required: ['image'],
        },
      },
      {
        name: 'enhance_prompt',
        description: 'Analyze and rewrite a generation prompt for a target ecosystem, returning the improved prompt plus issues and recommendations. COSTS BUZZ (Civitai\'s paid credit). By default runs as a dry-run returning only a cost estimate — re-invoke with confirmSpend: true to actually spend Buzz and execute. Requires CIVITAI_API_KEY.',
        inputSchema: {
          type: 'object',
          properties: {
            ecosystem: { type: 'string', enum: ['sd1', 'sdxl', 'flux', 'ltx2'], description: 'Target model ecosystem the prompt should be optimized for' },
            prompt: { type: 'string', description: 'The prompt to analyze and enhance' },
            negativePrompt: { type: 'string', description: 'Optional negative prompt to analyze and enhance' },
            temperature: { type: 'number', description: 'LLM creativity 0.0-1.0 (default 0.7)', minimum: 0, maximum: 1 },
            instruction: { type: 'string', description: 'Optional guidance, e.g. "expand to 77 tokens" or "keep it under 20 words"' },
            confirmSpend: { type: 'boolean', description: 'Set true to actually spend Buzz and enhance. Omitted or false = dry-run cost estimate only.' },
          },
          required: ['ecosystem', 'prompt'],
        },
      },
      {
        name: 'submit_workflow',
        description: 'Submit a raw workflow (array of steps) to the Civitai Orchestrator — the escape hatch for job types without a dedicated tool (training, comfy, TTS, transcription, ...). COSTS BUZZ (Civitai\'s paid credit). By default runs as a dry-run returning only a cost estimate — re-invoke with confirmSpend: true to actually spend Buzz and execute. Requires CIVITAI_API_KEY.',
        inputSchema: {
          type: 'object',
          properties: {
            steps: {
              type: 'array',
              description: 'Workflow steps. Each step is {"$type": "<stepType>", "input": {...}} — e.g. $type "textToImage", "videoGen", "imageResourceTraining", "comfy", "textToSpeech".',
              items: {
                type: 'object',
                properties: {
                  $type: { type: 'string', description: 'Step type discriminator' },
                  input: { type: 'object', description: 'Step input, shape depends on $type' },
                  name: { type: 'string', description: 'Optional step name so steps can reference one another' },
                  priority: { type: 'string', enum: ['high', 'normal', 'low'] },
                  timeout: { type: 'string', description: 'Max time to wait for the step (timespan format)' },
                  retries: { type: 'number', description: 'Max retries for the step' },
                  metadata: { type: 'object' },
                },
                required: ['$type', 'input'],
              },
              minItems: 1,
            },
            tags: { type: 'array', items: { type: 'string' }, maxItems: 10, description: 'Up to 10 tags; indexed and searchable via query_workflows' },
            metadata: { type: 'object', description: 'Freeform metadata stored with the workflow' },
            externalId: { type: 'string', description: 'Idempotency key (1-128 chars, [A-Za-z0-9_-]); resubmitting the same key returns the existing workflow instead of charging again' },
            wait: { type: 'number', description: 'Seconds to block waiting for completion (0-60, only applies with confirmSpend)', minimum: 0, maximum: 60 },
            confirmSpend: { type: 'boolean', description: 'Set true to actually spend Buzz and execute. Omitted or false = dry-run cost estimate only.' },
          },
          required: ['steps'],
        },
      },
      {
        name: 'get_workflow',
        description: 'Get the status, cost, and outputs (blob URLs) of an Orchestrator workflow by ID. Free read. Use this to poll workflows that were still processing when submitted. Requires CIVITAI_API_KEY.',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: 'The workflow ID, e.g. wf_01HXYZ...' },
            wait: { type: 'number', description: 'Seconds to block waiting for completion (0-60)', minimum: 0, maximum: 60 },
          },
          required: ['workflowId'],
        },
      },
      {
        name: 'query_workflows',
        description: 'List the authenticated account\'s recent Orchestrator workflows, newest first. Free read. Requires CIVITAI_API_KEY.',
        inputSchema: {
          type: 'object',
          properties: {
            take: { type: 'number', description: 'How many workflows to return (1-100, default 10)', minimum: 1, maximum: 100 },
            cursor: { type: 'string', description: 'Continuation cursor from a previous query' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Only workflows with these tags' },
            query: { type: 'string', description: 'Match workflows through their metadata' },
            ascending: { type: 'boolean', description: 'Oldest first instead of newest first' },
            fromDate: { type: 'string', description: 'ISO date-time lower bound on creation' },
            toDate: { type: 'string', description: 'ISO date-time upper bound on creation' },
            excludeFailed: { type: 'boolean', description: 'Exclude Failed, Expired, and Canceled workflows' },
          },
        },
      },
      {
        name: 'cancel_workflow',
        description: 'Cancel a running Orchestrator workflow. May trigger a Buzz refund if the requested work has not started yet. Requires CIVITAI_API_KEY.',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: 'The workflow ID to cancel' },
          },
          required: ['workflowId'],
        },
      },
      {
        name: 'get_orchestrator_resource',
        description: 'Look up a resource on the Orchestrator by its AIR identifier — returns generation availability (canGenerate), download URLs, hashes, and early-access gating. Free read. Requires CIVITAI_API_KEY.',
        inputSchema: {
          type: 'object',
          properties: {
            air: { type: 'string', description: 'AIR identifier, e.g. urn:air:sdxl:checkpoint:civitai:827184@2514310' },
          },
          required: ['air'],
        },
      },
    ];
  }

  private formatModelsResponse(response: any) {
    const models = response.items.map((model: any) => {
      const latestVersion = (model.modelVersions || [])[0];
      return {
        id: model.id,
        name: model.name || 'Untitled',
        type: model.type || 'Unknown',
        creator: model.creator?.username || 'Unknown',
        description: model.description
          ? model.description.substring(0, 200) + (model.description.length > 200 ? '...' : '')
          : 'No description available',
        tags: (model.tags || []).slice(0, 5), // Limit tags for readability
        nsfw: model.nsfw,
        stats: {
          downloads: model.stats?.downloadCount || 0,
          rating: model.stats?.rating || 0,
          favorites: model.stats?.favoriteCount || 0,
        },
        latestVersion: latestVersion ? {
          id: latestVersion.id,
          name: latestVersion.name || 'Untitled',
          createdAt: latestVersion.createdAt,
          trainedWords: latestVersion.trainedWords || [],
        } : null,
      };
    });

    return {
      models,
      pagination: {
        currentPage: response.metadata.currentPage || 1,
        totalPages: response.metadata.totalPages || 1,
        totalItems: response.metadata.totalItems || models.length,
        hasNextPage: response.metadata.nextPage ? true : false,
      },
    };
  }

  private formatSingleModel(model: any) {
    return {
      id: model.id,
      name: model.name || 'Untitled',
      description: model.description || 'No description available',
      type: model.type || 'Unknown',
      creator: {
        username: model.creator?.username || 'Unknown',
        avatar: model.creator?.image,
      },
      tags: model.tags || [],
      nsfw: model.nsfw,
      stats: model.stats || {},
      versions: (model.modelVersions || []).map((version: any) => ({
        id: version.id,
        name: version.name || 'Untitled',
        description: version.description,
        createdAt: version.createdAt,
        trainedWords: version.trainedWords || [],
        downloadUrl: version.downloadUrl,
        stats: version.stats || {},
        files: (version.files || []).map((file: any) => ({
          sizeKb: file.sizeKb,
          format: file.metadata?.format,
          fp: file.metadata?.fp,
          primary: file.primary,
          scanStatus: {
            pickle: file.pickleScanResult,
            virus: file.virusScanResult,
          },
        })),
        imageCount: version.images?.length || 0,
      })),
    };
  }

  // Tool implementation methods
  private async searchModels(args: any) {
    const response = await this.client.getModels(args);
    const formatted = this.formatModelsResponse(response);
    
    return {
      content: [
        {
          type: 'text',
          text: `Found ${formatted.pagination.totalItems} models:\\n\\n${formatted.models.map((model: any) => 
            `**${model.name}** (${model.type})\\n` +
            `Creator: ${model.creator}\\n` +
            `Downloads: ${model.stats.downloads.toLocaleString()} | Rating: ${model.stats.rating.toFixed(1)}\\n` +
            `Tags: ${model.tags.join(', ')}\\n` +
            `${model.description}\\n`
          ).join('\\n---\\n')}\\n\\nPage ${formatted.pagination.currentPage} of ${formatted.pagination.totalPages}`,
        },
      ],
    };
  }

  private async getModel(args: any) {
    const { modelId } = args;
    const model = await this.client.getModel(modelId);
    const formatted = this.formatSingleModel(model);
    
    return {
      content: [
        {
          type: 'text',
          text: `# ${formatted.name}\\n\\n` +
            `**Type:** ${formatted.type}\\n` +
            `**Creator:** ${formatted.creator.username}\\n` +
            `**Downloads:** ${formatted.stats.downloadCount?.toLocaleString() || 0}\\n` +
            `**Rating:** ${formatted.stats.rating?.toFixed(1) || 'N/A'} (${formatted.stats.ratingCount || 0} ratings)\\n` +
            `**NSFW:** ${formatted.nsfw ? 'Yes' : 'No'}\\n\\n` +
            `**Tags:** ${formatted.tags.join(', ')}\\n\\n` +
            `**Description:**\\n${formatted.description}\\n\\n` +
            `**Versions (${formatted.versions.length}):**\\n${formatted.versions.map((v: any) =>
              `- **${v.name}** (ID: ${v.id})\\n  ` +
              `Created: ${v.createdAt ? new Date(v.createdAt).toLocaleDateString() : 'Unknown'}\\n  ` +
              `Downloads: ${v.stats.downloadCount?.toLocaleString() || 0}\\n  ` +
              `Trained words: ${v.trainedWords.join(', ') || 'None'}\\n  ` +
              `Files: ${v.files.length} file(s)\\n`
            ).join('\\n')}`,
        },
      ],
    };
  }

  private async getModelVersion(args: any) {
    const { modelVersionId } = args;
    const version = await this.client.getModelVersion(modelVersionId);
    
    return {
      content: [
        {
          type: 'text',
          text: `# ${version.model.name || 'Untitled'} - ${version.name || 'Untitled'}\\n\\n` +
            `**Model Type:** ${version.model.type || 'Unknown'}\\n` +
            `**Version ID:** ${version.id}\\n` +
            `**Created:** ${version.createdAt ? new Date(version.createdAt).toLocaleDateString() : 'Unknown'}\\n` +
            `**Downloads:** ${version.stats?.downloadCount?.toLocaleString() || 0}\\n` +
            `**Rating:** ${version.stats?.rating?.toFixed(1) || 'N/A'}\\n\\n` +
            `**Trained Words:** ${(version.trainedWords || []).join(', ') || 'None'}\\n\\n` +
            `**Description:**\\n${version.description || 'No description available'}\\n\\n` +
            `**Files (${version.files?.length || 0}):**\\n${version.files?.map(file =>
              `- Size: ${file.sizeKb ? (file.sizeKb / 1024).toFixed(1) : 'Unknown'} MB\\n` +
              `  Format: ${file.metadata?.format || 'Unknown'}\\n` +
              `  FP: ${file.metadata?.fp || 'Unknown'}\\n` +
              `  Scans: Pickle=${file.pickleScanResult || 'Unknown'}, Virus=${file.virusScanResult || 'Unknown'}\\n`
            ).join('\\n') || 'No files available'}\\n` +
            `**Sample Images:** ${version.images?.length || 0} available`,
        },
      ],
    };
  }

  private async getModelVersionByHash(args: any) {
    const { hash } = args;
    const version = await this.client.getModelVersionByHash(hash);
    
    return {
      content: [
        {
          type: 'text',
          text: `# Model Found by Hash\\n\\n` +
            `**Model:** ${version.model.name || 'Untitled'}\\n` +
            `**Version:** ${version.name || 'Untitled'} (ID: ${version.id})\\n` +
            `**Type:** ${version.model.type || 'Unknown'}\\n` +
            `**Hash:** ${hash}\\n\\n` +
            `**Created:** ${version.createdAt ? new Date(version.createdAt).toLocaleDateString() : 'Unknown'}\\n` +
            `**Downloads:** ${version.stats?.downloadCount?.toLocaleString() || 0}\\n` +
            `**Trained Words:** ${(version.trainedWords || []).join(', ') || 'None'}\\n\\n` +
            `**Description:**\\n${version.description || 'No description available'}`,
        },
      ],
    };
  }

  private async browseImages(args: any) {
    const response = await this.client.getImages(args);
    
    return {
      content: [
        {
          type: 'text',
          text: `Found ${response.metadata.totalItems || response.items.length} images:\\n\\n${response.items.map(image => 
            `**Image ID:** ${image.id}\\n` +
            `**Creator:** ${image.username || 'Unknown'}\\n` +
            `**Dimensions:** ${image.width ?? 'Unknown'}x${image.height ?? 'Unknown'}\\n` +
            `**NSFW Level:** ${image.nsfwLevel || 'Unknown'}\\n` +
            `**Reactions:** ❤️ ${image.stats?.heartCount || 0} | 👍 ${image.stats?.likeCount || 0} | 💬 ${image.stats?.commentCount || 0}\\n` +
            `**URL:** ${image.url || 'Unknown'}\\n` +
            `**Created:** ${image.createdAt ? new Date(image.createdAt).toLocaleDateString() : 'Unknown'}\\n` +
            (image.meta ? `**Generation Info:** ${JSON.stringify(image.meta, null, 2).substring(0, 200)}...\\n` : '') +
            '\\n'
          ).join('---\\n')}\\nPage ${response.metadata.currentPage || 1}`,
        },
      ],
    };
  }

  private async getCreators(args: any) {
    const response = await this.client.getCreators(args);
    
    return {
      content: [
        {
          type: 'text',
          text: `Found ${response.metadata.totalItems || response.items.length} creators:\\n\\n${response.items.map(creator =>
            `**${creator.username || 'Unknown'}**\\n` +
            `Models: ${creator.modelCount || 0}\\n` +
            (creator.link ? `Profile: ${creator.link}\\n` : '') +
            '\\n'
          ).join('---\\n')}\\nPage ${response.metadata.currentPage || 1} of ${response.metadata.totalPages || 1}`,
        },
      ],
    };
  }

  private async getTags(args: any) {
    const response = await this.client.getTags(args);
    
    return {
      content: [
        {
          type: 'text',
          text: `Found ${response.metadata.totalItems || response.items.length} tags:\\n\\n${response.items.map(tag =>
            `**${tag.name || 'Unknown'}** (${tag.modelCount || 0} models)\\n`
          ).join('')}\\nPage ${response.metadata.currentPage || 1} of ${response.metadata.totalPages || 1}`,
        },
      ],
    };
  }

  private async getPopularModels(args: any) {
    const response = await this.client.getPopularModels(args.period, args.limit);
    const formatted = this.formatModelsResponse(response);
    
    return {
      content: [
        {
          type: 'text',
          text: `# Most Popular Models (${args.period || 'Week'})\\n\\n${formatted.models.map((model: any, index: number) => 
            `${index + 1}. **${model.name}** (${model.type})\\n` +
            `   Creator: ${model.creator}\\n` +
            `   Downloads: ${model.stats.downloads.toLocaleString()}\\n` +
            `   Rating: ${model.stats.rating.toFixed(1)} ⭐\\n\\n`
          ).join('')}`,
        },
      ],
    };
  }

  private async getLatestModels(args: any) {
    const response = await this.client.getLatestModels(args.limit);
    const formatted = this.formatModelsResponse(response);
    
    return {
      content: [
        {
          type: 'text',
          text: `# Latest Models\\n\\n${formatted.models.map((model: any) => 
            `**${model.name}** (${model.type})\\n` +
            `Creator: ${model.creator}\\n` +
            `Created: ${model.latestVersion?.createdAt ? new Date(model.latestVersion.createdAt).toLocaleDateString() : 'Unknown'}\\n` +
            `${model.description}\\n\\n`
          ).join('---\\n')}`,
        },
      ],
    };
  }

  private async getTopRatedModels(args: any) {
    const response = await this.client.getTopRatedModels(args.period, args.limit);
    const formatted = this.formatModelsResponse(response);
    
    return {
      content: [
        {
          type: 'text',
          text: `# Top Rated Models (${args.period || 'AllTime'})\\n\\n${formatted.models.map((model: any, index: number) => 
            `${index + 1}. **${model.name}** (${model.type})\\n` +
            `   Creator: ${model.creator}\\n` +
            `   Rating: ${model.stats.rating.toFixed(1)} ⭐ (${model.stats.downloads.toLocaleString()} downloads)\\n\\n`
          ).join('')}`,
        },
      ],
    };
  }

  private async searchModelsByTag(args: any) {
    const response = await this.client.searchModelsByTag(args.tag, args);
    const formatted = this.formatModelsResponse(response);
    
    return {
      content: [
        {
          type: 'text',
          text: `# Models tagged "${args.tag}"\\n\\n${formatted.models.map((model: any) => 
            `**${model.name}** (${model.type})\\n` +
            `Creator: ${model.creator}\\n` +
            `Downloads: ${model.stats.downloads.toLocaleString()} | Rating: ${model.stats.rating.toFixed(1)}\\n` +
            `${model.description}\\n\\n`
          ).join('---\\n')}`,
        },
      ],
    };
  }

  private async searchModelsByCreator(args: any) {
    const response = await this.client.searchModelsByCreator(args.username, args);
    const formatted = this.formatModelsResponse(response);
    
    return {
      content: [
        {
          type: 'text',
          text: `# Models by ${args.username}\\n\\n${formatted.models.map((model: any) => 
            `**${model.name}** (${model.type})\\n` +
            `Downloads: ${model.stats.downloads.toLocaleString()} | Rating: ${model.stats.rating.toFixed(1)}\\n` +
            `Tags: ${model.tags.join(', ')}\\n` +
            `${model.description}\\n\\n`
          ).join('---\\n')}`,
        },
      ],
    };
  }

  private async getModelsByType(args: any) {
    const response = await this.client.getModelsByType(args.type, args);
    const formatted = this.formatModelsResponse(response);
    
    return {
      content: [
        {
          type: 'text',
          text: `# ${args.type} Models\\n\\n${formatted.models.map((model: any) => 
            `**${model.name}**\\n` +
            `Creator: ${model.creator}\\n` +
            `Downloads: ${model.stats.downloads.toLocaleString()} | Rating: ${model.stats.rating.toFixed(1)}\\n` +
            `${model.description}\\n\\n`
          ).join('---\\n')}`,
        },
      ],
    };
  }

  private async getDownloadUrl(args: any) {
    const { modelVersionId } = args;
    const downloadUrl = this.client.getDownloadUrl(modelVersionId);
    
    return {
      content: [
        {
          type: 'text',
          text: `Download URL for model version ${modelVersionId}:\\n\\n${downloadUrl}\\n\\n` +
            `**Note:** Use \`wget "${downloadUrl}" --content-disposition\` to download with proper filename.\\n` +
            `If the model requires authentication, add your API key: \`?token=YOUR_API_KEY\``,
        },
      ],
    };
  }

  private async getEnums(args: any) {
    const enums = await this.client.getEnums();

    return {
      content: [
        {
          type: 'text',
          text: Object.entries(enums)
            .map(([name, values]) => `**${name}**\\n${(values || []).map((v: string) => `- ${v}`).join('\\n')}`)
            .join('\\n\\n'),
        },
      ],
    };
  }

  private async getCurrentUser(args: any) {
    const user = await this.client.getCurrentUser();

    return {
      content: [
        {
          type: 'text',
          text: `# Current User\\n\\n` +
            `**ID:** ${user.id}\\n` +
            `**Username:** ${user.username || 'Unknown'}\\n` +
            `**Tier:** ${user.tier || 'free'}\\n` +
            `**Status:** ${user.status || 'Unknown'}\\n` +
            `**Member:** ${user.isMember ? 'Yes' : 'No'}\\n` +
            `**Subscriptions:** ${(user.subscriptions || []).join(', ') || 'None'}`,
        },
      ],
    };
  }

  private async lookupUsers(args: any) {
    const response = await this.client.lookupUsers(args);

    return {
      content: [
        {
          type: 'text',
          text: `Found ${response.items.length} user(s):\\n\\n${response.items.map(user =>
            `**${user.username || 'Unknown'}** (ID: ${user.id})${user.avatarNsfw && user.avatarNsfw !== 'None' && user.avatarNsfw !== 0 ? ` [avatar: ${user.avatarNsfw}]` : ''}`
          ).join('\\n')}`,
        },
      ],
    };
  }

  private async checkGenerationPermissions(args: any) {
    const response = await this.client.checkPermissions(args);
    const entries = Array.isArray(response) ? [] : Object.entries(response);

    return {
      content: [
        {
          type: 'text',
          text: entries.length === 0
            ? 'No entities to check (or none matched).'
            : `Generation permission by entity ID:\\n\\n${entries.map(([id, allowed]) =>
                `- ${id}: ${allowed ? 'Allowed' : 'Not allowed'}`
              ).join('\\n')}`,
        },
      ],
    };
  }

  private async getVault(args: any) {
    const response = await this.client.getVault();

    if (!response.vault) {
      return {
        content: [
          { type: 'text', text: 'No vault available. This requires an active paid Civitai membership.' },
        ],
      };
    }

    const vault = response.vault;
    return {
      content: [
        {
          type: 'text',
          text: `# Vault\\n\\n` +
            `**Owner ID:** ${vault.userId}\\n` +
            `**Storage:** ${((vault.usedStorageKb || 0) / 1024 / 1024).toFixed(2)} GB / ${((vault.storageKb || 0) / 1024 / 1024).toFixed(2)} GB\\n` +
            `**Last updated:** ${vault.updatedAt ? new Date(vault.updatedAt).toLocaleString() : 'Unknown'}`,
        },
      ],
    };
  }

  private async listVaultItems(args: any) {
    const response = await this.client.getVaultItems(args);

    return {
      content: [
        {
          type: 'text',
          text: `Found ${response.totalItems ?? response.items.length} vault item(s):\\n\\n${response.items.map(item =>
            `**${item.modelName || 'Unknown'}** - ${item.versionName || 'Unknown'} (${item.type || 'Unknown'})\\n` +
            `Creator: ${item.creatorName || 'Unknown'}\\n` +
            `Status: ${item.status || 'Unknown'}\\n` +
            `Model version ID: ${item.modelVersionId}\\n` +
            `Added: ${item.addedAt ? new Date(item.addedAt).toLocaleDateString() : 'Unknown'}\\n`
          ).join('\\n---\\n')}\\n\\nPage ${response.currentPage || 1} of ${response.totalPages || 1}`,
        },
      ],
    };
  }

  private async checkVaultItems(args: any) {
    const response = await this.client.checkVaultItems(args.modelVersionIds);

    return {
      content: [
        {
          type: 'text',
          text: response.map(entry =>
            `- Model version ${entry.modelVersionId}: ${entry.vaultItem ? 'In vault' : 'Not in vault'}`
          ).join('\\n'),
        },
      ],
    };
  }

  private async toggleVaultItem(args: any) {
    const { modelVersionId } = args;
    const response = await this.client.toggleVaultVersion(modelVersionId);

    return {
      content: [
        {
          type: 'text',
          text: response.vaultId
            ? `Added model version ${modelVersionId} to the vault (vault ID: ${response.vaultId}).`
            : `Removed model version ${modelVersionId} from the vault.`,
        },
      ],
    };
  }

  private async getModelVersionsByHash(args: any) {
    const versions = await this.client.getModelVersionsByHash(args.hashes);

    return {
      content: [
        {
          type: 'text',
          text: versions.length === 0
            ? 'No model versions matched the given hashes.'
            : versions.map(version =>
                `**${version.model.name || 'Untitled'}** - ${version.name || 'Untitled'} (ID: ${version.id})\\n` +
                `Type: ${version.model.type || 'Unknown'}\\n` +
                `Downloads: ${version.stats?.downloadCount?.toLocaleString() || 0}`
              ).join('\\n---\\n'),
        },
      ],
    };
  }

  private async getModelVersionIdsByHash(args: any) {
    const results = await this.client.getModelVersionIdsByHash(args.hashes);

    return {
      content: [
        {
          type: 'text',
          text: results.length === 0
            ? 'No model versions matched the given hashes.'
            : results.map(r => `- ${r.hash} → model version ${r.modelVersionId}`).join('\\n'),
        },
      ],
    };
  }

  private async getModelVersionMini(args: any) {
    const { modelVersionId, epoch } = args;
    const version = await this.client.getModelVersionMini(modelVersionId, epoch);

    return {
      content: [
        {
          type: 'text',
          text: `# ${version.modelName || 'Unknown'} - ${version.versionName || 'Unknown'}\\n\\n` +
            `**AIR:** ${version.air}\\n` +
            `**Base Model:** ${version.baseModel}\\n` +
            `**Can Generate:** ${version.canGenerate ? 'Yes' : 'No'}\\n` +
            `**Requires Auth to Download:** ${version.requireAuth ? 'Yes' : 'No'}\\n` +
            `**Gated (early access/private):** ${version.checkPermission ? 'Yes' : 'No'}\\n` +
            (version.earlyAccessEndsAt ? `**Early Access Ends:** ${new Date(version.earlyAccessEndsAt).toLocaleString()}\\n` : '') +
            `**File:** ${version.fileName || 'Unknown'} (${version.format || 'Unknown'})\\n` +
            `**Download URLs:** ${(version.downloadUrls || []).join(', ') || 'None'}\\n` +
            `**SHA256:** ${version.hashes?.SHA256 || 'Unknown'}`,
        },
      ],
    };
  }

  // Orchestration API formatters

  private formatBuzzCost(cost: WorkflowCost | null | undefined): string {
    if (!cost || (cost.total === undefined && cost.base === undefined)) {
      return 'cost estimate unavailable';
    }
    const total = cost.total ?? cost.base;
    const parts: string[] = [];
    if (cost.base !== undefined && cost.base !== total) parts.push(`base ${cost.base}`);
    // tips is a number in some responses, an object breakdown ({civitai, creators}) in others
    const tipsTotal = typeof cost.tips === 'number'
      ? cost.tips
      : cost.tips && typeof cost.tips === 'object'
        ? Object.values(cost.tips as Record<string, number>).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0)
        : 0;
    if (tipsTotal > 0) parts.push(`tips ${tipsTotal}`);
    return `~${total} Buzz total${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`;
  }

  // Step outputs are polymorphic (verified live): textToImage yields
  // { images: Blob[] }, videoGen { video: Blob }, imageUpscaler { blob: Blob }.
  private collectOutputBlobs(wf: Workflow): OrchestrationBlob[] {
    const blobs: OrchestrationBlob[] = [];
    const harvest = (output: Record<string, any> | null | undefined) => {
      if (!output) return;
      for (const key of ['images', 'blobs', 'blob', 'video', 'videos', 'audio']) {
        const value = output[key];
        if (Array.isArray(value)) {
          blobs.push(...value.filter((b: any) => b && typeof b === 'object'));
        } else if (value && typeof value === 'object') {
          blobs.push(value);
        }
      }
    };
    for (const step of wf.steps || []) {
      harvest(step.output);
    }
    harvest(wf as Record<string, any>); // bare recipe outputs (no workflow envelope)
    return blobs;
  }

  private formatWorkflowResult(wf: Workflow, ctx: { dryRun: boolean; toolName: string }) {
    if (ctx.dryRun) {
      const insufficientBuzz = (wf.transactions as any)?.insufficientBuzz === true;
      return {
        content: [
          {
            type: 'text',
            text: `# Dry run — no Buzz was spent\\n\\n` +
              `**Estimated cost:** ${this.formatBuzzCost(wf.cost)}\\n` +
              `**Validation:** request accepted by the Orchestrator\\n` +
              (insufficientBuzz
                ? `\\n⚠️ **Insufficient Buzz:** the account cannot currently afford this — executing with confirmSpend would fail or be rejected.\\n`
                : '') +
              `\\nTo execute for real, call ${ctx.toolName} again with the SAME arguments plus confirmSpend: true.`,
          },
        ],
      };
    }

    const status = wf.status || 'unknown';
    const blobs = this.collectOutputBlobs(wf);
    const header = `# Workflow ${wf.id || '(no id returned)'}\\n\\n` +
      `**Status:** ${status}\\n` +
      (wf.cost ? `**Cost:** ${this.formatBuzzCost(wf.cost)}\\n` : '');

    if (status === 'succeeded' || blobs.length > 0) {
      return {
        content: [
          {
            type: 'text',
            text: header +
              `\\n**Outputs (${blobs.length}):**\\n` +
              (blobs.length === 0
                ? 'No output blobs found on the workflow.'
                : blobs.map(b =>
                    `- ${b.url || 'not yet available'}` +
                    (b.width && b.height ? ` (${b.width}x${b.height})` : '') +
                    (b.urlExpiresAt ? ` — URL expires ${new Date(b.urlExpiresAt).toLocaleString()}` : '') +
                    (b.blockedReason ? ` [BLOCKED: ${b.blockedReason}]` : '')
                  ).join('\\n')),
          },
        ],
      };
    }

    if (status === 'failed' || status === 'expired' || status === 'canceled') {
      return {
        content: [
          {
            type: 'text',
            text: header +
              `\\n**Step statuses:**\\n` +
              (wf.steps || []).map(s => `- ${s.name || s.$type || 'step'}: ${s.status || 'unknown'}`).join('\\n') +
              `\\n\\nThe workflow did not complete. Buzz for unstarted work may be refunded automatically.`,
          },
        ],
      };
    }

    // unassigned / preparing / scheduled / processing
    return {
      content: [
        {
          type: 'text',
          text: header +
            `\\nStill running. Call get_workflow with workflowId "${wf.id}" (optionally wait: 60) to retrieve results.`,
        },
      ],
    };
  }

  // Orchestration API handlers

  private async submitWorkflow(args: any) {
    const { confirmSpend, wait, ...body } = args;
    const dryRun = confirmSpend !== true;
    const result = await this.orchestrationClient.submitWorkflow(body, {
      whatif: dryRun,
      wait: dryRun ? undefined : (wait ?? 60),
    });
    return this.formatWorkflowResult(result, { dryRun, toolName: 'submit_workflow' });
  }

  private async getWorkflow(args: any) {
    const { workflowId, wait } = args;
    const result = await this.orchestrationClient.getWorkflow(workflowId, wait);
    return this.formatWorkflowResult(result, { dryRun: false, toolName: 'get_workflow' });
  }

  private async queryWorkflows(args: any) {
    const page = await this.orchestrationClient.queryWorkflows({
      take: 10,
      ...args,
    });
    const items = page.items || [];
    const cursor = page.nextCursor ?? page.next;

    return {
      content: [
        {
          type: 'text',
          text: items.length === 0
            ? 'No workflows found.'
            : `Found ${items.length} workflow(s):\\n\\n${items.map(wf =>
                `**${wf.id || 'unknown'}** — ${wf.status || 'unknown'}\\n` +
                `Created: ${wf.createdAt ? new Date(wf.createdAt).toLocaleString() : 'Unknown'}\\n` +
                `Steps: ${(wf.steps || []).map(s => s.$type || 'step').join(', ') || 'none'}\\n` +
                (wf.cost ? `Cost: ${this.formatBuzzCost(wf.cost)}\\n` : '') +
                ((wf.tags || []).length > 0 ? `Tags: ${(wf.tags || []).join(', ')}\\n` : '')
              ).join('\\n---\\n')}` +
              (cursor ? `\\n\\nMore available — pass cursor: "${cursor}" to continue.` : ''),
        },
      ],
    };
  }

  private async cancelWorkflow(args: any) {
    const { workflowId } = args;
    await this.orchestrationClient.cancelWorkflow(workflowId);
    return {
      content: [
        {
          type: 'text',
          text: `Workflow ${workflowId} canceled. Buzz for work that had not started may be refunded automatically.`,
        },
      ],
    };
  }

  private async generateImage(args: any) {
    const { confirmSpend, engine, engineOptions, sourceImageDenoiseStrength, ...input } = args;
    const dryRun = confirmSpend !== true;
    const opts = { whatif: dryRun, wait: dryRun ? undefined : 60 };

    const result = engine
      ? await this.orchestrationClient.imageGen({ engine, prompt: input.prompt, ...engineOptions }, opts)
      : await this.orchestrationClient.textToImage(
          {
            ...input,
            // The API's own field name carries this typo; the tool exposes the
            // correct spelling and maps it here.
            ...(sourceImageDenoiseStrength !== undefined && { sourceImageDenoiseStrenght: sourceImageDenoiseStrength }),
          },
          opts
        );

    return this.formatWorkflowResult(result, { dryRun, toolName: 'generate_image' });
  }

  private async generateVideo(args: any) {
    const { confirmSpend, engine, prompt, engineOptions } = args;
    const dryRun = confirmSpend !== true;
    const result = await this.orchestrationClient.videoGen(
      { engine, prompt, ...engineOptions },
      // Video jobs take minutes; don't burn the whole wait budget inline.
      { whatif: dryRun, wait: dryRun ? undefined : 10 }
    );
    return this.formatWorkflowResult(result, { dryRun, toolName: 'generate_video' });
  }

  private async upscaleImage(args: any) {
    const { confirmSpend, ...input } = args;
    const dryRun = confirmSpend !== true;
    const result = await this.orchestrationClient.upscaleImage(input as any, {
      whatif: dryRun,
      wait: dryRun ? undefined : 60,
    });
    return this.formatWorkflowResult(result, { dryRun, toolName: 'upscale_image' });
  }

  private async enhancePrompt(args: any) {
    const { confirmSpend, ...input } = args;
    const dryRun = confirmSpend !== true;
    const result = await this.orchestrationClient.enhancePrompt(input as any, {
      whatif: dryRun,
      wait: dryRun ? undefined : 60,
    });

    if (dryRun) {
      return this.formatWorkflowResult(result, { dryRun, toolName: 'enhance_prompt' });
    }

    // The enhancement lives in the step output (or at the top level when the
    // recipe returns a bare output instead of a workflow envelope).
    const output = (result.steps || []).map(s => s.output).find(o => o && o.enhancedPrompt)
      || ((result as Record<string, any>).enhancedPrompt ? (result as Record<string, any>) : undefined);

    if (!output) {
      return this.formatWorkflowResult(result, { dryRun, toolName: 'enhance_prompt' });
    }

    return {
      content: [
        {
          type: 'text',
          text: `# Enhanced Prompt\\n\\n` +
            `${output.enhancedPrompt}\\n\\n` +
            (output.enhancedNegativePrompt ? `**Enhanced negative prompt:** ${output.enhancedNegativePrompt}\\n\\n` : '') +
            ((output.issues || []).length > 0
              ? `**Issues with the original:**\\n${(output.issues || []).map((i: any) =>
                  `- ${typeof i === 'string' ? i : i.description || i.message || JSON.stringify(i)}`
                ).join('\\n')}\\n\\n`
              : '') +
            ((output.recommendations || []).length > 0
              ? `**Recommendations:**\\n${(output.recommendations || []).map((r: string) => `- ${r}`).join('\\n')}`
              : ''),
        },
      ],
    };
  }

  private async getOrchestratorResource(args: any) {
    const { air } = args;
    const resource = await this.orchestrationClient.getResource(air);

    return {
      content: [
        {
          type: 'text',
          text: `# ${resource.resourceName || 'Unknown'} - ${resource.versionName || 'Unknown'}\\n\\n` +
            `**AIR:** ${resource.air || air}\\n` +
            `**Can Generate:** ${resource.canGenerate ? 'Yes' : 'No'}\\n` +
            `**Gated (early access/private):** ${resource.checkPermission ? 'Yes' : 'No'}\\n` +
            (resource.earlyAccessEndsAt ? `**Early Access Ends:** ${new Date(resource.earlyAccessEndsAt).toLocaleString()}\\n` : '') +
            `**Size:** ${resource.size ? `${(resource.size / 1024 / 1024).toFixed(1)} MB` : 'Unknown'}\\n` +
            `**Format:** ${resource.fileFormat || 'Unknown'}\\n` +
            `**Mature content restricted:** ${resource.hasMatureContentRestriction ? 'Yes' : 'No'}\\n` +
            `**Download URLs:** ${(resource.downloadUrls || []).join(', ') || 'None'}\\n` +
            `**SHA256:** ${resource.hashes?.SHA256 || resource.hashes?.sha256 || 'Unknown'}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Civitai MCP server running on stdio');
  }
}

const server = new CivitaiMCPServer();
server.run().catch(console.error);
