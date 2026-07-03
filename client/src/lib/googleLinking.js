export const GOOGLE_LINK_REQUIRED_CODE = 'google_link_required';
export const GOOGLE_LINK_REQUIRED_MESSAGE = "That Google account matches your email account. Sign in with email once and we'll link Google for next time.";

export function isGoogleLinkRequiredError(error) {
    return error?.code === GOOGLE_LINK_REQUIRED_CODE;
}

export function getGoogleLinkRequiredMessage() {
    return GOOGLE_LINK_REQUIRED_MESSAGE;
}

export async function finishEmailLoginWithPendingGoogleLink({
    apiClient,
    emailLoginResult,
    pendingGoogleCredential,
}) {
    if (!pendingGoogleCredential) {
        return {
            user: emailLoginResult.user,
            linkedGoogle: false,
        };
    }

    const linkResult = await apiClient.linkGoogleAuth({ credential: pendingGoogleCredential });
    return {
        user: linkResult.user || emailLoginResult.user,
        linkedGoogle: true,
    };
}
