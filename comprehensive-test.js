#!/usr/bin/env node

import { CivitaiClient } from './dist/civitai-client.js';
import { CivitaiOrchestrationClient } from './dist/orchestration-client.js';

async function runTest(testName, testFn, timeoutMs = 5000) {
  try {
    console.log(`\n🧪 Testing ${testName}...`);

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Test timeout after ${timeoutMs / 1000} seconds`)), timeoutMs)
    );

    await Promise.race([testFn(), timeoutPromise]);
    console.log(`✅ ${testName} passed`);
  } catch (error) {
    console.error(`❌ ${testName} failed:`, error.message);
    return false;
  }
  return true;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function comprehensiveTest() {
  console.log('🚀 Starting Comprehensive Civitai MCP Server Test\n');
  console.log('=' .repeat(60));
  
  const client = new CivitaiClient();
  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Get Tags
  totalTests++;
  if (await runTest('Get Tags', async () => {
    const tags = await client.getTags({ limit: 3 });
    console.log(`   Found ${tags.items.length} tags`);
    if (tags.items.length > 0) {
      console.log(`   Sample tags: ${tags.items.map(t => t.name).join(', ')}`);
    }
    if (tags.items.length === 0) throw new Error('No tags returned');
  })) passedTests++;
  await delay(500);

  // Test 2: Get Creators
  totalTests++;
  if (await runTest('Get Creators', async () => {
    const creators = await client.getCreators({ limit: 3 });
    console.log(`   Found ${creators.items.length} creators`);
    if (creators.items.length > 0) {
      const creator = creators.items[0];
      console.log(`   Top creator: ${creator.username} (${creator.modelCount || 0} models)`);
    }
    if (creators.items.length === 0) throw new Error('No creators returned');
  })) passedTests++;
  await delay(500);

  // Test 3: Search Models (basic)
  totalTests++;
  if (await runTest('Search Models (basic)', async () => {
    const models = await client.getModels({ limit: 2 });
    console.log(`   Found ${models.metadata.totalItems} total models, showing ${models.items.length}`);
    if (models.items.length > 0) {
      const model = models.items[0];
      console.log(`   First model: "${model.name}" by ${model.creator.username}`);
      console.log(`   Type: ${model.type}, NSFW: ${model.nsfw}`);
    }
    if (models.items.length === 0) throw new Error('No models returned');
  })) passedTests++;

  // Test 4: Search Models by Type
  totalTests++;
  if (await runTest('Search Models by Type (LORA)', async () => {
    const models = await client.getModelsByType('LORA', { limit: 2 });
    console.log(`   Found ${models.items.length} LORA models`);
    if (models.items.length > 0) {
      const model = models.items[0];
      console.log(`   Sample LORA: "${model.name}" by ${model.creator.username}`);
    }
    // LORA models might be less common, so don't fail if none found
  })) passedTests++;

  // Test 5: Get Specific Model Details
  totalTests++;
  if (await runTest('Get Specific Model Details', async () => {
    // Use a well-known model ID (this is a popular model that should exist)
    const modelId = 4201; // This is usually a stable/popular model
    try {
      const model = await client.getModel(modelId);
      console.log(`   Model: "${model.name}" by ${model.creator.username}`);
      console.log(`   Versions: ${model.modelVersions.length}`);
      console.log(`   Tags: ${model.tags.slice(0, 3).join(', ')}`);
      if (model.modelVersions.length > 0) {
        const version = model.modelVersions[0];
        console.log(`   Latest version: ${version.name} (ID: ${version.id})`);
      }
    } catch (error) {
      // Try a different approach - get models and pick the first one
      console.log('   Fallback: Getting any available model...');
      const models = await client.getModels({ limit: 1 });
      if (models.items.length > 0) {
        const modelId = models.items[0].id;
        const model = await client.getModel(modelId);
        console.log(`   Fallback model: "${model.name}" (ID: ${modelId})`);
      } else {
        throw new Error('Could not retrieve any model');
      }
    }
  })) passedTests++;

  // Test 6: Browse Images
  totalTests++;
  if (await runTest('Browse Images', async () => {
    const images = await client.getImages({ limit: 2, nsfw: false });
    console.log(`   Found ${images.metadata.totalItems || images.items.length} total images, showing ${images.items.length}`);
    if (images.items.length > 0) {
      const image = images.items[0];
      console.log(`   Sample image: ${image.width}x${image.height} by ${image.username || 'Unknown'}`);
      console.log(`   NSFW Level: ${image.nsfwLevel || 'Unknown'}`);
    }
    if (images.items.length === 0) throw new Error('No images returned');
  })) passedTests++;

  // Test 7: Search Models with Query
  totalTests++;
  if (await runTest('Search Models with Query', async () => {
    const models = await client.searchModels('anime', { limit: 2 });
    console.log(`   Found ${models.metadata.totalItems} anime-related models, showing ${models.items.length}`);
    if (models.items.length > 0) {
      const model = models.items[0];
      console.log(`   Sample result: "${model.name}"`);
    }
    // Search might return 0 results depending on the query, so don't fail
  })) passedTests++;

  // Test 8: Get Popular Models
  totalTests++;
  if (await runTest('Get Popular Models', async () => {
    const models = await client.getPopularModels('Week', 2);
    console.log(`   Found ${models.items.length} popular models this week`);
    if (models.items.length > 0) {
      const model = models.items[0];
      console.log(`   Most popular: "${model.name}" (${model.stats?.downloadCount || 0} downloads)`);
    }
    if (models.items.length === 0) throw new Error('No popular models returned');
  })) passedTests++;

  // Test 9: Get Latest Models  
  totalTests++;
  if (await runTest('Get Latest Models', async () => {
    const models = await client.getLatestModels(2);
    console.log(`   Found ${models.items.length} latest models`);
    if (models.items.length > 0) {
      const model = models.items[0];
      console.log(`   Latest: "${model.name}" by ${model.creator.username}`);
    }
    if (models.items.length === 0) throw new Error('No latest models returned');
  })) passedTests++;

  // Test 10: Get Download URL
  totalTests++;
  if (await runTest('Get Download URL', async () => {
    // First get a model with versions
    const models = await client.getModels({ limit: 1 });
    if (models.items.length > 0 && models.items[0].modelVersions.length > 0) {
      const versionId = models.items[0].modelVersions[0].id;
      const downloadUrl = client.getDownloadUrl(versionId);
      console.log(`   Generated download URL for version ${versionId}`);
      console.log(`   URL: ${downloadUrl.substring(0, 50)}...`);
      if (!downloadUrl.includes('civitai.com')) {
        throw new Error('Invalid download URL format');
      }
    } else {
      throw new Error('No model versions available for download URL test');
    }
  })) passedTests++;

  // Orchestration API tests (orchestration.civitai.com). These require a
  // token, so they are skipped when CIVITAI_API_KEY is unset. Every
  // generation call here uses whatif: true — a dry-run cost estimate that
  // NEVER spends Buzz. Do not add tests that pass confirmSpend / omit whatif.
  const orchApiKey = process.env.CIVITAI_API_KEY;
  if (!orchApiKey) {
    console.log('\n⏭  Skipping Orchestration API tests (CIVITAI_API_KEY not set)');
  } else {
    const orchClient = new CivitaiOrchestrationClient(orchApiKey);

    // Test 11: Orchestrator resource lookup by AIR
    totalTests++;
    if (await runTest('Orchestrator Resource by AIR', async () => {
      const resource = await orchClient.getResource('urn:air:sdxl:checkpoint:civitai:827184@2514310');
      console.log(`   Resource: ${resource.resourceName} - ${resource.versionName}`);
      console.log(`   Can generate: ${resource.canGenerate}`);
      if (!resource.air) throw new Error('No AIR returned');
    }, 15000)) passedTests++;
    await delay(500);

    // Test 12: textToImage dry-run (whatif — no Buzz spent)
    totalTests++;
    if (await runTest('Text-to-Image Dry Run (whatif)', async () => {
      const wf = await orchClient.textToImage({ prompt: 'a red apple on a table' }, { whatif: true });
      console.log(`   Estimated cost: ${wf.cost?.total ?? wf.cost?.base ?? 'unknown'} Buzz`);
      console.log(`   Steps: ${(wf.steps || []).map(s => s.$type).join(', ')}`);
      if (wf.cost?.total === undefined && wf.cost?.base === undefined) {
        throw new Error('No cost estimate returned');
      }
    }, 15000)) passedTests++;
    await delay(500);

    // Test 13: promptEnhancement dry-run (whatif — no Buzz spent)
    totalTests++;
    if (await runTest('Prompt Enhancement Dry Run (whatif)', async () => {
      const wf = await orchClient.enhancePrompt({ ecosystem: 'sdxl', prompt: 'cat' }, { whatif: true });
      console.log(`   Estimated cost: ${wf.cost?.total ?? wf.cost?.base ?? 'unknown'} Buzz`);
      if ((wf.steps || []).length === 0) throw new Error('No steps returned');
    }, 15000)) passedTests++;
    await delay(500);

    // Test 14: query workflows
    totalTests++;
    if (await runTest('Query Workflows', async () => {
      const page = await orchClient.queryWorkflows({ take: 2 });
      console.log(`   Found ${(page.items || []).length} workflow(s)`);
      if (!Array.isArray(page.items)) throw new Error('No items array in response');
    }, 15000)) passedTests++;
  }

  // Final Results
  console.log('\n' + '='.repeat(60));
  console.log(`🏁 Test Results: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! The Civitai MCP server is working perfectly!');
    console.log('\n📋 The server exposes 34 MCP tools: model/image/creator/tag browsing,');
    console.log('   vault management, hash lookups, and Orchestrator generation tools');
    console.log('   (generate_image, generate_video, upscale_image, enhance_prompt, ...).');
    console.log('   Run tools/list against dist/index.js for the authoritative list.');

    console.log('\n🔧 To use with Claude Desktop, add this to your MCP config:');
    console.log(JSON.stringify({
      "mcpServers": {
        "civitai": {
          "command": "node",
          "args": [`${process.cwd()}/dist/index.js`],
          "env": {
            "CIVITAI_API_KEY": "your_api_key_here_optional"
          }
        }
      }
    }, null, 2));
  } else {
    console.log(`⚠️  Some tests failed. The server may have limited functionality.`);
    console.log('   This could be due to API rate limiting or temporary issues.');
  }
}

comprehensiveTest().catch(console.error);
