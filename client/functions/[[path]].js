import serverless from 'serverless-http';
import app from '../../server/src/index.js';

// Convert Express app to Cloudflare Worker format using serverless-http
const handler = serverless(app);

export async function onRequest(context) {
    // Basic compatibility shim for the serverless-http/Express app
    const { request, env } = context;

    // Inject environment variables into process.env for the Express app
    // Note: In Cloudflare, env vars are in context.env, not necessarily process.env
    Object.assign(process.env, env);

    // Pass the request to the serverless-http handler
    return handler(request, env);
}
