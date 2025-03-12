// Local test script for the hybrid caching system
const recommendationsApi = require('./api/recommendations');

// Mock Vercel KV for local testing
const mockKV = {
  _store: {},
  async get(key) {
    console.log(`[MOCK KV] Getting: ${key}`);
    return this._store[key] || null;
  },
  async set(key, value, options) {
    console.log(`[MOCK KV] Setting: ${key} with TTL: ${options?.ex || 'none'}`);
    this._store[key] = value;
    return true;
  }
};

// Override require('@vercel/kv') with our mock
require.cache[require.resolve('@vercel/kv')] = {
  exports: { kv: mockKV }
};

// Mock request for the Sony headphones
const mockReq = {
  method: 'POST',
  body: {
    product: {
      title: "Sony WH-1000XM4 Wireless Noise Cancelling Headphones",
      price: "299.99",
      category: "Electronics",
      asin: "B0863TXGM3"
    },
    apiKey: process.env.PERPLEXITY_API_KEY || "YOUR_API_KEY_HERE" // Replace with your API key
  }
};

// Mock response object
const mockRes = {
  _headers: {},
  _status: 200,
  _body: null,
  
  status(code) {
    this._status = code;
    return this;
  },
  
  setHeader(name, value) {
    this._headers[name] = value;
    return this;
  },
  
  json(data) {
    this._body = data;
    console.log('Response status:', this._status);
    console.log('Response headers:', this._headers);
    console.log('Response data:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
    return this;
  },
  
  end() {
    console.log('Response ended');
    return this;
  }
};

// Function to run tests
async function runTests() {
  console.log('=== TEST 1: FIRST REQUEST (should use API) ===');
  console.time('First request');
  await recommendationsApi(mockReq, mockRes);
  console.timeEnd('First request');
  
  console.log('\n\n=== TEST 2: SECOND REQUEST (should use memory cache) ===');
  console.time('Second request');
  await recommendationsApi(mockReq, mockRes);
  console.timeEnd('Second request');
  
  console.log('\n\n=== TEST 3: SIMULATING COLD START (clearing memory cache) ===');
  // Clear in-memory cache to simulate function cold start
  // We need to do this by requiring the module directly
  try {
    // This is a hack to access the memCache object
    const memCacheObj = require('./api/recommendations').memCache;
    if (memCacheObj && memCacheObj.data) {
      console.log('Clearing in-memory cache...');
      Object.keys(memCacheObj.data).forEach(key => {
        delete memCacheObj.data[key];
      });
      console.log('In-memory cache cleared');
    } else {
      console.log('Memory cache not directly accessible - using workaround');
      // Alternative approach
      global.memCache = { data: {} };
    }
  } catch (e) {
    console.log('Could not access memory cache directly:', e.message);
  }
  
  console.log('\n=== TEST 4: AFTER COLD START (should use KV cache) ===');
  console.time('After cold start');
  await recommendationsApi(mockReq, mockRes);
  console.timeEnd('After cold start');
}

// Run the tests
console.log('Starting cache tests...');

// Set API key from environment if available
if (process.env.PERPLEXITY_API_KEY) {
  mockReq.body.apiKey = process.env.PERPLEXITY_API_KEY;
  console.log('Using API key from environment');
} else {
  console.log('WARNING: No API key found in environment. Set PERPLEXITY_API_KEY to run tests.');
}

runTests().catch(error => {
  console.error('Test failed:', error);
}); 