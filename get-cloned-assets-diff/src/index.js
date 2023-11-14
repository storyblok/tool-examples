import chalk from 'chalk'
import StoryblokClient from 'storyblok-js-client'

// Throttling
export default class Migration {
  constructor(oauth, source_space_id, target_space_id, simultaneous_uploads, region) {
    this.source_space_id = source_space_id
    this.target_space_id = target_space_id
    this.source_space_type = "SOURCE"
    this.target_space_type = "TARGET"
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
    process.stdout.write(`${chalk.white.bgBlue(` ${index}/4 `)} ${text} ${append_text ? chalk.black.bgYellow(` ${append_text} `) : ''}`)
  }

  /**
   * Print a message of the completed step
   */
  stepMessageEnd(index, text) {
    process.stdout.clearLine()
    process.stdout.cursorTo(0)
    process.stdout.write(`${chalk.black.bgGreen(` ${index}/4 `)} ${text}\n`)
  }

  /**
   * Start the migration
   */
  async start() {
    try {
      await this.getTargetSpaceToken()
      await this.getAssets(this.source_space_id, this.source_space_type)
      await this.getAssets(this.target_space_id, this.target_space_type)
      await this.getMissingAssets()
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
   * Get the Assets list from the source space
   */
  
  async getAssets(spaceId, spaceType) {
    switch (spaceType) {
      case this.source_space_type:
        this.stepMessage('2', `Fetching assets from ${chalk.bgBlueBright(this.source_space_type)}  space.`)
        break
      case this.target_space_type:
        this.stepMessage('3', `Fetching assets from ${chalk.bgMagentaBright(this.target_space_type)} space.`)
        break
    }

    try {
      const assets_page_request = await this.storyblok.get(`spaces/${spaceId}/assets`, {
        per_page: 100,
        page: 1
      })
      const pages_total = Math.ceil(assets_page_request.headers.total / 100)
      const assets_requests = []
      for (let i = 1; i <= pages_total; i++) {
        assets_requests.push(
          this.storyblok.get(`spaces/${spaceId}/assets`, {
            per_page: 100,
            page: i
          })
        )
      }
      const assets_responses = await Promise.all(assets_requests)

      switch (spaceType) {
        case this.source_space_type:
          this.source_assets_list = assets_responses.map(r => r.data.assets).flat().map((asset) => asset.filename)
          this.stepMessageEnd('2', `Fetched assets from ${chalk.bgBlueBright(this.source_space_type)} space. Total: ${chalk.bgBlueBright(this.source_assets_list.length)}`)
          break
        
        case this.target_space_type:
          this.target_assets_list = assets_responses.map(r => r.data.assets).flat().map((asset) => asset.filename)
          this.stepMessageEnd('3', `Fetched assets from ${chalk.bgMagentaBright(this.target_space_type)} space. Total: ${chalk.bgMagentaBright(this.target_assets_list.length)}`)
          break
        
      }
    } catch (err) {
      this.migrationError('Error fetching the assets. Please double check the space ids.')
    }
  }

  async getMissingAssets() {

    this.stepMessage('4', `Finding ${chalk.bgMagentaBright(" " + this.source_assets_list.length - this.target_assets_list.length + " ")} missing assets.`)

    const targetAssets = {}
    this.target_assets_list.map(targetAsset => {
      targetAssets[this.getAssetResolutionAndName(targetAsset)] = true
    })

    let number = 1
    this.source_assets_list.map(sourceAsset => {
      let sourceAssetResolutionAndName = this.getAssetResolutionAndName(sourceAsset)
      if (!targetAssets[sourceAssetResolutionAndName]) {
        process.stdout.clearLine()
        process.stdout.cursorTo(0)
        if (sourceAssetResolutionAndName.substring(0, 2) === "x-") {
          sourceAssetResolutionAndName = sourceAssetResolutionAndName.substring(2)
        }
        process.stdout.write(`${chalk.dim(` ${number}.`)} ${sourceAssetResolutionAndName}\n`)
        number++
      }

    })



    this.stepMessageEnd('4', `Target space ${chalk.dim("#" + this.target_space_id)}. Total: ${chalk.bgMagentaBright(" " + this.source_assets_list.length - this.target_assets_list.length + " ")} assets are missing.`)

  }



  getAssetResolutionAndName(asset) {
    //asset eg. "https://s3.amazonaws.com/a.storyblok.com/f/262399/1575x990/1553787291/webscrap-card-image2.png"
    const assetBySlash = asset.split("/")
    
    // eg. "1575x990" + "-" + "webscrap-card-image2.png
    return assetBySlash[assetBySlash.length - 3] + "-" + assetBySlash[assetBySlash.length - 1]
  }

}
