import { parsePostalCodeListInput } from './server/src/utils/postalBoundaries.js';

const testInput = "180000-180005, 680153";
try {
    const result = parsePostalCodeListInput(testInput);
    console.log("Test Input:", testInput);
    console.log("Expanded Result Length:", result.length);
    console.log("Expanded Result:", result);
    
    if (result.includes("180000") && result.includes("180005") && result.includes("680153") && result.length === 7) {
        console.log("SUCCESS: Range expansion and individual codes working correctly.");
    } else {
        console.log("FAILURE: Unexpected expansion result.");
    }
} catch (err) {
    console.error("ERROR during expansion:", err.message);
}
