// Simple test function to verify Vercel deployment

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const responseData = {
    message: "Hello from Vercel Functions!",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  };
  
  res.status(200).json(responseData);
}; 