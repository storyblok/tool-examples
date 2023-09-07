import {AppSession} from "@storyblok/app-extension-auth";

export const isAdmin = (session: AppSession) => session.roles.some((role) => role === 'admin');