import { useEffect, useState } from 'react';

function getMatches(query) {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
}

export function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => getMatches(query));

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const mediaQueryList = window.matchMedia(query);
        const handleChange = (event) => setMatches(event.matches);

        setMatches(mediaQueryList.matches);

        if (mediaQueryList.addEventListener) {
            mediaQueryList.addEventListener('change', handleChange);
            return () => mediaQueryList.removeEventListener('change', handleChange);
        }

        mediaQueryList.addListener(handleChange);
        return () => mediaQueryList.removeListener(handleChange);
    }, [query]);

    return matches;
}
