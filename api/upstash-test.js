// Test function to verify Upstash Redis connection
const { Redis } = require('@upstash/redis');

// Initialize Redis client with the specific environment variables provided by Upstash
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

module.exports = async (req, res) => {
  // Set CORS headers - allow from any origin to make testing easier
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // Debug environment variables (without exposing sensitive values)
    const envDebug = {
      KV_URL_exists: !!process.env.KV_URL,
      KV_REST_API_URL_exists: !!process.env.KV_REST_API_URL,
      KV_REST_API_TOKEN_exists: !!process.env.KV_REST_API_TOKEN,
      KV_REST_API_READ_ONLY_TOKEN_exists: !!process.env.KV_REST_API_READ_ONLY_TOKEN
    };

    // Test with a simple string value first
    const stringKey = 'test-string';
    await redis.set(stringKey, "This is a test string", { ex: 300 });
    const stringResult = await redis.get(stringKey);
    
    // Test with a properly serialized JSON object
    const jsonKey = 'test-json';
    const jsonValue = { test: true, timestamp: Date.now() };
    await redis.set(jsonKey, JSON.stringify(jsonValue), { ex: 300 });
    const jsonResult = await redis.get(jsonKey);
    const parsedResult = jsonResult ? JSON.parse(jsonResult) : null;
    
    return res.status(200).json({
      success: true,
      message: 'Redis test completed',
      string_test: { 
        value: "This is a test string", 
        result: stringResult 
      },
      json_test: {
        value: jsonValue,
        serialized: JSON.stringify(jsonValue),
        result: jsonResult,
        parsed: parsedResult
      },
      envDebug
    });
  } catch (error) {
    console.error('Redis test error:', error);
    return res.status(500).json({
      success: false,
      error: 'Redis test failed',
      message: error.message,
      envDebug
    });
  }
}; 