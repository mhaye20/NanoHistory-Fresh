export default async function handler(req, res) {
  // Set limited CORS headers - only allow from our app domain
  res.setHeader('Access-Control-Allow-Origin', process.env.VERCEL_URL || 'https://micro-history.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Return minimal health information
    // No sensitive data or environment details
    return res.status(200).json({ 
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({ 
      status: 'error',
      timestamp: new Date().toISOString()
    });
  }
}
