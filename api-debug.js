// Debug script for testing the recommendations API locally
const recommendationsApi = require('./api/recommendations');

// Mock request and response objects
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

const mockRes = {
  status: (code) => {
    console.log(`Response status: ${code}`);
    return mockRes;
  },
  setHeader: (name, value) => {
    console.log(`Setting header: ${name}: ${value}`);
    return mockRes;
  },
  json: (data) => {
    console.log('Response data:');
    console.log(JSON.stringify(data, null, 2));
    return mockRes;
  },
  end: () => {
    console.log('Response ended');
    return mockRes;
  }
};

// Run the API function
console.log('Testing recommendations API...');
recommendationsApi(mockReq, mockRes)
  .then(() => {
    console.log('API function completed');
  })
  .catch((error) => {
    console.error('Error running API function:', error);
  }); 