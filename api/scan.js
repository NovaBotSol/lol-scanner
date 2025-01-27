export default async function handler(req, res) {
    // Set JSON content type for all responses
    res.setHeader('Content-Type', 'application/json');
    
    try {
        // Parse request body
        const { target } = req.body ? JSON.parse(req.body) : {};
        
        // Validate input
        if (!target) {
            return res.status(400).json({ 
                error: "Invalid Request",
                message: "Missing target parameter" 
            });
        }

        // Validate API keys
        if (!process.env.WHOISXML_API_KEY || !process.env.GOOGLE_API_KEY) {
            throw new Error("Server configuration error: Missing API keys");
        }

        // API calls
        const [whoisData, gsbData, solscanData] = await Promise.all([
            fetch(`https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${process.env.WHOISXML_API_KEY}&domainName=${target}`),
            fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${process.env.GOOGLE_API_KEY}`, {
                method: 'POST',
                body: JSON.stringify({
                    client: { clientId: "lol-scanner", clientVersion: "1.0" },
                    threatInfo: { 
                        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING"],
                        platformTypes: ["ANY_PLATFORM"],
                        threatEntryTypes: ["URL"],
                        threatEntries: [{ url: target }]
                    }
                })
            }),
            fetch(`https://api.solscan.io/contract?address=${target}`)
        ]);

        // Process responses
        const response = {
            whois: {
                domainAge: await calculateDomainAge(await whoisData.text()),
                hasSSL: await checkSSL(target)
            },
            gsb: {
                malwareDetected: (await gsbData.json()).matches?.length > 0
            },
            solscan: {
                verified: (await solscanData.json()).verified
            }
        };

        res.status(200).json(response);
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: "Internal Server Error",
            message: error.message 
        });
    }
}

// Helper functions
async function calculateDomainAge(whoisText) {
    try {
        const creationDateMatch = whoisText.match(/Creation Date: (.*)/);
        if (!creationDateMatch) return 0;
        
        const createdDate = new Date(creationDateMatch[1]);
        const ageDays = Math.floor((Date.now() - createdDate) / (1000 * 86400));
        return Math.max(ageDays, 0);
    } catch {
        return 0;
    }
}

async function checkSSL(url) {
    try {
        const response = await fetch(`https://${url}`);
        return response.ok;
    } catch {
        return false;
    }
}
