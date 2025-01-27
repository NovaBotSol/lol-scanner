const fetch = require('node-fetch');

// Validate Solana address format
const isValidSolanaAddress = (address) => {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
};

// Validate URL format
const isValidURL = (str) => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Parse and validate input
    const { target } = req.body;
    if (!target) {
      return res.status(400).json({ error: 'Missing target parameter' });
    }

    // Determine input type
    const isURL = isValidURL(target);
    const isSolanaAddress = isValidSolanaAddress(target);

    if (!isURL && !isSolanaAddress) {
      return res.status(400).json({ error: 'Invalid URL or Solana address' });
    }

    // Validate environment variables
    if (!process.env.WHOISXML_API_KEY || !process.env.GOOGLE_API_KEY) {
      throw new Error("Missing required API keys");
    }

    // Prepare data collection
    const responseData = {
      whois: { domainAge: 0, hasSSL: false },
      gsb: { malwareDetected: false },
      solscan: { verified: false }
    };

    // Process URL checks
    if (isURL) {
      // WHOIS check
      const whoisResponse = await fetch(
        `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${process.env.WHOISXML_API_KEY}&domainName=${target}`
      );
      const whoisText = await whoisResponse.text();
      const creationDate = whoisText.match(/Creation Date: (.*)/)?.[1];
      responseData.whois.domainAge = creationDate ? 
        Math.floor((Date.now() - new Date(creationDate)) / (86400 * 1000)) : 0;
      
      // SSL check
      responseData.whois.hasSSL = target.startsWith('https://');

      // Google Safe Browsing check
      const gsbResponse = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${process.env.GOOGLE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: { clientId: "lol-scanner", clientVersion: "1.0" },
            threatInfo: {
              threatTypes: ["MALWARE"],
              threatEntryTypes: ["URL"],
              threatEntries: [{ url: target }]
            }
          })
        }
      );
      const gsbData = await gsbResponse.json();
      responseData.gsb.malwareDetected = gsbData.matches?.length > 0;
    }

    // Process Solana contract check
    if (isSolanaAddress) {
      try {
        const solscanResponse = await fetch(
          `https://api.solscan.io/contract?address=${target}`,
          { headers: { 'User-Agent': 'LOL-Scanner/1.0' } }
        );
        const solscanData = await solscanResponse.json();
        responseData.solscan.verified = solscanData.verified || false;
      } catch (error) {
        console.error('Solscan API error:', error);
      }
    }

    res.status(200).json(responseData);

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: error.message,
      inputType: isValidURL(target) ? 'URL' : 
                isValidSolanaAddress(target) ? 'Solana' : 'Invalid'
    });
  }
}

module.exports = handler;