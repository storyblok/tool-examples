import {handleConnect} from "@/auth";

export const config = {
    api: {
        externalResolver: true,
    },
};

export default handleConnect;