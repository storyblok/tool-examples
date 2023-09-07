import {APP_ORIGIN, TOOL_ID} from "@/hooks/useAutoHeight";
import {useCallback, useEffect, useState} from "react";


//DRAFT
export function useContext() {
  const [context, setContext] = useState(undefined)

    const getContext = useCallback(() => window.parent.postMessage(
        {
            action: 'tool-changed',
            tool: TOOL_ID,
            event: 'getContext',
        },
        APP_ORIGIN
    ),[]);

    useEffect(() => {
        window.addEventListener('message', ({data}) => {
            if(data.action === 'get-context'){
                setContext(data.story)
            }
        })


    },[])


    return {context, getContext}
}
