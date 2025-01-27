const fetch = require('node-fetch');

async function handler(req, res) {
    try {
        const { target } = req.body;
        
        // New AI-focused checks
        const [whoisData, contentAnalysis] = await Promise.all([
            getWhoisData(target),
            analyzeContent(target)
        ]);

        const responseData = {
            domainAge: whoisData.domainAge,
            aiMentions: contentAnalysis.aiKeywords,
            whitepaper: contentAnalysis.hasWhitepaper,
            teamTransparency: await checkTeamTransparency(target),
            githubActivity: await checkGitHubActivity(target),
            socialProof: await checkSocialPresence(target)
        };

        res.status(200).json(responseData);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Helper functions for new parameters
async function analyzeContent(url) {
    const response = await fetch(url);
    const html = await response.text();
    
    return {
        aiKeywords: /artificial intelligence|machine learning|neural network/i.test(html),
        hasWhitepaper: /whitepaper\.pdf/i.test(html)
    };
}

async function checkTeamTransparency(url) {
    const response = await fetch(`${url}/about`);
    const html = await response.text();
    return /meet the team|our team/i.test(html);
}

async function checkGitHubActivity(url) {
    const repoMatch = url.match(/github\.com\/([^/]+)/);
    if (!repoMatch) return false;
    
    const response = await fetch(`https://api.github.com/repos/${repoMatch[1]}/commits`);
    const commits = await response.json();
    return commits.length > 10;
}

async function checkSocialPresence(url) {
    const domain = new URL(url).hostname;
    const twitterCheck = await fetch(`https://twitter.com/${domain}`);
    return twitterCheck.status === 200;
}

module.exports = handler;