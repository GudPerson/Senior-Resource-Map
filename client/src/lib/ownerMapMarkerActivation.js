// Only owner maps opt in. Secondary presses belong to the existing rotation /
// context-menu stream, not the primary resource-selection action. Public maps,
// keyboard events and programmatic activation retain their existing behavior.
export function isOwnerMapSecondaryActivation(event, ownerToolMenu = false) {
    return ownerToolMenu === true && event?.originalEvent?.button === 2;
}
