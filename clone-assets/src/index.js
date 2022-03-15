import chalk from 'chalk'
import StoryblokClient from 'storyblok-js-client'
import FormData from 'form-data'
import https from 'https'
import fs from 'fs'
import async from 'async'

// Throttling
export default class Migration {
  constructor(oauth, source_space_id, target_space_id, simultaneous_uploads) {
    this.source_space_id = source_space_id
    this.target_space_id = target_space_id
    this.oauth = oauth
    this.simultaneous_uploads = simultaneous_uploads
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
    process.stdout.write(`${chalk.white.bgBlue(` ${index}/5 `)} ${text} ${append_text ? chalk.black.bgYellow(` ${append_text} `) : ''}`)
  }

  /**
   * Print a message of the completed step
   */
  stepMessageEnd(index, text) {
    process.stdout.clearLine()
    process.stdout.cursorTo(0)
    process.stdout.write(`${chalk.black.bgGreen(` ${index}/5 `)} ${text}\n`)
  }

  /**
   * Start the migration
   */
  async start() {
    try {
      fs.rmSync('./temp', { recursive: true })
      fs.mkdirSync('./temp')
      await this.getTargetSpaceToken()
      await this.getStories()
      await this.getAssets()
      await this.uploadAssets()
      this.replaceAssetsInStories()
      await this.saveStories()
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
        oauthToken: this.oauth
      })
      const space_request = await this.storyblok.get(`spaces/${this.target_space_id}`)
      this.target_space_token = space_request.data.space.first_token
      this.storyblok = new StoryblokClient({
        accessToken: this.target_space_token,
        oauthToken: this.oauth,
        rateLimit: 3
      })
    } catch (err) {
      this.migrationError('Error trying to retrieve the space token. Please double check the target space id and the OAUTH token.')
    }
  }

  /**
   * Get the Stories from the target space
   */
  async getStories() {
    this.stepMessage('1', `Fetching stories from target space.`)
    try {
      const stories_page_request = await this.storyblok.get('cdn/stories', {
        version: 'draft',
        per_page: 100,
        page: 1
      })
      const pages_total = Math.ceil(stories_page_request.headers.total / 100)
      const stories_requests = []
      const stories_management_requests = []
      for (let i = 1; i <= pages_total; i++) {
        stories_requests.push(
          this.storyblok.get('cdn/stories', {
            version: 'draft',
            per_page: 100,
            page: i
          })
        )
        stories_management_requests.push(
          this.storyblok.get(`spaces/${this.target_space_id}/stories`, {
            version: 'draft',
            per_page: 100,
            page: i
          })
        )
      }
      const stories_responses = await Promise.all(stories_requests)
      const stories_responses_management = await Promise.all(stories_management_requests)
      this.stories_list = stories_responses.map(r => r.data.stories).flat()
      let stories_list_management = stories_responses_management.map(r => r.data.stories).flat()
      this.stories_list.forEach(story => {
        let story_management = stories_list_management.find(s => s.uuid === story.uuid)
        if (story_management) {
          story.published = story_management.published
          story.unpublished_changes = story_management.unpublished_changes
        }
      })
      this.stepMessageEnd('1', `Stories fetched from target space.`)
    } catch (err) {
      console.log(err)
      this.migrationError('Error fetching the stories. Please double check the target space id.')
    }
  }

  /**
   * Get the Assets list from the source space
   */
  async getAssets() {
    this.stepMessage('2', `Fetching assets from source space.`)
    try {
      const assets_page_request = await this.storyblok.get(`spaces/${this.source_space_id}/assets`, {
        per_page: 100,
        page: 1
      })
      const pages_total = Math.ceil(assets_page_request.headers.total / 100)
      const assets_requests = []
      for (let i = 1; i <= pages_total; i++) {
        assets_requests.push(
          this.storyblok.get(`spaces/${this.source_space_id}/assets`, {
            per_page: 100,
            page: i
          })
        )
      }
      const assets_responses = await Promise.all(assets_requests)
      this.assets_list = assets_responses.map(r => r.data.assets).flat().map((asset) => asset.filename)
      this.stepMessageEnd('2', `Fetched assets from source space.`)
    } catch (err) {
      this.migrationError('Error fetching the assets. Please double check the source space id.')
    }
  }

  /**
   * Upload Assets to the target space
   */
  async uploadAssets() {
    this.stepMessage('3', ``, `0 of ${this.assets_list.length} assets uploaded`)
    this.assets = []

    return new Promise((resolve) => {
      let total = 0
      async.eachLimit(this.assets_list, this.simultaneous_uploads, async (asset) => {
        const asset_url = asset.replace('s3.amazonaws.com/', '')
        this.assets.push({ original_url: asset_url })
        await this.uploadAsset(asset_url)
        this.stepMessage('3', ``, `${++total} of ${this.assets_list.length} assets uploaded`)
      }, () => {
        process.stdout.clearLine()
        this.stepMessageEnd('3', `Uploaded assets to target space.`)
        resolve()
      })
    })
  }

  /**
   * Return an object with filename, folder and filepath of an asset in the temp folder
   */
  getAssetData(url) {
    const url_parts = url.replace('https://a.storyblok.com/f/', '').split('/')
    const dimensions = url_parts.length === 4 ? url_parts[1] : ''

    return {
      filename: url.split('?')[0].split('/').pop(),
      folder: `./temp/${url.split('?')[0].split('/').slice(0, -1).pop()}`,
      filepath: `./temp/${url.split('?')[0].split('/').slice(0, -1).pop()}/${url.split('?')[0].split('/').pop()}`,
      ext: url.split('?')[0].split('/').pop().split('.').pop(),
      dimensions: dimensions
    }
  }

  /**
   * Download an asset and store it into the temp folder
   */
  async downloadAsset(url) {
    const asset_data = this.getAssetData(url)
    if (!fs.existsSync(asset_data.folder)) {
      fs.mkdirSync(asset_data.folder)
    }
    const file = fs.createWriteStream(asset_data.filepath)
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        res.pipe(file)
        file.on('finish', function () {
          file.close(resolve(true))
        })
      }).on('error', () => {
        console.error(reject(false))
      })
    })
  }

  /**
   * Upload a single Asset to the space
   */
  async uploadAsset(asset) {
    const asset_data = this.getAssetData(asset)
    try {
      await this.downloadAsset(asset)
      let new_asset_payload = { filename: asset_data.filename, size: asset_data.dimensions }
      const new_asset_request = await this.storyblok.post(`spaces/${this.target_space_id}/assets`, new_asset_payload)
      if (new_asset_request.status != 200) {
        return resolve({ success: false })
      }

      const signed_request = new_asset_request.data
      let form = new FormData()
      for (let key in signed_request.fields) {
        form.append(key, signed_request.fields[key])
      }
      form.append('file', fs.createReadStream(asset_data.filepath))

      return new Promise((resolve) => {
        form.submit(signed_request.post_url, (err) => {
          if (fs.existsSync(asset_data.filepath) || fs.existsSync(asset_data.folder)) {
            fs.rmSync(asset_data.folder, { recursive: true })
          }
          if (err) {
            resolve({ success: false })
          } else {
            let asset_object = this.assets.find(item => item && item.original_url == asset)
            asset_object.new_url = signed_request.pretty_url

            this.storyblok.get(`spaces/${this.target_space_id}/assets/${signed_request.id}/finish_upload`).then(() => {
              resolve({ success: true })
            }).catch(() => { 
              resolve({ success: false })
            })
          }
        })
      })
    } catch (err) {
      if (err.config?.url === `/spaces/${this.target_space_id}/assets` &&
        (err.code === 'ECONNABORTED' || err.message.includes('429'))) {
        if (this.assets_retries[asset] > this.retries_limit) {
          return { success: false }
        } else {
          if (!this.assets_retries[asset]) {
            this.assets_retries[asset] = 1
          } else {
            ++this.assets_retries[asset]
          }
          return this.uploadAsset(asset)
        }
      } else {
        return { success: false }
      }
    }
  }

  /**
   * Replace the new urls in the target space stories
   */
  replaceAssetsInStories() {
    this.stepMessage('4', ``, `0 of ${this.assets.length} URLs replaced`)
    this.updated_stories = this.stories_list.slice(0)
    this.assets.forEach((asset, index) => {
      const asset_url_reg = new RegExp(asset.original_url.replace('https:', '').replace('http:', ''), 'g')
      // If the asset was uploaded its URL gets replaced in the content
      if (asset.new_url) {
        this.updated_stories = JSON.parse(JSON.stringify(this.updated_stories).replace(asset_url_reg, asset.new_url))
      } else {
        this.updated_stories = JSON.parse(JSON.stringify(this.updated_stories).replace(asset_url_reg, ''))
      }
      this.stepMessage('4', ``, `${index} of ${this.assets.length} URLs replaced`)
    })
    this.stepMessageEnd('4', `Replaced all URLs in the stories.`)
  }

  /**
   * Save the updated stories in Storyblok
   */
  async saveStories() {
    let total = 0
    const stories_with_updates = this.updated_stories.filter((story) => {
      const original_story = this.stories_list.find(s => s.id === story.id)
      return JSON.stringify(original_story.content) !== JSON.stringify(story.content)
    })

    const migration_result = await Promise.allSettled(stories_with_updates.map(async (story) => {
      const original_story = this.stories_list.find(s => s.id === story.id)
      delete story.content._editable
      let post_data = { story }
      if (story.published && !story.unpublished_changes) {
        post_data.publish = 1
      }
      try {
        await this.storyblok.put(`spaces/${this.target_space_id}/stories/${story.id}`, post_data)
        this.stepMessage('5', ``, `${++total} of ${stories_with_updates.length} stories updated.`)
        return true
      } catch(err) {
        return false
      }
    }))
    process.stdout.clearLine()
    this.stepMessageEnd('5', `Updated stories in target space.`)
    console.log(chalk.black.bgGreen(' ✓ Completed '), `${migration_result.filter(r => r.status === 'fulfilled' && r.value).length} ${migration_result.filter(r => r.status === 'fulfilled' && r.value).length === 1 ? 'story' : 'stories'} updated.`)
  }
}
