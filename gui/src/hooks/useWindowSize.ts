import { useState, useEffect } from 'react';

function useWindowSize(debounce = 50) {
    const [isResizing, setIsResizing] = useState(false);
    const [windowSize, setWindowSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
    });

    useEffect(() => {
        let timeoutId: NodeJS.Timeout | null = null;

        const handleResize = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            setIsResizing(true);

            timeoutId = setTimeout(() => {
                setWindowSize({
                    width: window.innerWidth,
                    height: window.innerHeight,
                })
                setIsResizing(false)
            }, debounce);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            window.removeEventListener('resize', handleResize);
        };
    }, [debounce]);

    return {
        windowSize,
        isResizing
    };
}

export default useWindowSize;
