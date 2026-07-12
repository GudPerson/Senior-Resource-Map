import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

const MOBILE_MY_MAP_PATH_PATTERN = /^\/my-directory\/maps\/\d+\/?$/;

export default function MobileMyMapEntryScrollReset() {
    const location = useLocation();

    useLayoutEffect(() => {
        const isMobileMyMap = MOBILE_MY_MAP_PATH_PATTERN.test(location.pathname)
            && new URLSearchParams(location.search).get('view') !== 'print'
            && typeof window !== 'undefined'
            && !window.matchMedia('(min-width: 1024px)').matches;
        if (!isMobileMyMap) return undefined;

        let secondFrame = null;
        const resetEntryScroll = () => {
            if (window.scrollX === 0 && window.scrollY === 0) return;
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        };

        window.addEventListener('scroll', resetEntryScroll, { passive: true });
        resetEntryScroll();
        const firstFrame = window.requestAnimationFrame(() => {
            resetEntryScroll();
            secondFrame = window.requestAnimationFrame(resetEntryScroll);
        });
        const restorationSettleTimer = window.setTimeout(resetEntryScroll, 50);
        const releaseEntryScrollGuardTimer = window.setTimeout(() => {
            resetEntryScroll();
            window.removeEventListener('scroll', resetEntryScroll);
        }, 120);

        return () => {
            window.cancelAnimationFrame(firstFrame);
            window.clearTimeout(restorationSettleTimer);
            window.clearTimeout(releaseEntryScrollGuardTimer);
            window.removeEventListener('scroll', resetEntryScroll);
            if (secondFrame !== null) {
                window.cancelAnimationFrame(secondFrame);
            }
        };
    }, [location.key, location.pathname, location.search]);

    return null;
}
