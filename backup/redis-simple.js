// Simple Redis test endpoint
const { Redis } = require('@upstash/redis');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // Check if Redis environment variables exist
    const envStatus = {
      KV_REST_API_URL: !!process.env.KV_REST_API_URL,
      KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN
    };

    // Initialize Redis client if environment variables exist
    if (envStatus.KV_REST_API_URL && envStatus.KV_REST_API_TOKEN) {
      const redis = new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      });
      
      // Simple string test
      await redis.set('simple-test', 'Hello from Redis', { ex: 60 });
      const result = await redis.get('simple-test');
      
      return res.status(200).json({
        success: true,
        message: 'Redis connection successful',
        test_result: result,
        env_status: envStatus
      });
    } else {
      // Environment variables missing
      return res.status(500).json({
        success: false,
        message: 'Redis environment variables missing',
        env_status: envStatus
      });
    }
  } catch (error) {
    // Any Redis errors
    console.error('Redis test failed:', error);
    return res.status(500).json({
      success: false,
      message: `Redis test failed: ${error.message}`,
      error_name: error.name,
      error_stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}; 