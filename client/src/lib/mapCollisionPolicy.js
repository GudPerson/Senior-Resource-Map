export function getCollisionPushDistances({
    overlap,
    leftMass,
    rightMass,
    leftFixed = false,
    rightFixed = false,
} = {}) {
    const resolvedOverlap = Math.max(0, Number(overlap) || 0);
    if (!resolvedOverlap || (leftFixed && rightFixed)) {
        return { leftPush: 0, rightPush: 0 };
    }

    if (leftFixed) {
        return { leftPush: 0, rightPush: resolvedOverlap };
    }
    if (rightFixed) {
        return { leftPush: resolvedOverlap, rightPush: 0 };
    }

    const leftInverseMass = 1 / Math.max(1, Number(leftMass) || 1);
    const rightInverseMass = 1 / Math.max(1, Number(rightMass) || 1);
    const inverseMassTotal = leftInverseMass + rightInverseMass;

    return {
        leftPush: resolvedOverlap * (leftInverseMass / inverseMassTotal),
        rightPush: resolvedOverlap * (rightInverseMass / inverseMassTotal),
    };
}
