# Storyblok Tool Starter x Next.js
This is a starter template for Storyblok tools, created with Next.js (Pages Router) and [@storyblok/app-extension-auth](https://github.com/storyblok/app-extension-auth).


## How to run
Install dependencies by running:

```shell
yarn install
```

Set up a secure tunnel to proxy your request to/from `localhost:3000`, for example with [ngrok](https://ngrok.com/):

```shell
ngrok http 3000
```
Note down your assigned URL; this will be your `baseUrl` for the application.

### Create new Storyblok Extension
There are two ways on how you can create a tool inside
Storyblok. Depending on your plan and use case, choose
one of the following options: 

#### Partner Portal
1. Open [Storyblok's Partner Portal Extension View](https://app.storyblok.com/#/partner/apps)
2. Click On **New Extension**
3. Fill in the fields `name` and `slug`.
4. Select `tool` as extension type
5. Click on **Save**

#### Organization
1. Open [Storyblok's Organization Extension View](https://app.storyblok.com/#/me/org/apps)
2. Click On **New Extension**
3. Fill in the fields `name` and `slug`.
4. Select `tool` as extension type
5. Click on **Save**

### Tool Configuration 
Once the tool has been created, a new entry will appear inside the extension list. Open it and navigate to the `OAuth 2.0 and Pages` tab.

Configure the following properties base on the previous steps:

* **Index to your page**: `{baseUrl}`
* **Redirection endpoint**: `{baseUrl}/api/connect/callback`


### Configure Starter Environment Variables
Rename the file `.env.local.example` to `.env.local`. Open the file and set the environmental variables:

* `CLIENT_ID`: the client id from the tool's settings page.
* `CLIENT_SECRET`: the client secret from the tool's settings page.
* `BASE_URL`: The `baseUrl` from your secure tunnel.
* `NEXT_PUBLIC_TOOL_ID` the slug from the tool's settings page.

Start the application by running:

```shell
yarn dev
```

### Tool Installation
Finally, install the application to your space: 

1. Navigate to the tool's settings page.
2. Open the **General Tab**.
3. Open the **Install Link** in a new browser tab.
4. Select a space, the Tool Plugin should be installed to.
5. Open the selected space from Step 4.
6. Navigate to a story of your choice.
7. Open the tool tab by clicking ![tools icon](public/tools.svg)
8. Approve the necessary access for the tool.

The installation process is only done once per space. After the installation is finished, you will be able to navigate to the tool section inside any story and access the Tool Plugin.

## Production
When deploying your Tool Plugin, please remember to adjust the tool settings inside the Storyblok App to point to the correct  **Index to your page** and **Redirection endpoint**. 

## Read More
For more detailed information on Storyblok extensions,read the following guides:

- [Tool Plugins](https://www.storyblok.com/docs/plugins/tool)
- [OAuth 2.0 Authorization Flow](https://www.storyblok.com/docs/plugins/authentication-apps)

