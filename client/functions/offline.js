import { helpReleaseProofResponse } from '../pages/helpReleaseProof.js';

export function onRequest(context) {
    return helpReleaseProofResponse(context, '/offline');
}
