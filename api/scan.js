const fetch = require('node-fetch');

async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        if (req.method !== 'POST') {
            return res.status(400).json({ error: 'Method not allowed' });
        }

        const { target } = req.body;
        if (!target) {
            return res.status(400).json({ error: 'Target URL is required' });
        }

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

        // Advanced AI Technology Check
        const aiTechScore = checkAITechnology(websiteContent);

        // Technical Documentation Check
        const documentationScore = checkTechnicalDocumentation(websiteContent);

        // Team and Company Check
        const teamScore = await checkTeamAndCompany(target, websiteContent);

        // Development Activity Check
        const devScore = await checkDevelopmentActivity(websiteContent);

        // Market Presence Check
        const marketScore = await checkMarketPresence(target, websiteContent);

        // Social Proof and Community
        const socialScore = await checkSocialProof(target, websiteContent);

        // Construct detailed response
        const responseData = {
            aiMentions: aiTechScore.score > 0,
            whitepaper: documentationScore.hasWhitepaper,
            teamTransparency: teamScore.hasTeam,
            githubActivity: devScore.hasActivity,
            scores: {
                aiTechnology: aiTechScore.score,
                documentation: documentationScore.score,
                team: teamScore.score,
                development: devScore.score,
                market: marketScore.score,
                social: socialScore.score
            },
            details: {
                aiTech: aiTechScore.details,
                docs: documentationScore.details,
                team: teamScore.details,
                dev: devScore.details,
                market: marketScore.details,
                social: socialScore.details
            }
        };

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: error.message });
    }
}

function checkAITechnology(content) {
    const contentLower = content.toLowerCase();
    let score = 0;
    const details = [];

    // Core AI Terms (25 points max)
    const aiTerms = {
        'artificial intelligence': 10,
        'machine learning': 8,
        'deep learning': 8,
        'neural network': 8,
        'natural language processing': 8,
        'computer vision': 8,
        'transformer': 5,
        'large language model': 10,
        'llm': 8,
        'gpt': 5
    };

    // Technical AI Terms (15 points max)
    const technicalTerms = {
        'training data': 5,
        'inference': 5,
        'parameters': 3,
        'embedding': 4,
        'fine-tuning': 4,
        'dataset': 3,
        'preprocessing': 3,
        'tokenization': 4,
        'optimization': 3
    };

    // Check for AI terms
    for (const [term, points] of Object.entries(aiTerms)) {
        if (contentLower.includes(term)) {
            score += points;
            details.push(`Found AI term: ${term}`);
        }
    }

    // Check for technical terms
    for (const [term, points] of Object.entries(technicalTerms)) {
        if (contentLower.includes(term)) {
            score += points;
            details.push(`Found technical term: ${term}`);
        }
    }

    return {
        score: Math.min(score, 40), // Cap at 40 points
        details
    };
}

function checkTechnicalDocumentation(content) {
    const contentLower = content.toLowerCase();
    let score = 0;
    const details = [];
    let hasWhitepaper = false;

    // Documentation Indicators
    if (contentLower.includes('whitepaper') || contentLower.includes('white paper')) {
        score += 15;
        hasWhitepaper = true;
        details.push('Found whitepaper');
    }
    
    if (contentLower.includes('technical documentation')) {
        score += 10;
        details.push('Found technical documentation');
    }

    if (contentLower.includes('api documentation')) {
        score += 10;
        details.push('Found API documentation');
    }

    if (contentLower.includes('research paper')) {
        score += 10;
        details.push('Found research paper');
    }

    return {
        score: Math.min(score, 20),
        hasWhitepaper,
        details
    };
}

async function checkTeamAndCompany(url, content) {
    let score = 0;
    const details = [];
    let hasTeam = false;

    try {
        // Check about/team pages
        const pages = ['/about', '/team', '/about-us'];
        for (const page of pages) {
            try {
                const response = await fetch(`${url}${page}`);
                if (response.ok) {
                    const pageContent = await response.text();
                    if (pageContent.toLowerCase().includes('team')) {
                        score += 5;
                        hasTeam = true;
                        details.push('Found team page');
                    }
                    if (/linkedin\.com.*profile/i.test(pageContent)) {
                        score += 5;
                        details.push('Found LinkedIn profiles');
                    }
                }
            } catch (e) {
                continue;
            }
        }

        // Check for company registration/address
        if (/inc\.|llc|ltd|gmbh/i.test(content)) {
            score += 5;
            details.push('Found company registration');
        }

    } catch (error) {
        console.error('Team check error:', error);
    }

    return {
        score: Math.min(score, 15),
        hasTeam,
        details
    };
}

async function checkDevelopmentActivity(content) {
    let score = 0;
    const details = [];
    let hasActivity = false;

    try {
        // Check for GitHub links
        const githubMatch = content.match(/github\.com\/([^/"]+)/);
        if (githubMatch) {
            try {
                const githubResponse = await fetch(
                    `https://api.github.com/users/${githubMatch[1]}/repos`
                );
                if (githubResponse.ok) {
                    const repos = await githubResponse.json();
                    if (repos.length > 0) {
                        score += 10;
                        hasActivity = true;
                        details.push(`Found ${repos.length} GitHub repositories`);
                    }
                }
            } catch (error) {
                console.error('GitHub API error:', error);
            }
        }

        // Check for technical terms
        const devTerms = ['api', 'sdk', 'documentation', 'developer'];
        for (const term of devTerms) {
            if (content.toLowerCase().includes(term)) {
                score += 2;
                details.push(`Found development term: ${term}`);
            }
        }

    } catch (error) {
        console.error('Development check error:', error);
    }

    return {
        score: Math.min(score, 15),
        hasActivity,
        details
    };
}

async function checkMarketPresence(url, content) {
    let score = 0;
    const details = [];

    try {
        // Check for enterprise/business focus
        if (/enterprise|business solution|client|customer/i.test(content)) {
            score += 3;
            details.push('Found business focus');
        }

        // Check for case studies
        if (/case study|success story|client story/i.test(content)) {
            score += 4;
            details.push('Found case studies');
        }

        // Check for pricing/plans
        if (/pricing|subscription|plan|enterprise plan/i.test(content)) {
            score += 3;
            details.push('Found pricing information');
        }

    } catch (error) {
        console.error('Market presence check error:', error);
    }

    return {
        score: Math.min(score, 5),
        details
    };
}

async function checkSocialProof(url, content) {
    let score = 0;
    const details = [];

    try {
        // Check for social media presence
        const socialPlatforms = ['twitter.com', 'linkedin.com', 'medium.com', 'discord.gg'];
        for (const platform of socialPlatforms) {
            if (content.includes(platform)) {
                score += 1;
                details.push(`Found ${platform} presence`);
            }
        }

        // Check for testimonials
        if (/testimonial|review|client feedback/i.test(content)) {
            score += 2;
            details.push('Found testimonials');
        }

    } catch (error) {
        console.error('Social proof check error:', error);
    }

    return {
        score: Math.min(score, 5),
        details
    };
}

module.exports = handler;