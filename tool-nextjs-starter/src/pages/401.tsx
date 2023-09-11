import {useEffect} from "react";

export default function Error401() {
    useEffect(() => {
        /** When initially approving the Tool having access to storyblok, the user is navigated outside Storyblok.
         This piece of code redirects the user back to the Storyblok Application. **/
        if (typeof window !== 'undefined' && window.top === window.self) {
            window.location.assign('https://app.storyblok.com/oauth/tool_redirect');
        }
    }, []);

    return <span>Error: Unauthorized</span>
}