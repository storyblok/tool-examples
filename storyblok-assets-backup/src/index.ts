import LocalStorage from "./storage/local.js";
import S3Storage from "./storage/s3.js";
import StoryblokClient, { ISbStoryData, ISbResult } from "storyblok-js-client";
import fs from "fs";
import FormData from "form-data";
import chalk from "chalk";

interface SbBackupOptions {
  token: string;
  storage?: "local" | "s3";
  basePath?: string;
  s3Settings?: S3Settings;
  metadata?: boolean;
}

interface S3Settings {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  bucket?: string;
}

interface Asset {
  id: number;
  filename: string;
  short_filename?: string;
  updated_at: number;
  [key: string]: any;
}

interface AssetWrapper {
  old: AssetWithFile;
  new?: Asset;
}

interface AssetWithFile {
  file: string;
  meta: Asset;
}

interface StoryData {
  [key: string]: any;
}

export default class SbBackup {
  private sbClient: StoryblokClient;
  private storage?: LocalStorage | S3Storage;
  private assets: AssetWrapper[] = [];
  private assetsRetries: Record<string, number> = {};
  private retriesLimit: number = 3;
  private updatedStories: ISbStoryData[];
  private storiesList: ISbStoryData[];
  private spaceToken?: string;
  private cdnApiClient?: StoryblokClient;
  protected spaceId?: number;

  /**
   * Initialize SbBackup instance
   * @param options.token Storyblok OAuth token
   * @param options.storage "local" or "s3" storage type
   * @param options.basePath Local backup path
   * @param options.s3Settings S3 configuration (required if storage is "s3")
   * @param options.metadata Whether to check asset metadata
   */
  constructor({
    token,
    storage = "local",
    basePath,
    s3Settings,
    metadata = true,
  }: SbBackupOptions) {
    this.sbClient = new StoryblokClient(
      { oauthToken: token },
      "https://mapi.storyblok.com/v1/"
    );

    const storageOptions = { basePath, metadata, sbClient: this.sbClient };
    this.updatedStories = [];
    this.storiesList = [];

    switch (storage) {
      case "s3":
        if (!s3Settings) {
          console.error(`✖ S3 settings missing`);
        } else {
          this.storage = new S3Storage({ s3Settings, ...storageOptions });
        }
        break;
      case "local":
        this.storage = new LocalStorage(storageOptions);
        break;
      default:
        console.error(`✖ Unsupported storage type.`);
    }
  }

  /**
   * Get the target space token and setup the Storyblok js client
   */
  async getTargetSpaceToken() {
    try {
      const spaceRequest = await this.sbClient.get(`spaces/${this.spaceId}`);
      this.spaceToken = spaceRequest.data.space.first_token;
      this.cdnApiClient = new StoryblokClient({
        accessToken: this.spaceToken,
        rateLimit: 3,
      });
    } catch (err) {
      console.log(err);
      console.error(
        "Error trying to retrieve the space token. Please double check the target space id and the OAUTH token."
      );
    }
  }

  /**
   * Print a message of the current step
   */
  private stepMessage(text: string, append_text?: string) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(
      `${text} ${append_text ? chalk.black.bgYellow(` ${append_text} `) : ""}`
    );
  }

  /**
   * Set the current space ID
   * @param spaceId Storyblok space ID
   */
  setSpace(spaceId: number) {
    this.spaceId = spaceId;
  }

  /**
   * Print a message of the completed step
   */
  private stepMessageEnd(text: string) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`${text}\n`);
  }

  /**
   *
   * Return the clean filename of an asset without the S3 bucket reference
   */
  getAssetFilename(filename: string) {
    if (typeof filename === "string") {
      return `/${filename.slice(
        filename.search("/a(-[a-z]+)?.storyblok.com/")
      )}`;
    }
    return filename;
  }

  /**
   * Backup all spaces available in the account
   */
  async backupAllSpaces() {
    try {
      const spaces = await this.sbClient.get("spaces");
      if (spaces.data?.spaces.length) {
        for (const space of spaces.data.spaces) {
          await this.backupSpace(space.id);
        }
      } else {
        console.log("No spaces to backup.");
      }
    } catch (err: any) {
      console.error(
        `✖ An error occurred while fetching the spaces: ${err.message}`
      );
    }
  }

  /**
   * Backup a single space by its ID
   * @param spaceId Storyblok space ID
   */
  async backupSpace(spaceId: number) {
    try {
      if (!this.storage) {
        throw new Error(`✖ The storage is not set`);
      }
      this.storage.setSpace(spaceId);
      const assetsToBackup = await this.storage.assetsToBackup();
      if (assetsToBackup.length) {
        await this.storage.backupAssets();
        console.log(`✓ Assets of space ${spaceId} backed up correctly`);
      } else {
        console.log(`✓ No new assets to backup in space ${spaceId}`);
      }

      if (typeof this.storage.afterBackupCallback === "function") {
        this.storage.afterBackupCallback();
      }
    } catch (err) {
      console.error(`✖ Backup task interrupted because of an error`);
    }
  }

  /**
   * Restore assets for a space
   * @param spaceId Storyblok space ID
   * @param assetIds Optional array of asset IDs to restore; if omitted, restores all assets
   */
  async restoreAssets(spaceId: number, assetIds?: number[]) {
    this.setSpace(spaceId);
    try {
      if (!this.storage) {
        throw new Error(`✖ The storage is not set`);
      }
      this.storage.setSpace(spaceId);
      const backedUpAssets = await this.storage.getLatestBackedUpAssets(
        assetIds
      );
      // Start creating the map between old assets and new for updating stories
      this.assets = backedUpAssets.map((asset) => ({ old: asset }));
      await Promise.allSettled(
        this.assets.map(async (asset) => {
          await this.uploadAsset(spaceId, asset.old);
        })
      );
      await this.getStories();
      this.replaceAssetsInStories();
      await this.saveStories();
    } catch (err) {
      console.error(`✖ Restoring task interrupted because of an error`);
    }
  }

  /**
   * Upload a single asset to a space
   * @param spaceId Storyblok space ID
   * @param asset Asset with local file path and metadata
   * @returns Object indicating success
   */
  async uploadAsset(
    spaceId: number,
    asset: AssetWithFile
  ): Promise<{ success: boolean }> {
    const assetUrl = asset.meta.filename;

    if (!this.assetsRetries[assetUrl]) this.assetsRetries[assetUrl] = 0;

    try {
      const newAssetPayload: any = {
        ...asset.meta,
        filename: asset.meta.short_filename,
        id: null,
      };

      const newAssetRequest = await this.sbClient.post(
        `spaces/${spaceId}/assets`,
        newAssetPayload
      );

      // @ts-ignore: Unreachable code error
      if (!newAssetRequest.data) return { success: false };
      // @ts-ignore: Unreachable code error
      const signedRequest = newAssetRequest.data;

      const form = new FormData();
      Object.entries(signedRequest.fields).forEach(([key, value]) =>
        form.append(key, value as any)
      );
      form.append("file", fs.createReadStream(asset.file));

      const uploadPromise = new Promise<{ success: boolean }>((resolve) => {
        form.submit(signedRequest.post_url, async (err) => {
          if (err) {
            resolve({ success: false });
            return;
          }

          try {
            const response = await this.sbClient.get(
              `spaces/${spaceId}/assets/${signedRequest.id}/finish_upload`
            );
            // Complete the mapping with the data of the. new asset
            const assetObject = this.assets.find(
              (a) => a.old.meta.id === asset.meta.id
            );
            if (assetObject && response.data) {
              assetObject.new = response.data;
              // Get rid of the s3.amazonaws.com URL part
              if(assetObject?.new?.filename) assetObject.new.filename = assetObject.new.filename.replace("s3.amazonaws.com/", "")
            }

            this.assetsRetries[assetUrl] = 0;
            resolve({ success: true });
          } catch {
            resolve({ success: false });
          }
        });
      });

      return await uploadPromise;
    } catch (err: any) {
      if (
        (err.code === "ECONNABORTED" || err.message.includes("429")) &&
        this.assetsRetries[assetUrl] < this.retriesLimit
      ) {
        this.assetsRetries[assetUrl]++;
        console.log(
          `Retrying upload for asset ${asset.meta.filename} (${this.assetsRetries[assetUrl]})`
        );
        return this.uploadAsset(spaceId, asset);
      }

      console.error(
        `Failed to upload asset ${asset.meta.filename}:`,
        err.message
      );
      return { success: false };
    }
  }

  /**
   * Replace the asset's id and filename in the tree of a story
   */
  replaceAssetInData(data: StoryData | StoryData[], asset: AssetWrapper): any {
    if (Array.isArray(data)) {
      // Just an array to loop through
      return data.map((item) => this.replaceAssetInData(item, asset));
    } else if (
      data &&
      typeof data === "object" &&
      this.getAssetFilename(data.filename as string) ===
        this.getAssetFilename(asset.old.meta.filename) &&
      data.id === asset.old.meta.id
    ) {
      // Asset found and replaced
      return asset.new
        ? { ...data, id: asset.new.id, filename: asset.new.filename }
        : data;
    } else if (data && typeof data === "object") {
      // An object to explore
      return Object.keys(data).reduce((newObject, key) => {
        const propertyValue = this.replaceAssetInData(data[key], asset);
        newObject[key] = propertyValue;
        return newObject;
      }, {} as { [key: string]: any });
    } else if (
      data &&
      typeof data === "string" &&
      this.getAssetFilename(data) === asset.old.meta.filename
    ) {
      // Just a string
      return asset.new?.filename;
    }
    return data;
  }

  /**
   * Replace the new urls in the target space stories
   */
  replaceAssetsInStories() {
    this.stepMessage(`0 of ${this.assets.length} URLs replaced`);
    this.updatedStories = this.storiesList.slice(0);
    this.assets.forEach((asset, index) => {
      this.updatedStories = this.replaceAssetInData(
        this.updatedStories,
        asset
      ) as ISbStoryData[];
      console.log(`${index} of ${this.assets.length} URLs replaced`);
    });
    this.stepMessageEnd(`Replaced all URLs in the stories.`);
  }

  /**
   * Save the updated stories in Storyblok
   */
  async saveStories() {
    let total = 0;
    const storiesWithUpdates = this.updatedStories.filter((story) => {
      const originalStory = this.storiesList.find((s) => s.id === story.id);
      return originalStory
        ? JSON.stringify(originalStory.content) !==
            JSON.stringify(story.content)
        : true;
    });

    const migrationResult = await Promise.allSettled(
      storiesWithUpdates.map(async (story) => {
        delete story.content._editable;
        const post_data: any = { story };
        if (story.published && !story.unpublished_changes) {
          post_data.publish = 1;
        }
        try {
          await this.sbClient.put(
            `spaces/${this.spaceId}/stories/${story.id}`,
            post_data
          );
          this.stepMessage(
            ``,
            `${++total} of ${storiesWithUpdates.length} stories updated.`
          );
          return true;
        } catch (err) {
          return false;
        }
      })
    );
    process.stdout.clearLine(0);
    this.stepMessageEnd(
      `Updated ${
        migrationResult.filter((r) => r.status === "fulfilled" && r.value)
          .length
      } ${
        migrationResult.filter((r) => r.status === "fulfilled" && r.value)
          .length === 1
          ? "story"
          : "stories"
      } in the space.`
    );
  }

  /**
   * Get the Stories from the target space
   */
  async getStories() {
    this.stepMessage(`Fetching stories from target space.`);
    await this.getTargetSpaceToken();

    try {
      if (!this.cdnApiClient) {
        throw new Error(`Couldn't initialize the CDN client`);
      }
      const links = await this.cdnApiClient.getAll("cdn/links", {
        version: "draft",
        per_page: 25,
      });
      const storiesResponsesManagement = await Promise.all(
        links.map((link) =>
          this.sbClient.get(`spaces/${this.spaceId}/stories/${link.id}`)
        )
      );
      this.storiesList = storiesResponsesManagement.map((r) => r.data.story);
      this.stepMessageEnd(`Stories fetched from target space.`);
    } catch (err) {
      console.log(err);
      console.error(
        "Error fetching the stories. Please double check the target space id."
      );
    }
  }
}
