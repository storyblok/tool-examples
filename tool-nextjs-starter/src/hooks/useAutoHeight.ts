import {useEffect} from "react";
export const TOOL_ID = process.env.NEXT_PUBLIC_DEVELOPMENT_TOOL_ID;
export const APP_ORIGIN = 'https://app.storyblok.com';

export function useAutoHeight() {

    useEffect(() => {
                window.parent.postMessage(
                    {
                        action: 'tool-changed',
                        tool: TOOL_ID,
                        event: 'heightChange',
                        height: document.body.scrollHeight,
                    },
                    APP_ORIGIN
                );
    }, []);
}