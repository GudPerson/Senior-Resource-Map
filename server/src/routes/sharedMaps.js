import { Hono } from 'hono';

import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { getSharedMapNoteImage } from '../controllers/mapNoteImagesController.js';
import {
    getEmbeddedMap,
    getEmbeddedMapConfigRoute,
    getSharedMap,
    getSharedMapNoteTranslations,
    postSharedMapCopy,
} from '../controllers/sharedMapsController.js';

import { getSharedRegionalDiscovery, getSharedRegionalDiscoveryConfig, postSharedRegionalDiscoveryEvaluate, createRegionalDiscoveryGuestHandlers } from '../controllers/regionalDiscoveryController.js';
import { createRateLimiter } from '../middleware/security.js';

export function createRegionalDiscoveryRouter(options) {
    const router = new Hono();
    const handlers = options ? createRegionalDiscoveryGuestHandlers(options) : {
        get:getSharedRegionalDiscovery,config:getSharedRegionalDiscoveryConfig,evaluate:postSharedRegionalDiscoveryEvaluate,
    };
    const limit = createRateLimiter({name:'regional-discovery-evaluate',limit:30,windowMs:60000,methods:['POST']});
    router.use('/:token/embed/regional-discovery',async(c,next)=>{c.header('Cache-Control','no-store');await next();});
    router.use('/:token/embed/regional-discovery-config',async(c,next)=>{c.header('Cache-Control','no-store');await next();});
    router.use('/:token/embed/regional-discovery/evaluate',async(c,next)=>{c.header('Cache-Control','no-store');await next();});
    router.get('/:token/embed/regional-discovery',handlers.get);
    router.get('/:token/embed/regional-discovery-config',handlers.config);
    router.post('/:token/embed/regional-discovery/evaluate',limit,handlers.evaluate);
    return router;
}
const router = new Hono();
router.route('/',createRegionalDiscoveryRouter());

router.get('/:token/note-translations', optionalAuth, getSharedMapNoteTranslations);
router.get('/:token/note-images/:assetId', optionalAuth, getSharedMapNoteImage);
router.get('/:token/embed-config', getEmbeddedMapConfigRoute);
router.get('/:token/embed', getEmbeddedMap);
router.get('/:token', optionalAuth, getSharedMap);
router.post('/:token/copy', authenticateToken, postSharedMapCopy);

export default router;
