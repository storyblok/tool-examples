import chalk from 'chalk'
import StoryblokClient from 'storyblok-js-client'

// Throttling
export default class Migration {
  constructor(oauth, target_space_id, simultaneous_uploads, region) {
    this.target_space_id = target_space_id
    this.oauth = oauth
    this.simultaneous_uploads = simultaneous_uploads
    this.region = region
    this.assets_retries = {}
    this.retries_limit = 4
  }

  /**
   * Migration error callback
   */
  migrationError(err) {
    throw new Error(err)
  }

  /**
   * Print a message of the current step
   */
  stepMessage(index, text, append_text) {
    process.stdout.clearLine()
    process.stdout.cursorTo(0)
    process.stdout.write(`${chalk.white.bgBlue(` ${index}/3 `)} ${text} ${append_text ? chalk.black.bgYellow(` ${append_text} `) : ''}`)
  }

  /**
   * Print a message of the completed step
   */
  stepMessageEnd(index, text) {
    process.stdout.clearLine()
    process.stdout.cursorTo(0)
    process.stdout.write(`${chalk.black.bgGreen(` ${index}/3 `)} ${text}\n`)
  }

  /**
   * Start the migration
   */
  async start() {
    try {
      await this.getTargetSpaceToken()
      await this.getAssets()
      await this.logUnusedAssets()
    } catch (err) {
      console.log(`${chalk.white.bgRed(` ⚠ Migration Error `)} ${chalk.red(err.toString().replace('Error: ', ''))}`)
    }
  }

  /**
   * Get the target space token and setup the Storyblok js client
   */
  async getTargetSpaceToken() {
    try {
      this.storyblok = new StoryblokClient({
        oauthToken: this.oauth,
        region: this.region
      })
      const space_request = await this.storyblok.get(`spaces/${this.target_space_id}`)
      this.target_space_token = space_request.data.space.first_token
      this.storyblok = new StoryblokClient({
        accessToken: this.target_space_token,
        region: this.region,
        oauthToken: this.oauth,
        rateLimit: 3
      })
      this.stepMessageEnd('1', `Personal access token is valid. New StoryblokClient is created.`)

    } catch (err) {
      this.migrationError('Error trying to retrieve the space token. Please double check the target space id and the OAUTH token.')
    }
  }


  /**
   * Get the Assets list from the target space
   */
  async getAssets() {
    this.stepMessage('2', `Fetching assets from target space.`)
    try {
      const assets_page_request = await this.storyblok.get(`spaces/${this.target_space_id}/assets`, {
        per_page: 100,
        page: 1
      })
      const pages_total = Math.ceil(assets_page_request.headers.total / 100)
      const assets_requests = []
      for (let i = 1; i <= pages_total; i++) {
        assets_requests.push(
          this.storyblok.get(`spaces/${this.target_space_id}/assets`, {
            per_page: 100,
            page: i
          })
        )
      }
      const assets_responses = await Promise.all(assets_requests)

      this.assets_list = assets_responses.map(r => r.data.assets).flat().map((asset) => asset.filename)
      this.stepMessageEnd('2', `Fetched assets from target space.`)
    } catch (err) {
      this.migrationError('Error fetching the assets. Please double check the target space id.')
    }
  }

  /**
   * Log unused assets
   */

  async logUnusedAssets() {
    this.stepMessage('3', `Log assets, which are not used in any story.`)

    try {
      const unusedAssets = this.assets_list.map(async (assetFileName, i) => {
        // get end of URL starting with space ID
        //eg. "245445/901x593/ec5855f2b5/aff-lp-hero-img.png"
        const refSearchStart = assetFileName.indexOf(this.target_space_id)
      
        // get full search string
        // eg. "/f/245445/901x593/ec5855f2b5/aff-lp-hero-img.png"
        const refSearch = assetFileName.substring(refSearchStart - 3)

        const assetReferencesRequest = this.storyblok.get(`spaces/${this.target_space_id}/stories`, {
          page: 1,
          per_page: 25,
          reference_search: refSearch,
        })

        return await Promise.resolve(assetReferencesRequest).then((res) => {
          this.stepMessage('3', ``, `${i} of ${this.assets_list.length} assets checked`)
          if (res.total === 0) {
              const lastSlashIndex = assetFileName.lastIndexOf("/")
              const assetClearName = assetFileName.substring(lastSlashIndex + 1)      
              return assetClearName
            }
        })

        
      })

      const unusedAssetsNames = await Promise.all(unusedAssets)
      let number = 1
      unusedAssetsNames.map((unusedAssetName, i) => {
        if (unusedAssetName) {
          process.stdout.clearLine()
          process.stdout.cursorTo(0)
          process.stdout.write(`${chalk.dim(` ${number}.`)} ${unusedAssetName}\n`)
          number++
        }
      })

      this.stepMessageEnd('3', `${chalk.blueBright(unusedAssetsNames.length)} assets are checked for references in space ${chalk.dim("#" + this.target_space_id)}. You can see the list of unused assets filenames above.`)


    } catch (err) {
      this.migrationError('Error fetching the assets references. Please double check the target space id.')
    }
  }

}
