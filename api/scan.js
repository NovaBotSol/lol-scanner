export default async function handler(req, res) {
    // Set JSON header FIRST
    res.setHeader('Content-Type', 'application/json');
    
    try {
        // Validate request
        if (!req.body) throw new Error("Empty request body");
        const { target } = JSON.parse(req.body);
        if (!target) throw new Error("Missing target parameter");
        if (!process.env.WHOISXML_API_KEY) throw new Error("WHOISXML_API_KEY not set");
        if (!process.env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not set");

        // Make API calls with error handling
        const whoisResponse = await fetch(
            `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${process.env.WHOISXML_API_KEY}&domainName=${target}`
        );
        if (!whoisResponse.ok) throw new Error(`WHOIS API error: ${whoisResponse.statusText}`);
        
        const gsbResponse = await fetch(
            `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${process.env.GOOGLE_API_KEY}`,
            {
                method: 'POST',
                body: JSON.stringify({
                    client: { clientId: "lol-scanner", clientVersion: "1.0" },
                    threatInfo: {
                        threatTypes: ["MALWARE"],
                        platformTypes: ["ANY_PLATFORM"],
                        threatEntryTypes: ["URL"],
                        threatEntries: [{ url: target }]
                    }
                })
            }
        );
        if (!gsbResponse.ok) throw new Error(`Google API error: ${gsbResponse.statusText}`);
        
        const solscanResponse = await fetch(
            `https://api.solscan.io/contract?address=${target}`
        );
        if (!solscanResponse.ok) throw new Error(`Solscan API error: ${solscanResponse.statusText}`);

        // Process data
        const responseData = {
            whois: {
                domainAge: calculateDomainAge(await whoisResponse.text()),
                hasSSL: await checkSSL(target)
            },
            gsb: {
                malwareDetected: (await gsbResponse.json()).matches?.length > 0
            },
            solscan: {
                verified: (await solscanResponse.json()).verified
            }
        };

        res.status(200).json(responseData);
        
    } catch (error) {
        // Return PROPER error format
        res.status(500).json({
            error: "ServerError",
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

// Helper functions
function calculateDomainAge(whoisText) {
    try {
        const creationDate = whoisText.match(/Creation Date: (.*)/)[1];
        const ageDays = (Date.now() - new Date(creationDate)) / (86400 * 1000);
        return Math.floor(ageDays);
    } catch {
        return 0;
    }
}

async function checkSSL(url) {
    try {
        const test = await fetch(`https://${url}`, { redirect: 'error' });
        return test.ok;
    } catch {
        return false;
    }
}
