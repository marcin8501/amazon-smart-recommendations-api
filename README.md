# Amazon Smart Recommendations Extension

A browser extension that enhances Amazon shopping by providing AI-powered product recommendations using Google Gemini.

## Features

- **AI-Powered Recommendations**: Get intelligent product alternatives while shopping on Amazon
- **Google Gemini Integration**: Leverages Google's Gemini 1.5 Flash model for high-quality recommendations
- **Smart Caching**: Efficient caching system reduces API calls and improves performance
- **User Settings**: Customize the extension behavior through an intuitive settings panel
- **Dark/Light Theme**: Choose your preferred visual theme
- **Affiliate Links**: Monetize recommendations with Amazon affiliate links

## How It Works

1. The extension detects when you're browsing an Amazon product page
2. It extracts key product details (title, price, category, etc.)
3. This data is sent to our serverless API which uses Google Gemini to generate intelligent recommendations
4. The recommendations are displayed in a sleek popup on the Amazon page
5. Click any recommendation to view it on Amazon

## Installation

1. Download the extension from the Chrome Web Store (link coming soon)
2. Click "Add to Chrome" to install
3. Browse to any Amazon product page to see it in action

## Using Your Own Google API Key (Optional)

For the best experience, you can use your own Google API key:

1. Get a Google API key from the [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click the extension icon in your browser toolbar
3. Enter your API key in the settings panel
4. Click "Save Settings"

## Privacy

- The extension only accesses data on Amazon product pages
- Product data is sent to our secure API for processing
- No personal browsing history is collected or stored
- API responses are cached to minimize data transfer

## Development

### Extension Structure

- `manifest.json`: Extension configuration
- `contentScript.js`: Runs on Amazon pages to extract data and display recommendations
- `background.js`: Handles API communication and caching
- `popup.html/js`: Settings UI for the extension
- `style.css`: Styling for the recommendation panel
- `api/gemini.js`: Serverless API endpoint that communicates with Google Gemini

### API Endpoints

- Production: `https://amazon-smart-recommendations-api.vercel.app/api/gemini`
- The API is hosted on Vercel and uses Upstash Redis for caching

### Building From Source

1. Clone the repository
2. Install dependencies: `npm install`
3. Make your changes
4. Load the unpacked extension in Chrome's developer mode

## Version History

- **v3.1.0**: Google Gemini integration, improved UI, settings panel
- **v3.0.0**: Initial public release with Perplexity API

## License

MIT License - See LICENSE file for details

## Credits

- Google Gemini API for AI recommendations
- Vercel for serverless hosting
- Upstash for Redis caching 