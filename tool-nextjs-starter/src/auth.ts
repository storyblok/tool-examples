import { authHandler, AuthHandlerParams, sessionCookieStore } from '@storyblok/app-extension-auth';

['APP_CLIENT_ID', 'APP_CLIENT_SECRET', 'APP_URL'].forEach((key) => {
    if (!process.env[key]) {
        throw new Error(`Environment variable "${key}" is missing.`);
    }
});
export const cookieName = 'auth';

export const authParams: AuthHandlerParams = {
    clientId: process.env.APP_CLIENT_ID!,
    clientSecret: process.env.APP_CLIENT_SECRET!,
    baseUrl: process.env.APP_URL!,
    cookieName,
    successCallback: '/',
    errorCallback: '/401',
    endpointPrefix: '/api/connect',
};

export const appSessionCookies = sessionCookieStore(authParams);
export const handleConnect = authHandler(authParams);