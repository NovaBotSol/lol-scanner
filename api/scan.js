const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { target } = req.body;

        if (!target) {
            return res.status(400).json({ error: 'Target URL is required' });
        }

        // Validate URL
        try {
            new URL(target);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        // Run all checks concurrently
        const results = await Promise.allSettled([
            analyzeContent(target),
            checkTeamTransparency(target),
            checkGitHubActivity(target),
            checkSocialPresence(target)
        ]);

        // Extract results, using default values if any check fails
        const [contentAnalysis, teamTransparency, githubActivity, socialProof] = results.map(
            result => result.status === 'fulfilled' ? result.value : null
        );

        const responseData = {
            domainAge: 400, // Mock value for now
            aiMentions: contentAnalysis?.aiKeywords ?? false,
            whitepaper: contentAnalysis?.hasWhitepaper ?? false,
            teamTransparency: teamTransparency ?? false,
            githubActivity: githubActivity ?? false,
            socialProof: socialProof ?? false
        };

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ 
            error: 'Failed to analyze project',
            details: error.message 
        });
    }
}

async function analyzeContent(url) {
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'AI-Legitimacy-Scanner/1.0' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const html = await response.text();
        
        return {
            aiKeywords: /artificial intelligence|machine learning|neural network|deep learning|ai model/i.test(html),
            hasWhitepaper: /whitepaper|technical paper|research paper|technical documentation/i.test(html)
        };
    } catch (error) {
        console.error('Content analysis error:', error);
        return null;
    }
}

async function checkTeamTransparency(url) {
    try {
        const paths = ['/about', '/team', '/about-us'];
        
        for (const path of paths) {
            const fullUrl = new URL(path, url).toString();
            const response = await fetch(fullUrl, {
                headers: { 'User-Agent': 'AI-Legitimacy-Scanner/1.0' }
            });
            
            if (response.ok) {
                const html = await response.text();
                if (/meet the team|our team|about us|team members/i.test(html)) {
                    return true;
                }
            }
        }
        
        return false;
    } catch (error) {
        console.error('Team transparency check error:', error);
        return null;
    }
}

async function checkGitHubActivity(url) {
    try {
        const repoMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!repoMatch) return false;
        
        const [, owner, repo] = repoMatch;
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits`;
        
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'AI-Legitimacy-Scanner/1.0',
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`GitHub API error! status: ${response.status}`);
        }
        
        const commits = await response.json();
        return Array.isArray(commits) && commits.length > 10;
    } catch (error) {
        console.error('GitHub activity check error:', error);
        return null;
    }
}

async function checkSocialPresence(url) {
    try {
        const domain = new URL(url).hostname.replace('www.', '');
        const socialPlatforms = [
            `https://twitter.com/${domain}`,
            `https://linkedin.com/company/${domain}`
        ];
        
        const checks = await Promise.all(
            socialPlatforms.map(async platform => {
                try {
                    const response = await fetch(platform, {
                        headers: { 'User-Agent': 'AI-Legitimacy-Scanner/1.0' }
                    });
                    return response.status === 200;
                } catch {
                    return false;
                }
            })
        );
        
        return checks.some(exists => exists);
    } catch (error) {
        console.error('Social presence check error:', error);
        return null;
    }
}