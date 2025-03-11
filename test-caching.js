// Simple script to test if caching is working on the deployed API
const fetch = require('node-fetch');

// Your deployed API URL
const API_URL = 'https://amazon-smart-recommendations-hoi29sblt-marcin8501s-projects.vercel.app/api/recommendations';

// Your API key
const API_KEY = process.env.PERPLEXITY_API_KEY || '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';

// Test product
const TEST_PRODUCT = {
  title: "Sony WH-1000XM4 Wireless Noise Cancelling Headphones",
  price: "299.99",
  category: "Electronics",
  asin: "B0863TXGM3"
};

// Function to make an API request
async function makeRequest() {
  const startTime = Date.now();
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product: TEST_PRODUCT,
        apiKey: API_KEY
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      duration,
      data,
      cached: data.metadata && data.metadata.cached,
      cacheSource: data.metadata && data.metadata.cacheSource
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

// Function to run the test
async function runCachingTest() {
  console.log('=== CACHE TEST: TESTING DEPLOYED API ===');
  console.log('Making first request (should be uncached)...');
  
  const firstResult = await makeRequest();
  
  if (!firstResult.success) {
    console.error('First request failed:', firstResult.error);
    return;
  }
  
  console.log(`First request completed in ${firstResult.duration}ms`);
  console.log(`Cached: ${firstResult.cached || false}`);
  console.log(`Cache source: ${firstResult.cacheSource || 'none'}`);
  
  console.log('\nMaking second request (should use cache)...');
  
  const secondResult = await makeRequest();
  
  if (!secondResult.success) {
    console.error('Second request failed:', secondResult.error);
    return;
  }
  
  console.log(`Second request completed in ${secondResult.duration}ms`);
  console.log(`Cached: ${secondResult.cached || false}`);
  console.log(`Cache source: ${secondResult.cacheSource || 'none'}`);
  
  // Analyze results
  const speedup = firstResult.duration / secondResult.duration;
  
  console.log('\n=== RESULTS ===');
  if (secondResult.cached) {
    console.log(`✅ CACHING WORKS! ${speedup.toFixed(1)}x speedup (${firstResult.duration}ms → ${secondResult.duration}ms)`);
    console.log(`Cache source: ${secondResult.cacheSource}`);
  } else {
    console.log(`❌ CACHING NOT WORKING. No speedup detected.`);
    console.log('Check Vercel configuration and ensure KV is properly set up.');
  }
  
  // Check token usage
  if (firstResult.data && firstResult.data.usage && secondResult.data && secondResult.data.usage) {
    console.log('\n=== TOKEN USAGE ===');
    console.log(`First request: ${firstResult.data.usage.total_tokens} tokens`);
    console.log(`Second request: ${secondResult.data.usage.total_tokens || 0} tokens`);
    
    if (!secondResult.data.usage || secondResult.data.usage.total_tokens === 0) {
      console.log('✅ No tokens used for cached request - cost saving confirmed!');
    }
  }
}

// Run the test
console.log('Starting caching test...');
runCachingTest().catch(error => {
  console.error('Test failed:', error);
}); 