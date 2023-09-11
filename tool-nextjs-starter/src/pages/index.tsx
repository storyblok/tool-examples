import Head from 'next/head'
import {GetServerSideProps} from "next";
import {isAppSessionQuery} from "@storyblok/app-extension-auth";
import {appSessionCookies} from "@/auth";
import {useAutoHeight, useToolContext} from "@/hooks";
import {isAdmin} from "@/utils";
import {useEffect, useState} from "react";

type HomeProps = {
    accessToken: string,
    spaceId: string,
    userId: string,
    isAdmin: boolean
}

export default function Home(props: HomeProps) {
    const [userInfo, setUserInfo] = useState<any | undefined>(undefined)
    const toolContext = useToolContext();

    useAutoHeight();

    useEffect(() => {
        fetch(`https://api.storyblok.com/oauth/user_info`, {
            headers: {
                'Authorization': `Bearer ${props.accessToken}`
            }
        })
            .then((res) => res.json())
            .then((userInfo) => setUserInfo(userInfo))
            .catch((error) => {
                console.error('Failed to fetch stories', error)
                setUserInfo(undefined)
            })
    }, [])

    return (
        <>
            <Head>
                <title>Storyblok Next Tool Starter</title>
                <meta name="description" content="Generated by create next app"/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
            </Head>
            <main>
                {userInfo && (
                    <span>Hello {userInfo.user.friendly_name}</span>
                )}
                {
                    toolContext && (
                        <>
                            <h2>Story Information</h2>
                            <div>
                                <span>Story: {toolContext.story.name}</span>
                                <span>Slug: {toolContext.story.slug}</span>
                            </div>

                        </>
                    )}
            </main>
        </>
    )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const {query} = context;

    if (!isAppSessionQuery(query)) {
        return {
            redirect: {
                permanent: false,
                destination: process.env.APP_URL + '/api/connect/storyblok',
            },
        };
    }

    const sessionStore = appSessionCookies(context);
    const appSession = await sessionStore.get(query);

    if (!appSession) {
        return {
            redirect: {
                permanent: false,
                destination: process.env.APP_URL + '/api/connect/storyblok',
            },
        };
    }

    const {accessToken, spaceId, userId} = appSession;
    return {props: {accessToken, spaceId, userId, isAdmin: isAdmin(appSession)}};
};
