import {useEffect, useState} from "react";
import {APP_ORIGIN, TOOL_ID} from "@/hooks/shared";

type Story = {
    name: string,
    updated_at: string,
    content: unknown,
    published: boolean,
    slug: string
    // partial type definition
}

type ToolContext = {
    action: 'get-context',
    language: string,
    story: Story
}

export function useToolContext() {
    const [context, setContext] = useState<ToolContext | undefined>(undefined)
    const handleContext = ({data}: MessageEvent<ToolContext>) => {
        if (data.action === 'get-context') {
            setContext(data)
        }
    }

    useEffect(() => {
        window.parent.postMessage(
            {
                action: 'tool-changed',
                tool: TOOL_ID,
                event: 'getContext',
            },
            APP_ORIGIN
        )

        window.addEventListener('message', handleContext)

        return () => {
            window.removeEventListener('message', handleContext)
        }
    }, [])

    return context
}
