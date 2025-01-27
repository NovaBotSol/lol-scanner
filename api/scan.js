const fetch = require('node-fetch');

async function handler(req, res) {
    // Set CORS and content headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { target } = req.body;
        if (!target) {
            return res.status(400).json({ error: 'Target URL is required' });
        }

        // Validate URL format
        try {
            new URL(target);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        // Fetch and analyze website content
        let websiteContent = '';
        try {
            const siteResponse = await fetch(target, {
                headers: { 'User-Agent': 'AI-Legitimacy-Scanner/1.0' }
            });
            websiteContent = await siteResponse.text();
        } catch (error) {
            console.error('Error fetching website:', error);
            return res.status(400).json({ error: 'Unable to access website' });
        }

        // Check for AI-related content
        const aiKeywords = [
            'artificial intelligence',
            'machine learning',
            'neural network',
            'deep learning',
            'nlp',
            'computer vision',
            'ai model'
        ];
        const aiMentions = aiKeywords.some(keyword => 
            websiteContent.toLowerCase().includes(keyword)
        );

        // Check for whitepaper or technical documentation
        const docKeywords = [
            'whitepaper',
            'technical paper',
            'documentation',
            'research paper',
            'technical details'
        ];
        const hasWhitepaper = docKeywords.some(keyword =>
            websiteContent.toLowerCase().includes(keyword)
        );

        // Check team transparency
        const aboutResponse = await fetch(`${target}/about`).catch(() => null);
        const teamResponse = await fetch(`${target}/team`).catch(() => null);
        const teamContent = await Promise.all([
            aboutResponse?.text() || '',
            teamResponse?.text() || ''
        ]).catch(() => ['', '']);
        const teamTransparency = teamContent.some(content =>
            /team|about us|our mission|founders/i.test(content)
        );

        // Check GitHub activity (if linked)
        let githubActivity = false;
        const githubMatch = websiteContent.match(/github\.com\/([^/"]+)/);
        if (githubMatch) {
            try {
                const githubResponse = await fetch(
                    `https://api.github.com/users/${githubMatch[1]}/repos`
                );
                if (githubResponse.ok) {
                    const repos = await githubResponse.json();
                    githubActivity = repos.length > 0;
                }
            } catch (error) {
                console.error('GitHub API error:', error);
            }
        }

        // Calculate domain age
        const domainAge = 400; // Placeholder - implement actual calculation if needed

        // Construct response
        const responseData = {
            aiMentions,
            whitepaper: hasWhitepaper,
            teamTransparency,
            githubActivity,
            domainAge,
            socialProof: false // Placeholder - implement if needed
        };

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

module.exports = handler;