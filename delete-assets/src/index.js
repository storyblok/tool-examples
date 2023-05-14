import chalk from "chalk";
import StoryblokClient from "storyblok-js-client";
import async from "async";

export default class Operation {
  constructor(oauth, target_space_id, simultaneous_uploads) {
    this.target_space_id = target_space_id;
    this.oauth = oauth;
    this.simultaneous_uploads = simultaneous_uploads;
  }

  /**
   * Operation error callback
   */
  operationError(err) {
    throw new Error(err);
  }

  /**
   * Print a message of the current step
   */
  stepMessage(index, text, append_text) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(
      `${chalk.white.bgBlue(` ${index}/2 `)} ${text} ${
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
    process.stdout.write(`${chalk.black.bgGreen(` ${index}/2 `)} ${text}\n`);
  }

  /**
   * Start the operation
   */
  async start() {
    try {
      await this.getTargetSpaceToken();
      await this.getTargetAssets();
      await this.deleteTargetAssets();
    } catch (err) {
      console.log(
        `${chalk.white.bgRed(` ⚠ Operation Error `)} ${chalk.red(
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
      this.storyblok = new StoryblokClient({
        oauthToken: this.oauth,
      });
      const space_request = await this.storyblok.get(
        `spaces/${this.target_space_id}`
      );
      this.target_space_token = space_request.data.space.first_token;
      this.storyblok = new StoryblokClient({
        accessToken: this.target_space_token,
        oauthToken: this.oauth,
        rateLimit: 3,
      });
    } catch (err) {
      this.operationError(
        "Error trying to retrieve the space token. Please double check the target space id and the OAUTH token."
      );
    }
  }

  /**
   * Get the Assets list from the target space
   */
  async getTargetAssets() {
    this.stepMessage("1", `Fetching assets from target space.`);
    try {
      const assets_page_request = await this.storyblok.get(
        `spaces/${this.target_space_id}/assets`,
        {
          per_page: 100,
          page: 1,
        }
      );
      const pages_total = Math.ceil(assets_page_request.headers.total / 100);
      const assets_requests = [];
      for (let i = 1; i <= pages_total; i++) {
        assets_requests.push(
          this.storyblok.get(`spaces/${this.target_space_id}/assets`, {
            per_page: 100,
            page: i,
          })
        );
      }
      const assets_responses = await Promise.all(assets_requests);
      this.target_assets_list = assets_responses
        .map((r) => r.data.assets)
        .flat();
      this.stepMessageEnd("1", "Fetched assets from target space.");
    } catch (err) {
      this.operationError(
        "Error fetching the assets. Please double check the target space id."
      );
    }
  }

  /**
   * Delete the Assets list from the target space
   */
  async deleteTargetAssets() {
    this.stepMessage(
      "2",
      ``,
      `0 of ${this.target_assets_list.length} assets deleted`
    );

    return new Promise((resolve) => {
      let total = 0;
      async.eachLimit(
        this.target_assets_list,
        this.simultaneous_uploads,
        async (asset) => {
          await this.deleteAsset(asset);
          this.stepMessage(
            "2",
            ``,
            `${++total} of ${this.target_assets_list.length} assets deleted`
          );
        },
        () => {
          process.stdout.clearLine();
          this.stepMessageEnd("2", `Deleted assets from target space.`);
          resolve();
        }
      );
    });
  }

  /**
   * Delete a single Asset to the space
   */
  async deleteAsset(asset) {
    try {
      await this.storyblok.delete(
        `spaces/${this.target_space_id}/assets/${asset.id}`
      );
    } catch (err) {
      this.operationError(
        `Error deleting the asset ${asset.id}. Please double check the target space id.`
      );
    }
  }
}
