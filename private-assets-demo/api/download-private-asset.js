import { AxiosError } from "axios";
import StoryblokClient from "storyblok-js-client";

export default async (request, response) => {
  try {
    const storyblokClient = new StoryblokClient({
      accessToken: process.env.VITE_STORYBLOK_ASSET_TOKEN,
    });

    const getSignedURL = async (filename) => {
      const response = await storyblokClient.get("cdn/assets/me", {
        filename: filename,
      });

      return response.data.asset.signed_url;
    };

    const signedURL = await getSignedURL(request.query.assetURL);

    return response.redirect(signedURL);
  } catch (e) {
    if (e instanceof AxiosError) {
      const axiosError = e;
      const statusCode = axiosError.code || 404;
      return response.status(statusCode).end();
    }
  }
};
