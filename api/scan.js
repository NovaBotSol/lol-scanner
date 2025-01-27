export default async function handler(req, res) {
    const { target } = req.body ? JSON.parse(req.body) : { target: '' };

    // Validate input
    if (!target) {
        return res.status(400).json({ error: "Missing target parameter" });
    }

    try {
        // Validate API keys first
        if (!process.env.WHOISXML_API_KEY || !process.env.GOOGLE_API_KEY) {
            throw new Error("API keys not configured properly");
        }

        // [Keep the existing API call code here...]

        // Return proper JSON response
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(response);
    } catch (error) {
        // Return errors in JSON format
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ 
            error: "Server error", 
            message: error.message 
        });
    }
}

// Updated helper functions with error handling
async function calculateDomainAge(whoisText) {
    try {
        const creationMatch = whoisText.match(/Creation Date: (.*)/);
        if (!creationMatch) return 0;
        
        const createdDate = new Date(creationMatch[1]);
        return Math.floor((Date.now() - createdDate) / (1000 * 86400));
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
