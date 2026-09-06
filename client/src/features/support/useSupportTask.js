import { useEffect, useRef, useState } from 'react';

export function useSupportTask() {
    const live = useRef(true);
    const inFlight = useRef(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
    async function run(work, success) {
        if (inFlight.current) return;
        inFlight.current = true;
        setPending(true);
        setError('');
        try {
            const result = await work();
            if (live.current) success?.(result);
        } catch (err) {
            if (live.current && err.name !== 'AbortError') setError(err.message || 'Please try again.');
        } finally {
            inFlight.current = false;
            if (live.current) setPending(false);
        }
    }
    return { pending, error, run };
}
