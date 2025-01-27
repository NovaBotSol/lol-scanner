const fetch = require('node-fetch'); // Required for Node.js <18

async function handler(req, res) {
    try {
        // Validate request method first
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // Parse body safely
        const { target } = req.body;
        if (!target) {
            return res.status(400).json({ error: 'Missing target parameter' });
        }

        // Validate environment variables
        const requiredEnvVars = ['WHOISXML_API_KEY', 'GOOGLE_API_KEY'];
        const missingVars = requiredEnvVars.filter(v => !process.env[v]);
        if (missingVars.length > 0) {
            return res.status(500).json({ 
                error: `Missing environment variables: ${missingVars.join(', ')}`
            });
        }

        // API call helper with error handling
        const fetchWithTimeout = async (url, options = {}, timeout = 5000) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                return response;
            } catch (error) {
                clearTimeout(timeoutId);
                throw new Error(`API request failed: ${error.message}`);
            }
        };

        // Make parallel API calls with timeout
        const [whoisResponse, gsbResponse, solscanResponse] = await Promise.all([
            fetchWithTimeout(
                `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${process.env.WHOISXML_API_KEY}&domainName=${target}`
            ),
            fetchWithTimeout(
                `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${process.env.GOOGLE_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        client: { 
                            clientId: "lol-scanner",
                            clientVersion: "1.0"
                        },
                        threatInfo: {
                            threatTypes: ["MALWARE"],
                            platformTypes: ["ANY_PLATFORM"],
                            threatEntryTypes: ["URL"],
                            threatEntries: [{ url: target }]
                        }
                    })
                }
            ),
            fetchWithTimeout(
                `https://api.solscan.io/contract?address=${target}`,
                { timeout: 8000 } // Longer timeout for 3rd party API
            )
        ]);

        // Process WHOIS data safely
        const whoisText = await whoisResponse.text();
        const creationDateMatch = whoisText.match(/Creation Date: (.*)/);
        const creationDate = creationDateMatch ? creationDateMatch[1] : null;

        // Process all responses
        const responseData = {
            whois: {
                domainAge: creationDate ? 
                    Math.floor((Date.now() - new Date(creationDate)) / (86400 * 1000)) : 0,
                hasSSL: target.startsWith('https://') // Simplified SSL check
            },
            gsb: {
                malwareDetected: (await gsbResponse.json()).matches?.length > 0
            },
            solscan: {
                verified: (await solscanResponse.json()).verified || false
            }
        };

        res.status(200).json(responseData);

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

module.exports = handler;
