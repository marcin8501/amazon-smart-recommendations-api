// Test script for local API function with in-memory caching
const apiFunction = require('./api/recommendations');

// Mock request object
const mockReq = {
  method: 'POST',
  body: {
    product: {
      title: "Sony WH-1000XM4 Wireless Noise Cancelling Headphones",
      price: "299.99",
      category: "Electronics",
      asin: "B0863TXGM3"
    },
    apiKey: process.env.PERPLEXITY_API_KEY || "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"
  }
};

// Create a response recorder
class ResponseRecorder {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.statusCode = 200;
    this.headers = {};
    this.body = null;
    this.ended = false;
  }
  
  status(code) {
    this.statusCode = code;
    return this;
  }
  
  setHeader(name, value) {
    this.headers[name] = value;
    return this;
  }
  
  json(data) {
    this.body = data;
    return this;
  }
  
  end() {
    this.ended = true;
    return this;
  }
}

// Main test function
async function testLocalCaching() {
  console.log("===== TESTING LOCAL IN-MEMORY CACHING =====");
  
  const mockRes = new ResponseRecorder();
  
  // First request
  console.log("Making first request (should use API)...");
  const startTime1 = Date.now();
  await apiFunction(mockReq, mockRes);
  const duration1 = Date.now() - startTime1;
  
  console.log(`First request completed in ${duration1}ms`);
  console.log("Response status:", mockRes.statusCode);
  
  if (mockRes.body && mockRes.body.metadata) {
    console.log("Metadata:", JSON.stringify(mockRes.body.metadata, null, 2));
  }
  
  // Store some response info
  const firstResponseId = mockRes.body?.id;
  const firstResponseTokens = mockRes.body?.usage?.total_tokens;
  
  // Reset the recorder
  mockRes.reset();
  
  // Second request - should use memory cache
  console.log("\nMaking second request (should use memory cache)...");
  const startTime2 = Date.now();
  await apiFunction(mockReq, mockRes);
  const duration2 = Date.now() - startTime2;
  
  console.log(`Second request completed in ${duration2}ms`);
  console.log("Response status:", mockRes.statusCode);
  
  if (mockRes.body && mockRes.body.metadata) {
    console.log("Metadata:", JSON.stringify(mockRes.body.metadata, null, 2));
  }
  
  // Check if it's cached
  const isCached = mockRes.body?.metadata?.cached === true;
  const cacheSource = mockRes.body?.metadata?.cacheSource;
  const secondResponseId = mockRes.body?.id;
  const secondResponseTokens = mockRes.body?.usage?.total_tokens;
  
  // Analyze the results
  console.log("\n===== RESULTS =====");
  
  if (isCached) {
    const speedup = duration1 / duration2;
    console.log(`✅ CACHING WORKS! ${speedup.toFixed(1)}x speedup`);
    console.log(`   First request: ${duration1}ms`);
    console.log(`   Second request: ${duration2}ms`);
    console.log(`   Cache source: ${cacheSource || "unknown"}`);
    
    if (firstResponseId === secondResponseId) {
      console.log("✅ Same response ID confirmed");
    }
    
    console.log("\n===== TOKEN USAGE =====");
    console.log(`First request tokens: ${firstResponseTokens || "unknown"}`);
    console.log(`Second request tokens: ${secondResponseTokens || "unknown"}`);
  } else {
    console.log("❌ CACHING NOT WORKING");
    console.log("   No cache metadata found in response");
    console.log(`   First request: ${duration1}ms`);
    console.log(`   Second request: ${duration2}ms`);
  }
}

// Run the test
console.log("Starting local cache test...");
testLocalCaching().catch(error => {
  console.error("Test failed:", error);
}); 