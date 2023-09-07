import {APP_ORIGIN, TOOL_ID} from "@/hooks/useAutoHeight";
import {useCallback, useEffect, useState} from "react";


//DRAFT
export function useContext() {
  const [context, setContext] = useState(undefined)

   //usecallback?
    const handleContext = ({data}:any) => {
        if(data.action === 'get-context'){
            setContext(data.story)
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
           window.removeEventListener('message', handleContext )
        }
    },[])


    return {context}
}
