import {useEffect} from "react";
export const TOOL_ID = process.env.NEXT_PUBLIC_DEVELOPMENT_TOOL_ID;
export const APP_ORIGIN = 'https://app.storyblok.com';

export function useAutoHeight() {
    useEffect(() => {
        const observer = new MutationObserver(
            () => {
                window.parent.postMessage(
                    {
                        action: 'tool-changed',
                        tool: TOOL_ID,
                        event: 'heightChange',
                        height: document.body.scrollHeight,
                    },
                    APP_ORIGIN
                )
            }

        );

        observer.observe(document.body, {
            attributes: true,
            childList: true,
            subtree: true,
        });

        return () => {
            observer.disconnect();
        };
    }, []);
}