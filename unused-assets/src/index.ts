import chalk from "chalk";
import StoryblokClient, { ISbStoryData, ISbResult } from "storyblok-js-client";

interface AssetFolderResponse {
  link_uuids: string[];
  links: string[];
  rel_uuids: string[];
  rels: any;
  story: ISbStoryData;
  stories: Array<ISbStoryData>;
  data: any;
}
export default class CleanUpAssets {
  spaceId: number;
  paToken: string;
  region: string;
  deleteAssets: boolean;
  filterOnlyDuplicates?: boolean;
  unusedImagesFolderName: string;
  unusedImagesFolderId: number;
  mapiClient: StoryblokClient;
  cdnApiClient: StoryblokClient;
  accessToken: string;
  storiesList: ISbStoryData[];
  stringifiedStoriesList: string;
  assetsList: any[];
  duplicates: Record<string, number[]>;
  unusedAssetsList: any[];
  stepsTotal: number;

  constructor(
    paToken: string,
    spaceId: number,
    region: string,
    deleteAssets: boolean,
    filterOnlyDuplicates?: boolean,
    folder?: string
  ) {
    this.spaceId = spaceId;
    this.paToken = paToken;
    this.region = (region || "eu").toLowerCase();
    this.deleteAssets = deleteAssets;
    this.filterOnlyDuplicates = filterOnlyDuplicates;
    this.duplicates = {};
    this.unusedImagesFolderName = folder || "Unused Assets";
    this.mapiClient = new StoryblokClient({
      oauthToken: this.paToken,
      region: this.region,
    });
    this.stepsTotal = this.filterOnlyDuplicates ? 4 : 3;
  }

  /**
   * Process error callback
   */
  processError(err) {
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
    process.stdout.write(
      `${chalk.black.bgGreen(` ${index}/${this.stepsTotal} `)} ${text}\n`
    );
  }

  /**
   * Start the process
   */
  async start() {
    try {
      await this.getaccessToken();
      await this.getStories();
      await this.getAssets();
      if (this.filterOnlyDuplicates) this.filterUnusedDuplicates();
      if (this.deleteAssets) await this.deleteAssetsInSource();
      else await this.moveAssetsInFolder();
    } catch (err) {
      console.log(
        `${chalk.white.bgRed(` ⚠ Process Error `)} ${chalk.red(
          err.toString().replace("Error: ", "")
        )}`
      );
    }
  }

  /**
   * Get the space token and setup the Storyblok js client
   */
  async getaccessToken() {
    try {
      const spaceRequest = await this.mapiClient.get(`spaces/${this.spaceId}`);
      this.accessToken = spaceRequest.data.space.first_token;
      this.cdnApiClient = new StoryblokClient({
        accessToken: this.accessToken,
        region: this.region,
        rateLimit: 3,
      });
    } catch (err) {
      console.log(err);
      this.processError(
        "Error trying to retrieve the space token. Please double check the space id and the paToken token."
      );
    }
  }

  /**
   * Get the Stories from the space
   */
  async getStories() {
    this.stepMessage("1", `Fetching stories from the space.`);
    try {
      const links = await this.cdnApiClient.getAll("cdn/links", {
        version: "draft",
        per_page: 25,
      });
      const storiesResponsesManagement = await Promise.all(
        links.map((link) =>
          this.mapiClient.get(`spaces/${this.spaceId}/stories/${link.id}`)
        )
      );
      this.storiesList = storiesResponsesManagement.map((r) => r.data.story);
      this.stringifiedStoriesList = JSON.stringify(this.storiesList);
      this.stepMessageEnd("1", `Stories fetched from the space.`);
    } catch (err) {
      console.log(err);
      this.processError(
        "Error fetching the stories. Please double check the space id."
      );
    }
  }

  /**
   * Get the Assets list from the space
   */
  async getAssets() {
    this.stepMessage("2", `Fetching assets from the space.`);
    try {
      const assetsPageRequest = await this.mapiClient.get(
        `spaces/${this.spaceId}/assets`,
        {
          per_page: 100,
          page: 1,
        }
      );
      const pages_total = Math.ceil(assetsPageRequest.total / 100);
      const assets_requests = [] as Promise<ISbResult>[];
      for (let i = 1; i <= pages_total; i++) {
        assets_requests.push(
          this.mapiClient.get(`spaces/${this.spaceId}/assets`, {
            per_page: 100,
            page: i,
          })
        );
      }
      const assetsResponses = await Promise.all(assets_requests);
      this.assetsList = assetsResponses.map((r) => r.data.assets).flat();
      this.unusedAssetsList = this.assetsList.filter((asset) => {
        const filename = this.getAssetFilename(asset.filename);
        return this.stringifiedStoriesList.indexOf(filename) === -1;
      });
      this.stepMessageEnd("2", `Fetched assets from the space.`);
    } catch (err) {
      console.log(err);
      this.processError(
        "Error fetching the assets. Please double check the space id."
      );
    }
  }

  /**
   * Get duplicates IDs
   */
  get duplicatesIds() {
    return Object.values(this.duplicates).flat();
  }

  /**
   * Find duplicated assets
   */
  findDuplicates() {
    this.assetsList.forEach((currentAsset) => {
      if (this.duplicatesIds.includes(currentAsset.id)) return;
      const currentAssetFilename = currentAsset.filename.split("/").at(-1);
      const duplicates = this.assetsList
        .filter((asset) => {
          const assetFilename = asset.filename.split("/").at(-1);
          return (
            assetFilename === currentAssetFilename &&
            asset.content_length === currentAsset.content_length &&
            asset.id !== currentAsset.id
          );
        })
        .map((asset) => asset.id);
      if (duplicates.length) {
        this.duplicates[
          `${currentAssetFilename}---${currentAsset.content_length}`
        ] = [...duplicates, currentAsset.id];
      }
    });
  }

  /**
   * Filter unused duplicates
   */
  filterUnusedDuplicates() {
    this.stepMessage("3", `Selecting only unused duplicated assets`);
    this.findDuplicates();
    this.unusedAssetsList = this.unusedAssetsList.filter(
      (asset) => this.duplicatesIds.indexOf(asset.id) !== -1
    );
    const unusedAssetsListIds = this.unusedAssetsList.map((asset) => asset.id);
    // Keep at least one duplicate if they are all unused
    Object.keys(this.duplicates).forEach((label) => {
      if (
        this.duplicates[label].filter((id) => unusedAssetsListIds.includes(id))
          .length === this.duplicates[label].length
      ) {
        this.unusedAssetsList = this.unusedAssetsList.filter(
          (asset) => asset.id !== this.duplicates[label][0]
        );
      }
    });
    this.stepMessageEnd("3", `Selecting only unused duplicated assets`);
  }

  /**
   * Return the clean filename of an asset without the S3 bucket reference
   */
  getAssetFilename(filename) {
    if (typeof filename === "string") {
      return `/${filename.slice(
        filename.search("/a(-[a-z]+)?.storyblok.com/")
      )}`;
    }
    return filename;
  }

  /**
   * Search for the destination folder by name and create it if it doesn't exist
   */
  async checkAndCreateFolder() {
    try {
      const foldersRequest = await this.mapiClient.get(
        `spaces/${this.spaceId}/asset_folders`
      );
      const folders = foldersRequest.data.asset_folders;
      const unusedImagesFolder = folders.find(
        (folder) => folder.name === this.unusedImagesFolderName
      );
      if (!unusedImagesFolder) {
        const newFolder = (await this.mapiClient.post(
          `spaces/${this.spaceId}/asset_folders`,
          {
            name: this.unusedImagesFolderName,
          }
        )) as AssetFolderResponse;
        this.unusedImagesFolderId = newFolder.data.asset_folder.id;
      } else {
        this.unusedImagesFolderId = unusedImagesFolder.id;
      }
    } catch (error) {
      console.error(error.message);
    }
  }

  /**
   * Move assets in a folder
   */
  async moveAssetsInFolder() {
    this.stepMessage(
      `${this.stepsTotal}`,
      `Moving assets in the "${this.unusedImagesFolderName}" folder`
    );
    await this.checkAndCreateFolder();
    const moveOps = await Promise.allSettled(
      this.unusedAssetsList
        .filter((asset) => asset.asset_folder_id !== this.unusedImagesFolderId)
        .map(
          async (asset) =>
            await this.mapiClient.put(
              `spaces/${this.spaceId}/assets/${asset.id}`,
              { ...asset, asset_folder_id: this.unusedImagesFolderId }
            )
        )
    );
    this.stepMessageEnd(
      `${this.stepsTotal}`,
      `Moving assets in the "${this.unusedImagesFolderName}" folder`
    );
    const successfulOps = moveOps.filter(
      (operation) => operation.status === "fulfilled"
    ).length;
    const failedOps = moveOps.filter(
      (operation) => operation.status !== "fulfilled"
    ).length;
    if (successfulOps) {
      console.log(
        `${successfulOps} asset${successfulOps > 1 ? "s" : ""} transferred`
      );
    }
    if (failedOps) {
      console.log(
        `${failedOps} failed transfer operation${successfulOps > 1 ? "s" : ""}`
      );
    }
  }

  /**
   * Delete assets in source
   */
  async deleteAssetsInSource() {
    this.stepMessage(`${this.stepsTotal}`, `Deleting assets from the space.`);
    const deleteOps = await Promise.allSettled(
      this.unusedAssetsList.map(
        async (asset) =>
          await this.mapiClient.delete(
            `spaces/${this.spaceId}/assets/${asset.id}`,
            {}
          )
      )
    );
    this.stepMessageEnd(
      `${this.stepsTotal}`,
      `Deleting assets from the space.`
    );
    const successfulOps = deleteOps.filter(
      (operation) => operation.status === "fulfilled"
    ).length;
    const failedOps = deleteOps.filter(
      (operation) => operation.status !== "fulfilled"
    ).length;
    if (successfulOps) {
      console.log(
        `${successfulOps} asset${successfulOps > 1 ? "s" : ""} deleted`
      );
    }
    if (failedOps) {
      console.log(
        `${failedOps} failed deletion${successfulOps > 1 ? "s" : ""}`
      );
    }
  }
}
