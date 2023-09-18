import { authHandler, AuthHandlerParams, sessionCookieStore } from '@storyblok/app-extension-auth';

['CLIENT_ID', 'CLIENT_SECRET', 'BASE_URL'].forEach((key) => {
    if (!process.env[key]) {
        throw new Error(`Environment variable "${key}" is missing.`);
    }
});
export const cookieName = 'auth';

export const authParams: AuthHandlerParams = {
    clientId: process.env.CLIENT_ID!,
    clientSecret: process.env.CLIENT_SECRET!,
    baseUrl: process.env.BASE_URL!,
    cookieName,
    successCallback: '/',
    errorCallback: '/401',
    endpointPrefix: '/api/connect',
};

export const appSessionCookies = sessionCookieStore(authParams);
export const handleConnect = authHandler(authParams);