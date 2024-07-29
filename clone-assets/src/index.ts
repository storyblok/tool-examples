import chalk from "chalk";
import StoryblokClient, {ISbStoryData, ISbResult} from "storyblok-js-client";
import FormData from "form-data";
import https from "https";
import fs from "fs";
import async from "async";
import sizeOf from "image-size"

export default class Migration {
  sourceSpaceId: number;
  targetSpaceId: number;
  oauth: string;
  simultaneousUploads: number;
  sourceRegion: string;
  targetRegion: string;
  targetAssetsFolders: any[];
  sourceAssetsFolders: any[];
  assetsRetries: Record<string, number>;
  sourceAssetsFoldersMap: Record<number, number>;
  retriesLimit: number;
  detectImageSize: boolean;
  clearSource: boolean;
  usedAssets: boolean;
  duplicateFolders: boolean;
  mapiClient: StoryblokClient;
  targetMapiClient: StoryblokClient;
  cdnApiClient: StoryblokClient;
  stepsTotal: number;
  targetSpaceToken: string;
  storiesList: ISbStoryData[];
  updatedStories: ISbStoryData[];
  stringifiedStoriesList: string;
  assetsList: any[];
  unusedAssetsList: any[];
  foldersToCreate: any[];
  assets: {originalUrl: string, newUrl: string, originalId: number, newId?: number}[];

  constructor(
    oauth,
    sourceSpaceId,
    targetSpaceId,
    simultaneousUploads,
    sourceRegion,
    targetRegion,
    clearSource,
    detectImageSize,
    usedAssets,
    duplicateFolders
  ) {
    this.sourceSpaceId = sourceSpaceId;
    this.targetSpaceId = targetSpaceId;
    this.oauth = oauth;
    this.simultaneousUploads = simultaneousUploads || 20;
    this.sourceRegion = (sourceRegion || "eu").toLowerCase();
    this.targetRegion = (targetRegion || "eu").toLowerCase();
    this.targetAssetsFolders = [];
    this.assetsRetries = {};
    this.sourceAssetsFoldersMap = {};
    this.retriesLimit = 15;
    this.detectImageSize = detectImageSize;
    this.clearSource = clearSource;
    this.usedAssets = usedAssets;
    this.duplicateFolders = duplicateFolders;
    this.mapiClient = new StoryblokClient({
      oauthToken: this.oauth,
      region: this.sourceRegion,
    });
    this.targetMapiClient =  this.sourceRegion ===  this.targetRegion ? this.mapiClient : new StoryblokClient({
      oauthToken: this.oauth,
      region:  this.targetRegion,
    });
    this.stepsTotal = this.clearSource ? 8 : 7;
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
  stepMessage(index: string, text: string, append_text?: string) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(
      `${chalk.white.bgBlue(` ${index}/${this.stepsTotal} `)} ${text} ${
        append_text ? chalk.black.bgYellow(` ${append_text} `) : ""
      }`
    );
  }

  /**
   * Print a message of the completed step
   */
  stepMessageEnd(index: string, text: string) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`${chalk.black.bgGreen(` ${index}/${this.stepsTotal} `)} ${text}\n`);
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
      if (this.clearSource) await this.deleteAssetsInSource();
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
      const spaceRequest = await this.targetMapiClient.get(
        `spaces/${this.targetSpaceId}`
      );
      this.targetSpaceToken = spaceRequest.data.space.first_token;
      this.cdnApiClient = new StoryblokClient({
        accessToken: this.targetSpaceToken,
        region: this.targetRegion,
        rateLimit: 3,
      });
    } catch (err) {
      console.log(err)
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
      const links = await this.cdnApiClient.getAll("cdn/links", {
        version: "draft",
        per_page: 25
      });
      const storiesResponsesManagement = await Promise.all(
        links.map(link => this.targetMapiClient.get(`spaces/${this.targetSpaceId}/stories/${link.id}`))
      );
      this.storiesList = storiesResponsesManagement.map((r) => r.data.story);
      this.stringifiedStoriesList = JSON.stringify(this.storiesList);
      this.stepMessageEnd("1", `Stories fetched from target space.`);
    } catch (err) {
      console.log(err);
      this.migrationError(
        "Error fetching the stories. Please double check the target space id."
      );
    }
  }

  /**
   * 
   * Map child folders recursively from source to target to prevent folders duplication
   */
  mapChildFolders(sourceFolder, targetFolder) {
    const targetChildren = this.sourceAssetsFolders.filter(folder => folder.parent_id === targetFolder.id);
    const sourceChildren = this.targetAssetsFolders.filter(folder => folder.parent_id === sourceFolder.id);
    targetChildren.forEach(targetChildFolder => {
      const sourceChildFolder = sourceChildren?.find(folder => folder.name === targetChildFolder.name);
      if(sourceChildFolder) {
        this.sourceAssetsFoldersMap[targetChildFolder.id] = sourceChildFolder.id;
        this.mapChildFolders(sourceChildFolder, targetChildFolder);
      }
    });
  }

  /**
   * Get the Assets list from the source space
   */
  async getAssetsFolders() {
    this.stepMessage("2", `Fetching assets folders from source and target.`);
    try {
      const sourceAssetsFoldersRequest = await this.mapiClient.get(
        `spaces/${this.sourceSpaceId}/asset_folders`
      );
      this.sourceAssetsFolders = sourceAssetsFoldersRequest.data.asset_folders;
      // Prevent folders duplication
      if(!this.duplicateFolders) {
        const targetAssetsFoldersRequest = await this.targetMapiClient.get(
          `spaces/${this.targetSpaceId}/asset_folders`
        );
        this.targetAssetsFolders = targetAssetsFoldersRequest.data.asset_folders;
        const targetRootFolders = this.sourceAssetsFolders.filter(f => !f.parent_id);
        // Map source folders to target folders on the root level
        targetRootFolders.forEach((targetFolder) => {
          const sourceFolder = this.targetAssetsFolders.find(sourceFolder => targetFolder.name === sourceFolder.name && !sourceFolder.parent_id);
          if (sourceFolder) {
            this.sourceAssetsFoldersMap[targetFolder.id] = sourceFolder.id;
            this.mapChildFolders(sourceFolder, targetFolder);
          }
        });
      }
      this.stepMessageEnd("2", `Fetching assets folders from source and target.`);
    } catch (err) {
      this.migrationError(
        "Error fetching the assets folders. Please double check the source and target space IDs."
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
      const pages_total = Math.ceil(assetsPageRequest.total / 100);
      const assets_requests = [] as Promise<ISbResult>[];
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
          delete asset.space_id;
          delete asset.created_at;
          delete asset.updated_at;
          delete asset.published_at;
          delete asset.deleted_at;
          return asset;
        })
      if(this.usedAssets) {
        this.assetsList = this.assetsList.filter((asset) => {
          const filename = this.getAssetFilename(asset.filename);
          return this.stringifiedStoriesList.indexOf(filename) !== -1;
        });
      }
      this.stepMessageEnd("3", `Fetched assets from source space.`);
    } catch (err) {
      console.log(err)
      this.migrationError(
        "Error fetching the assets. Please double check the source space id."
      );
    }
  }

  /**
   * Check if a folder and its ancestors are not orphans
   */
  folderNotOrphan(folder) {
    const parentFolder = this.sourceAssetsFolders.find(f => f.id === folder.parent_id);
    return !folder.parent_id || (parentFolder && this.folderNotOrphan(parentFolder));
  }

  /**
   * Get the Assets list from the source space
   */
  async createAssetsFolders() {
    this.stepMessage("4", `Creating assets folders in target space.`);
    try {
      const foldersToCreate = this.sourceAssetsFolders.filter(f => !this.sourceAssetsFoldersMap[f.id] &&  this.folderNotOrphan(f));
      for (let index = 0; index < foldersToCreate.length; index++) {
        const currentFolder = foldersToCreate[index];
        const folderResponse = await this.targetMapiClient.post(
          `spaces/${this.targetSpaceId}/asset_folders`,
          {
            name: currentFolder.name
          }
        ) as any;
        this.sourceAssetsFoldersMap[currentFolder.id] =
          folderResponse.data.asset_folder.id;
        this.targetAssetsFolders.push(folderResponse.data.asset_folder);
      }
      foldersToCreate
        .forEach((folder) => {
          if(folder.parent_id && this.sourceAssetsFoldersMap[folder.parent_id]) {
            folder.parent_id = this.sourceAssetsFoldersMap[folder.parent_id];
          }
        })
      this.foldersToCreate = foldersToCreate;
      const foldersWithParent = foldersToCreate.filter(f => f.parent_id);
      for (let index = 0; index < foldersWithParent.length; index++) {
        const currentFolder = foldersWithParent[index];
        const currentFolderId = this.sourceAssetsFoldersMap[currentFolder.id];
        await this.targetMapiClient.put(
          `spaces/${this.targetSpaceId}/asset_folders/${currentFolderId}`,
          {
            parent_id: currentFolder.parent_id
          }
        );
      }
      this.assetsList.forEach((asset) => {
        asset.asset_folder_id = this.sourceAssetsFoldersMap[asset.asset_folder_id];
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
   * 
   * Return the clean filename of an asset without the S3 bucket reference
   */
  getAssetFilename(filename) {
    if(typeof filename === "string") {
      return `/${filename.slice(filename.search("/a(-[a-z]+)?.storyblok.com/"))}`;
    }
    return filename;
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
          const assetUrl = this.getAssetFilename(asset.filename);
          const assetData = JSON.parse(JSON.stringify(asset));
          delete assetData.filename;
          this.assets.push({ originalUrl: assetUrl, newUrl: `https:${assetUrl}`, originalId: assetData.id });
          delete assetData.id;
          await this.uploadAsset(assetUrl, assetData);
          this.stepMessage(
            "5",
            ``,
            `${++total} of ${this.assetsList.length} assets uploaded`
          );
        },
        () => {
          process.stdout.clearLine(0);
          this.stepMessageEnd("5", `Uploaded assets to target space.`);
          resolve(true);
        }
      );
    });
  }

  /**
   * Return an object with filename, folder and filepath of an asset in the temp folder
   */
  getLocalAssetData(url) {
    const rootRegex = /\/\/a(-[a-z]+)?.storyblok.com\/f\//i
    const urlParts = url.replace(rootRegex, "").split("/");
    const ext = url.split("?")[0].split("/").pop().split(".").pop().toLowerCase();
    const size = urlParts.length === 4 ? urlParts[1] : "";

    return {
      filename: url.split("?")[0].split("/").pop(),
      folder: `./temp/${url.split("?")[0].split("/").slice(0, -1).pop()}`,
      filepath: `./temp/${url.split("?")[0].split("/").slice(0, -1).pop()}/${url
        .split("?")[0]
        .split("/")
        .pop()}`,
      ext,
      size,
    };
  }

  /**
   * Download an asset and store it into the temp folder
   */
  async downloadAsset(url: string) {
    const localAssetData = this.getLocalAssetData(url);
    if (!fs.existsSync(localAssetData.folder)) {
      fs.mkdirSync(localAssetData.folder);
    }
    const file = fs.createWriteStream(localAssetData.filepath);
    return new Promise((resolve, reject) => {
      https
        .get(`https:${url}`, (res) => {
          res.pipe(file);
          file.on("finish", function () {
            file.close();
            resolve(true);
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
  async uploadAsset(assetUrl: string, storyblokAssetData) {
    try {
      const localAssetData = this.getLocalAssetData(assetUrl);
      let size = localAssetData.size;
      await this.downloadAsset(assetUrl);
      if(this.detectImageSize && !size && ["jpg", "jpeg", "gif", "png", "webp", "avif", "gif", "svg"].indexOf(localAssetData.ext) > -1) {
        const dimensions = sizeOf(localAssetData.filepath);
        size = `${dimensions.width}x${dimensions.height}`;
      }
      if(size === "x") size = "";
      const newAssetPayload = { ...storyblokAssetData, filename: assetUrl, ...(size && {size}) };
      const newAssetRequest = await this.targetMapiClient.post(
        `spaces/${this.targetSpaceId}/assets`,
        newAssetPayload
      ) as any;
      if (newAssetRequest.status != 200) {
        return Promise.resolve({ success: false });
      }

      const signedRequest = newAssetRequest.data;
      const form = new FormData();
      for (const key in signedRequest.fields) {
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
            const assetObject = this.assets.find(
              (item) => item && item.originalUrl === assetUrl
            );
            if(assetObject) {
              assetObject.newUrl = `https:${signedRequest.pretty_url}`;
              assetObject.newId = signedRequest.id;

              this.targetMapiClient
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
          }
        });
      });
    } catch (err) {
      if (
        err.config?.url === `/spaces/${this.targetSpaceId}/assets` &&
        (err.code === "ECONNABORTED" || err.message.includes("429"))
      ) {
        if (this.assetsRetries[assetUrl] > this.retriesLimit) {
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
        console.log(err);
        return { success: false };
      }
    }
  }
  /**
   * Replace the asset's id and filename in the tree of a story
   */
  replaceAssetInData(data, asset) {
    if(Array.isArray(data)) {
      return data.map(item => this.replaceAssetInData(item, asset))
    } else if(data && typeof data === "object" && this.getAssetFilename(data.filename) === asset.originalUrl && data.id === asset.originalId) {
      return {...data, id: asset.newId, filename: asset.newUrl}
    } else if(data && typeof data === "object") {
      return Object.keys(data).reduce((newObject, key) => {const propertyValue = this.replaceAssetInData(data[key], asset); newObject[key] = propertyValue; return newObject;}, {});
    } else if(data && typeof data === "string" && this.getAssetFilename(data) === asset.originalUrl) {
      return asset.newUrl;
    }
    return data;
  }

  /**
   * Replace the new urls in the target space stories
   */
  replaceAssetsInStories() {
    this.stepMessage("6", ``, `0 of ${this.assets.length} URLs replaced`);
    this.updatedStories = this.storiesList.slice(0);
    this.assets.forEach((asset, index) => {
      this.updatedStories = this.replaceAssetInData(this.updatedStories, asset);
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
      const originalStory = this.storiesList.find((s) => s.id === story.id);
      return (
        originalStory ? JSON.stringify(originalStory.content) !== JSON.stringify(story.content) : true
      );
    });

    const migrationResult = await Promise.allSettled(
      storiesWithUpdates.map(async (story) => {
        delete story.content._editable;
        const post_data: any = { story };
        if (story.published && !story.unpublished_changes) {
          post_data.publish = 1;
        }
        try {
          await this.targetMapiClient.put(
            `spaces/${this.targetSpaceId}/stories/${story.id}`,
            post_data
          );
          this.stepMessage(
            "7",
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
    this.stepMessageEnd("7", `Updated ${
      migrationResult.filter((r) => r.status === "fulfilled" && r.value)
        .length
    } ${
      migrationResult.filter((r) => r.status === "fulfilled" && r.value)
        .length === 1
        ? "story"
        : "stories"
    } in target space.`);
    fs.writeFileSync("./log.json", JSON.stringify({"updated-stories": storiesWithUpdates, "uploaded-assets": this.assetsList, "created-folders": this.foldersToCreate}, null, 4));
  }

  /**
   * Delete assets in source
   */
  async deleteAssetsInSource() {
    this.stepMessage("8", `Deleting assets from source space.`);
    await Promise.allSettled(this.assetsList.map(async (asset) => await this.mapiClient.delete(`spaces/${this.sourceSpaceId}/assets/${asset.id}`, {})));
    this.stepMessageEnd("8", `Deleting assets from source space.`);
  }
}
