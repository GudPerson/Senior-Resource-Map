import { safeGuideChatTurns } from './guideChat.js';
import { isGuideResourceAccessQuestion } from './guideAccess.js';
import { answerGuideOracleFact } from './guideOracleKnowledge.js';

// Resolve only a reviewed product subject. Conversation text never establishes
// account permissions, publication state or the contents of a person's map.
export function answerGuideStudioFollowup(question = '', turns = []) {
    if (isGuideResourceAccessQuestion(question)) return null;
    const recent = safeGuideChatTurns(turns).at(-1);
    if (!recent || !/\b(?:map\s+studio|studio\s+(?:view|presentation))\b/i.test(recent.question)) return null;
    if (!/\b(?:this|that|it|saved\s+(?:view|presentation))\b/i.test(question)
        || !/\b(?:visitors?|recipients?|shared|published|embedded|map\s+link)\b/i.test(question)
        || !/\b(?:visible|see|show|live|refresh|update|another\s+step)\b/i.test(question)
        || /\b(?:notes?|annotations?|addresses?|personal|private|permissions?|allowed|authori[sz]ed|delete|remove|hide)\b/i.test(question)) return null;
    return answerGuideOracleFact('Does saving a Map Studio presentation refresh the published Shared Map?');
}
