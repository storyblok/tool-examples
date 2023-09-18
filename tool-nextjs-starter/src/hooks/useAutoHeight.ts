import {useEffect} from "react";
import {APP_ORIGIN, TOOL_ID} from "@/hooks/shared";


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