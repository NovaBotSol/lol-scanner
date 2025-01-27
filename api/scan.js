export default async function handler(req, res) {
    const { target } = JSON.parse(req.body);

    // API configuration
    const API_KEYS = {
        whoisxml: process.env.WHOISXML_API_KEY,
        gsb: process.env.GOOGLE_API_KEY,
        solscan: process.env.SOLSCAN_API_KEY
    };

    try {
        const [whoisData, gsbData, solscanData] = await Promise.all([
            fetch(`https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${API_KEYS.whoisxml}&domainName=${target}`),
            fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${API_KEYS.gsb}`, {
                method: 'POST',
                body: JSON.stringify({
                    client: { clientId: "lol-scanner", clientVersion: "1.0" },
                    threatInfo: { url: target }
                })
            }),
            fetch(`https://api.solscan.io/contract?address=${target}`)
        ]);

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
        res.status(500).json({ error: error.message });
    }
}

// Helper functions
async function calculateDomainAge(whoisText) {
    const createdDate = new Date(whoisText.match(/Creation Date: (.*)/)[1]);
    return Math.floor((Date.now() - createdDate) / (1000 * 86400));
}

async function checkSSL(url) {
    const response = await fetch(`https://${url}`);
    return response.ok;
}
