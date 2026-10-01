import { DurableObject } from 'cloudflare:workers';
import { readGuidePilotBudget, reserveGuidePilotCall } from './guidePilotBudget.js';

// SQLite-backed storage contains only the integer counter, never chat/account data.
export class GuidePilotBudget extends DurableObject {
    async status() { return readGuidePilotBudget(this.ctx.storage); }
    async reserve() { return reserveGuidePilotCall(this.ctx.storage); }
}
