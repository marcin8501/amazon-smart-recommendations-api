// Simple health check endpoint for the Amazon Smart Recommendations API

module.exports = (req, res) => {
  // Set CORS headers to allow requests from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Return a 200 OK status with service information
  return res.status(200).json({
    status: 'healthy',
    service: 'Amazon Smart Recommendations API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}; 