# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-13

### Added
- **Civitai Orchestration API support** (`https://orchestration.civitai.com`) — 9 new tools (25 → 34) for paid AI generation, in two new source files (`src/orchestration-types.ts`, `src/orchestration-client.ts`):
  - `generate_image` — text-to-image with any Civitai checkpoint/LoRA (textToImage) or hosted engines (openai, flux1-kontext, flux2, google, wan, gemini, sdcpp, comfy, seedream, grok, fal)
  - `generate_video` — text/image-to-video across 17 engines (kling, kling-v3, veo3, sora, wan, minimax, vidu, lightricks, ltx2, hunyuan, mochi, ...)
  - `upscale_image` — 2x per pass, up to 3 passes (8x)
  - `enhance_prompt` — LLM prompt rewriting for sd1/sdxl/flux/ltx2 ecosystems
  - `submit_workflow` — raw workflow escape hatch for any step `$type` (training, comfy, TTS, ...)
  - `get_workflow`, `query_workflows`, `cancel_workflow` — workflow lifecycle management
  - `get_orchestrator_resource` — resource lookup by AIR identifier
- **Buzz-spend safety**: every paid tool defaults to a `whatif=true` dry-run returning a validated cost estimate (plus an insufficient-Buzz warning); real execution requires an explicit `confirmSpend: true`. Real submissions are never auto-retried.
- Orchestration tests in `comprehensive-test.js` (dry-run only, skipped when `CIVITAI_API_KEY` is unset); `runTest` now accepts a per-test timeout.

### Notes
- Generation helpers submit single-step workflows via `POST /v2/consumer/workflows` instead of the `/recipes/*` shortcuts — verified live that only the workflows endpoint returns whatif cost estimates and a pollable workflow id.
- Same `CIVITAI_API_KEY` is used for both APIs; every Orchestration endpoint requires it.

## [1.0.0] - 2025-01-26

### Added
- Initial release of Civitai MCP Server
- Complete Civitai API v1 integration with 14 comprehensive tools
- Advanced model search with flexible filtering by type, creator, tags, and base models
- Browse models by popularity, rating, and recency
- Creator profiles and portfolio browsing
- Generated image gallery with metadata and generation parameters
- Model version details and hash-based lookup
- Direct download URLs with authentication support
- Content safety information (pickle and virus scan results)
- TypeScript implementation with full type safety
- Zod schema validation for robust input handling
- Comprehensive error handling with rate limiting support
- MCP protocol compliance for seamless integration
- Support for all major model types: Checkpoint, LORA, ControlNet, TextualInversion, etc.
- NSFW content filtering and commercial use permissions
- Comprehensive documentation with usage examples
- Test suite for validation and development

### Tools Implemented
- `search_models` - Advanced model search with filters
- `get_model` - Detailed model information
- `get_model_version` - Version-specific details
- `get_model_version_by_hash` - Hash-based model lookup
- `browse_images` - Generated image gallery browsing
- `get_creators` - Creator profiles and search
- `get_tags` - Model tagging system access
- `get_popular_models` - Most downloaded models by time period
- `get_latest_models` - Recently uploaded models
- `get_top_rated_models` - Highest rated models by community
- `search_models_by_tag` - Tag-based model filtering
- `search_models_by_creator` - Creator-specific model browsing
- `get_models_by_type` - Type-based model discovery
- `get_download_url` - Direct model download access

### Technical Features
- Node.js 18+ compatibility
- TypeScript with strict type checking
- Zod runtime validation
- Comprehensive error handling
- Rate limiting awareness
- Environment variable configuration
- MCP stdio transport
- Cross-platform support
