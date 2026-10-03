// Disposable local CMS harness. Never imported by app or deployed.
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import { serve } from '@hono/node-server';
import { createHelpCmsRoutes, createHelpMediaRoutes } from '../../src/routes/helpCms.js';
import { createHelpArticleRoutes } from '../../src/routes/helpArticles.js';
import { createHelpCmsRepository } from '../../src/utils/helpCmsRepository.js';
import { cmsSeedWorkspace } from '../../../shared/helpContentCms.js';
import { HELP_CMS_SEED } from '../../src/generated/helpCmsSeed.js';
if (process.env.CAREAROUND_CMS_FIXTURE !== 'true') throw new Error('Explicit local CMS fixture mode required.');
const port=8794,clientOrigin='http://127.0.0.1:5188';
class LocalBucket {
 objects=new Map(); count=0;
 async get(key){const o=this.objects.get(key);if(!o)return null;return{...o,body:new Response(o.bytes.slice()).body,json:async()=>JSON.parse(new TextDecoder().decode(o.bytes))};}
 async put(key,value,options={}){const old=this.objects.get(key),c=options.onlyIf;if(c instanceof Headers&&c.get('If-None-Match')==='*'&&old||c?.etagMatches&&old?.etag!==c.etagMatches)return null;let bytes=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value).slice();let o={bytes,etag:'local-'+(++this.count),httpMetadata:options.httpMetadata||{},customMetadata:options.customMetadata||{}};this.objects.set(key,o);return{etag:o.etag};}
 async list({prefix,limit=1000,cursor}={}){let keys=[...this.objects.keys()].filter(k=>k.startsWith(prefix)).sort(),start=Number(cursor||0);return{objects:keys.slice(start,start+limit).map(key=>({key})),truncated:keys.length>start+limit,cursor:String(start+limit)};}
}
const bucket=new LocalBucket();
const env={HELP_CMS_ENABLED:'true',HELP_CMS_OWNER_ID:'7',HELP_CMS_BUCKET:bucket,HELP_CMS_PUBLIC_APP_ORIGIN:clientOrigin,NODE_ENV:'development',FRONTEND_URL:clientOrigin};
const owner={id:7,name:'Demo Help Owner',email:'owner@example.test',role:'super_admin',hardAssetStaffAccess:[],softAssetStaffAccess:[],platformDirectoryAccess:true};
const userFor=c=>getCookie(c,'cms_local_fixture')==='owner'?owner:null;
const authenticate=async(c,next)=>{c.set('user',userFor(c));await next();};
const api=new Hono();api.use('*',cors({origin:clientOrigin,credentials:true}));api.use('*',async(c,next)=>{c.env=env;await next();});
api.get('/__fixture/session/owner',c=>{setCookie(c,'cms_local_fixture','owner',{httpOnly:true,sameSite:'Lax',path:'/'});return c.redirect(clientOrigin+'/dashboard/help-content');});
api.get('/__fixture/session/guest',c=>{setCookie(c,'cms_local_fixture','guest',{httpOnly:true,sameSite:'Lax',path:'/'});return c.redirect(clientOrigin+'/help-centre');});
api.get('/api/auth/me',c=>c.json({user:userFor(c)}));
api.get('/api/platform-access/status',c=>c.json({canAccess:true,directoryAccess:true,enabled:true}));
api.get('/api/notifications/count',c=>c.json({count:0}));
api.route('/api/help/cms',createHelpCmsRoutes({authenticate}));api.route('/api/help/media',createHelpMediaRoutes());api.route('/api/help/articles',createHelpArticleRoutes({authenticate}));
api.get('/api/*',c=>c.json({data:[],items:[],notifications:[],count:0}));
serve({fetch:api.fetch,port,hostname:'127.0.0.1'});console.log('Disposable CMS fixture ready on loopback 8794. Publishing and model calls are disabled.');
