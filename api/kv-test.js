// Test function to verify Vercel KV connection
const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // Try to set a test value in KV
    const testKey = 'test-connection';
    const testValue = {
      message: 'KV connection successful',
      timestamp: Date.now()
    };
    
    await kv.set(testKey, JSON.stringify(testValue), { ex: 300 }); // expires in 5 minutes
    
    // Try to get the value back
    const retrievedValue = await kv.get(testKey);
    
    // Return success with connection details
    return res.status(200).json({
      success: true,
      message: 'Vercel KV connection test successful',
      storedValue: testValue,
      retrievedValue: typeof retrievedValue === 'string' ? JSON.parse(retrievedValue) : retrievedValue,
      kvInfo: {
        url_configured: !!process.env.KV_URL,
        rest_api_configured: !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN
      }
    });
  } catch (error) {
    console.error('KV Test Error:', error.message);
    
    // Return error details
    return res.status(500).json({
      success: false,
      error: 'Vercel KV connection test failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      kvInfo: {
        url_configured: !!process.env.KV_URL,
        rest_api_configured: !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN
      }
    });
  }
}; 