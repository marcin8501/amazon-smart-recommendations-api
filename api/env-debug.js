// Debug endpoint to check environment variables
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
    // Get all environment variables (without exposing values)
    const envVars = Object.keys(process.env).reduce((acc, key) => {
      // Don't expose sensitive values, just whether they exist
      acc[key] = key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET') 
        ? `${process.env[key].substring(0, 3)}...${process.env[key].substring(process.env[key].length - 3)}`
        : process.env[key];
      return acc;
    }, {});

    // Check for specific Redis-related variables
    const upstashVars = {
      hasKvUrl: !!process.env.KV_URL,
      hasKvRestApiUrl: !!process.env.KV_REST_API_URL,
      hasKvRestApiToken: !!process.env.KV_REST_API_TOKEN,
      hasKvRestApiReadOnlyToken: !!process.env.KV_REST_API_READ_ONLY_TOKEN
    };

    return res.status(200).json({
      success: true,
      message: "Environment variables check",
      // Only return the abbreviated variable names in production, full in development
      env: process.env.NODE_ENV === 'production' 
        ? Object.keys(process.env).reduce((acc, key) => { acc[key] = !!process.env[key]; return acc; }, {})
        : envVars,
      upstashVars,
      nodeEnv: process.env.NODE_ENV || 'not set'
    });
  } catch (error) {
    console.error('Debug Error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Error checking environment variables',
      message: error.message
    });
  }
}; 