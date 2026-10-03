import { helpReleaseAssetProof } from '../../pages/helpReleaseAssetProof.js';

export function onRequest(context) {
    return helpReleaseAssetProof(context, 'home');
}
