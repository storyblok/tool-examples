import chalk from "chalk";
import StoryblokClient from "storyblok-js-client";
import FormData from "form-data";
import https from "https";
import fs from "fs";
import async from "async";

// Throttling
export default class Migration {
  constructor(
    oauth,
    sourceSpaceId,
    targetSpaceId,
    simultaneousUploads,
    region
  ) {
    this.sourceSpaceId = sourceSpaceId;
    this.targetSpaceId = targetSpaceId;
    this.oauth = oauth;
    this.simultaneousUploads = simultaneousUploads;
    this.region = region;
    this.assetsFolders = [];
    this.assetsRetries = {};
    this.assetsFoldersMap = {};
    this.retriesLimit = 4;
    this.mapiClient = new StoryblokClient({
      oauthToken: this.oauth,
      region: this.region,
    });
  }

  /**
   * Migration error callback
   */
  migrationError(err) {
    throw new Error(err);
  }

  /**
   * Print a message of the current step
   */
  stepMessage(index, text, append_text) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(
      `${chalk.white.bgBlue(` ${index}/7 `)} ${text} ${
        append_text ? chalk.black.bgYellow(` ${append_text} `) : ""
      }`
    );
  }

  /**
   * Print a message of the completed step
   */
  stepMessageEnd(index, text) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`${chalk.black.bgGreen(` ${index}/7 `)} ${text}\n`);
  }

  /**
   * Start the migration
   */
  async start() {
    try {
      fs.rmSync("./temp", { recursive: true, force: true });
      fs.mkdirSync("./temp");
      await this.getTargetSpaceToken();
      await this.getStories();
      await this.getAssetsFolders();
      await this.getAssets();
      await this.createAssetsFolders();
      await this.uploadAssets();
      this.replaceAssetsInStories();
      await this.saveStories();
    } catch (err) {
      console.log(
        `${chalk.white.bgRed(` ⚠ Migration Error `)} ${chalk.red(
          err.toString().replace("Error: ", "")
        )}`
      );
    }
  }

  /**
   * Get the target space token and setup the Storyblok js client
   */
  async getTargetSpaceToken() {
    try {
      const spaceRequest = await this.mapiClient.get(
        `spaces/${this.targetSpaceId}`
      );
      this.targetSpaceToken = spaceRequest.data.space.first_token;
      this.cdnApiClient = new StoryblokClient({
        accessToken: this.targetSpaceToken,
        region: this.region,
        rateLimit: 3,
      });
    } catch (err) {
      this.migrationError(
        "Error trying to retrieve the space token. Please double check the target space id and the OAUTH token."
      );
    }
  }

  /**
   * Get the Stories from the target space
   */
  async getStories() {
    this.stepMessage("1", `Fetching stories from target space.`);
    try {
      const stories_page_request = await this.cdnApiClient.get("cdn/stories", {
        version: "draft",
        per_page: 100,
        page: 1,
      });
      const pages_total = Math.ceil(stories_page_request.headers.total / 100);
      const storiesRequests = [];
      const storiesManagementRequests = [];
      for (let i = 1; i <= pages_total; i++) {
        storiesRequests.push(
          this.cdnApiClient.get("cdn/stories", {
            version: "draft",
            per_page: 100,
            page: i,
          })
        );
        storiesManagementRequests.push(
          this.mapiClient.get(`spaces/${this.targetSpaceId}/stories`, {
            version: "draft",
            per_page: 100,
            page: i,
          })
        );
      }
      const storiesResponses = await Promise.all(storiesRequests);
      const storiesResponsesManagement = await Promise.all(
        storiesManagementRequests
      );
      this.stories_list = storiesResponses.map((r) => r.data.stories).flat();
      let stories_list_management = storiesResponsesManagement
        .map((r) => r.data.stories)
        .flat();
      this.stories_list.forEach((story) => {
        let story_management = stories_list_management.find(
          (s) => s.uuid === story.uuid
        );
        if (story_management) {
          story.published = story_management.published;
          story.unpublished_changes = story_management.unpublished_changes;
        }
      });
      this.stepMessageEnd("1", `Stories fetched from target space.`);
    } catch (err) {
      console.log(err);
      this.migrationError(
        "Error fetching the stories. Please double check the target space id."
      );
    }
  }

  /**
   * Get the Assets list from the source space
   */
  async getAssetsFolders() {
    this.stepMessage("2", `Fetching assets folders from source space.`);
    try {
      const assetsFoldersRequest = await this.mapiClient.get(
        `spaces/${this.sourceSpaceId}/asset_folders`
      );
      this.assetsFolders = assetsFoldersRequest.data.asset_folders;
      this.assetsFolders.sort((a, b) => {
        if ((a.parent_id === 0 && b.parent_id !== 0) || b.parent_id === a.id) {
          return -1;
        }
        if ((a.parent_id !== 0 && b.parent_id === 0) || a.parent_id === b.id) {
          return 1;
        }
        return 0;
      });
      this.stepMessageEnd("2", `Fetching assets folders from source space.`);
    } catch (err) {
      this.migrationError(
        "Error fetching the assets folders. Please double check the source space id."
      );
    }
  }

  /**
   * Get the Assets list from the source space
   */
  async getAssets() {
    this.stepMessage("3", `Fetching assets from source space.`);
    try {
      const assetsPageRequest = await this.mapiClient.get(
        `spaces/${this.sourceSpaceId}/assets`,
        {
          per_page: 100,
          page: 1,
        }
      );
      const pages_total = Math.ceil(assetsPageRequest.headers.total / 100);
      const assets_requests = [];
      for (let i = 1; i <= pages_total; i++) {
        assets_requests.push(
          this.mapiClient.get(`spaces/${this.sourceSpaceId}/assets`, {
            per_page: 100,
            page: i,
          })
        );
      }
      const assetsResponses = await Promise.all(assets_requests);
      this.assetsList = assetsResponses
        .map((r) => r.data.assets)
        .flat()
        .map((asset) => {
          delete asset.id;
          delete asset.space_id;
          delete asset.created_at;
          delete asset.updated_at;
          delete asset.published_at;
          delete asset.deleted_at;
          return asset;
        });
      this.stepMessageEnd("3", `Fetched assets from source space.`);
    } catch (err) {
      this.migrationError(
        "Error fetching the assets. Please double check the source space id."
      );
    }
  }

  /**
   * Get the Assets list from the source space
   */
  async createAssetsFolders() {
    this.stepMessage("4", `Creating assets folders in target space.`);
    try {
      for (let index = 0; index < this.assetsFolders.length; index++) {
        const currentFolder = this.assetsFolders[index];
        const folderResponse = await this.mapiClient.post(
          `spaces/${this.targetSpaceId}/asset_folders`,
          {
            name: currentFolder.name,
            ...(currentFolder.parent_id && {
              parent_id: currentFolder.parent_id,
            }),
          }
        );
        this.assetsFoldersMap[currentFolder.id] =
          folderResponse.data.asset_folder.id;
        this.assetsFolders
          .filter((f) => !f.updated)
          .forEach((folder) => {
            if (folder.parent_id === currentFolder.id) {
              folder.parent_id = folderResponse.data.asset_folder.id;
              folder.updated = true;
            }
          });
      }
      this.assetsList.forEach((asset) => {
        asset.asset_folder_id = this.assetsFoldersMap[asset.asset_folder_id];
      });
      this.stepMessageEnd("4", `Assets folders created in target space`);
    } catch (err) {
      console.log(err);
      this.migrationError(
        "Error creating the assets folders. Please double check the source space id."
      );
    }
  }

  /**
   * Upload Assets to the target space
   */
  async uploadAssets() {
    this.stepMessage("5", ``, `0 of ${this.assetsList.length} assets uploaded`);
    this.assets = [];

    return new Promise((resolve) => {
      let total = 0;
      async.eachLimit(
        this.assetsList,
        this.simultaneousUploads,
        async (asset) => {
          const assetUrl = asset.filename.replace("s3.amazonaws.com/", "");
          const assetData = JSON.parse(JSON.stringify(asset));
          delete assetData.filename;
          this.assets.push({ originalUrl: assetUrl });
          await this.uploadAsset(assetUrl, assetData);
          this.stepMessage(
            "5",
            ``,
            `${++total} of ${this.assetsList.length} assets uploaded`
          );
        },
        () => {
          process.stdout.clearLine();
          this.stepMessageEnd("5", `Uploaded assets to target space.`);
          resolve();
        }
      );
    });
  }

  /**
   * Return an object with filename, folder and filepath of an asset in the temp folder
   */
  getLocalAssetData(url) {
    const urlParts = url.replace("https://a.storyblok.com/f/", "").split("/");
    const dimensions = urlParts.length === 4 ? urlParts[1] : "";

    return {
      filename: url.split("?")[0].split("/").pop(),
      folder: `./temp/${url.split("?")[0].split("/").slice(0, -1).pop()}`,
      filepath: `./temp/${url.split("?")[0].split("/").slice(0, -1).pop()}/${url
        .split("?")[0]
        .split("/")
        .pop()}`,
      ext: url.split("?")[0].split("/").pop().split(".").pop(),
      dimensions: dimensions,
    };
  }

  /**
   * Download an asset and store it into the temp folder
   */
  async downloadAsset(url) {
    const localAssetData = this.getLocalAssetData(url);
    if (!fs.existsSync(localAssetData.folder)) {
      fs.mkdirSync(localAssetData.folder);
    }
    const file = fs.createWriteStream(localAssetData.filepath);
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          res.pipe(file);
          file.on("finish", function () {
            file.close(resolve(true));
          });
        })
        .on("error", () => {
          console.error(reject(false));
        });
    });
  }

  /**
   * Upload a single Asset to the space
   */
  async uploadAsset(assetUrl, storyblokAssetData) {
    try {
      const localAssetData = this.getLocalAssetData(assetUrl);
      await this.downloadAsset(assetUrl);
      let newAssetPayload = { ...storyblokAssetData, filename: assetUrl };
      const newAssetRequest = await this.mapiClient.post(
        `spaces/${this.targetSpaceId}/assets`,
        newAssetPayload
      );
      if (newAssetRequest.status != 200) {
        return resolve({ success: false });
      }

      const signedRequest = newAssetRequest.data;
      let form = new FormData();
      for (let key in signedRequest.fields) {
        form.append(key, signedRequest.fields[key]);
      }
      form.append("file", fs.createReadStream(localAssetData.filepath));

      return new Promise((resolve) => {
        form.submit(signedRequest.post_url, (err) => {
          if (
            fs.existsSync(localAssetData.filepath) ||
            fs.existsSync(localAssetData.folder)
          ) {
            fs.rmSync(localAssetData.folder, { recursive: true, force: true });
          }
          if (err) {
            resolve({ success: false });
          } else {
            let assetObject = this.assets.find(
              (item) => item && item.originalUrl == assetUrl
            );
            assetObject.newUrl = signedRequest.pretty_url;

            this.mapiClient
              .get(
                `spaces/${this.targetSpaceId}/assets/${signedRequest.id}/finish_upload`
              )
              .then(() => {
                resolve({ success: true });
              })
              .catch(() => {
                resolve({ success: false });
              });
          }
        });
      });
    } catch (err) {
      if (
        err.config?.url === `/spaces/${this.targetSpaceId}/assets` &&
        (err.code === "ECONNABORTED" || err.message.includes("429"))
      ) {
        if (this.assetsRetries[asset] > this.retriesLimit) {
          return { success: false };
        } else {
          if (!this.assetsRetries[assetUrl]) {
            this.assetsRetries[assetUrl] = 1;
          } else {
            ++this.assetsRetries[assetUrl];
          }
          return this.uploadAsset(assetUrl, storyblokAssetData);
        }
      } else {
        return { success: false };
      }
    }
  }

  /**
   * Replace the new urls in the target space stories
   */
  replaceAssetsInStories() {
    this.stepMessage("6", ``, `0 of ${this.assets.length} URLs replaced`);
    this.updatedStories = this.stories_list.slice(0);
    this.assets.forEach((asset, index) => {
      const assetUrlReg = new RegExp(
        asset.originalUrl.replace("https:", "").replace("http:", ""),
        "g"
      );
      // If the asset was uploaded its URL gets replaced in the content
      if (asset.newUrl) {
        this.updatedStories = JSON.parse(
          JSON.stringify(this.updatedStories).replace(assetUrlReg, asset.newUrl)
        );
      } else {
        this.updatedStories = JSON.parse(
          JSON.stringify(this.updatedStories).replace(assetUrlReg, "")
        );
      }
      this.stepMessage(
        "4",
        ``,
        `${index} of ${this.assets.length} URLs replaced`
      );
    });
    this.stepMessageEnd("6", `Replaced all URLs in the stories.`);
  }

  /**
   * Save the updated stories in Storyblok
   */
  async saveStories() {
    let total = 0;
    const storiesWithUpdates = this.updatedStories.filter((story) => {
      const originalStory = this.stories_list.find((s) => s.id === story.id);
      return (
        JSON.stringify(originalStory.content) !== JSON.stringify(story.content)
      );
    });

    const migrationResult = await Promise.allSettled(
      storiesWithUpdates.map(async (story) => {
        delete story.content._editable;
        let post_data = { story };
        if (story.published && !story.unpublished_changes) {
          post_data.publish = 1;
        }
        try {
          await this.mapiClient.put(
            `spaces/${this.targetSpaceId}/stories/${story.id}`,
            post_data
          );
          this.stepMessage(
            "5",
            ``,
            `${++total} of ${storiesWithUpdates.length} stories updated.`
          );
          return true;
        } catch (err) {
          return false;
        }
      })
    );
    process.stdout.clearLine();
    this.stepMessageEnd("7", `Updated stories in target space.`);
    console.log(
      chalk.black.bgGreen(" ✓ Completed "),
      `${
        migrationResult.filter((r) => r.status === "fulfilled" && r.value)
          .length
      } ${
        migrationResult.filter((r) => r.status === "fulfilled" && r.value)
          .length === 1
          ? "story"
          : "stories"
      } updated.`
    );
  }
}
