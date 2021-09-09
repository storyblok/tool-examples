import fs from 'fs'
import async from 'async'
import https from 'https'

export default class BackupStorage {
  constructor(options) {
    this.simultaneousBackups = 10
    // The base path  is the root of your local 
    this.basePath = options?.basePath?.replace(/^\/+|\/+$/g, '') || './backups'
    this.metadata = options?.metadata
    this.sbClient = options?.sbClient
  }

  /**
   * Set the id of the current space
   * @param {int} spaceId The id of the space
   */
  setSpace(spaceId) {
    this.spaceId = spaceId
    if (!fs.existsSync(this.spaceDirectory)) {
      fs.mkdirSync(this.spaceDirectory, { recursive: true })
    }
    this.assetsArray = null
    this.assetsToBackupArray = null
  }

  /**
   * Backup all the assets from an array
   * @param {Array} assets The array of the assets' objects from Storyblok
   * @return {Promise} The Promise will return a true or false 
   */
  async backupAssets() {
    let assetsToBackup = await this.assetsToBackup()

    return new Promise((resolve, reject) => {
      async.eachLimit(assetsToBackup, this.simultaneousBackups, async (asset) => {
        const backupAssetRes = await this.backupAsset(asset)
        if (!backupAssetRes) {
          console.log(`Error backing up ${asset.filename}`)
        }
      }, (err) => {
        if (err) {
          return reject(false)
        }
        return resolve(true)
      })
    })
  }

  /**
   * Return the list of the assets already backed up.
   * @returns {Array} An array of asset objects
   */
  async backedUpAssets() {
    console.log('You forgot to override the "backedUpAssets" method')
  }

  /**
   * Backs up an asset. It must return true or false depending on the success
   * of the action
   * @param {Object} asset The asset object from Storyblok
   * @returns {Bool} Success of the action
   */
  async backupAsset(asset) {
    console.log('You forgot to override the "backupAsset" method')
  }

  /**
   * The space directory
   */
  get spaceDirectory() {
    return `${this.basePath}/${this.spaceId}`
  }

  /**
   * The asset directory
   * @param {Object} asset The asset object from Storyblok
   * @returns {String} The path of the directory
   */
  getAssetDirectory(asset) {
    return `${this.spaceDirectory}/${asset.id}`
  }

  /**
   * Get the assets to backup
   */
  async assetsToBackup() {
    if (!this.assetsToBackupArray) {
      this.assetsToBackupArray = []
      const backedUpAssets = await this.backedUpAssets()
      const assets = await this.getAssets()
      if (this.metadata) {
        for (const asset of assets) {
          const match = backedUpAssets.find(bAsset => bAsset.id === asset.id)
          if (match) {
            if (new Date(asset.updated_at).getTime() !== match.updated_at) {
              this.assetsToBackupArray.push({ asset: asset, existing: true })
            }
          } else {
            this.assetsToBackupArray.push({ asset: asset, existing: false })
          }
        }
      } else {
        this.assetsToBackupArray = assets.filter(asset => !backedUpAssets.find(bAsset => bAsset.id === asset.id))
          .map(asset => { return { asset: asset, existing: false } })
      }
    }
    return this.assetsToBackupArray
  }

  /**
   * Download an asset locally
   * @param {Object} asset The asset object from Storyblok
   * @returns 
   */
  async downloadAsset(asset) {
    const filename = asset.filename.split('/').pop()
    const file = fs.createWriteStream(`${this.getAssetDirectory(asset)}/${filename}`)

    return new Promise((resolve, reject) => {
      https.get(asset.filename, (res) => {
        if (res.statusCode === 200) {
          res.pipe(file)
          file.on('finish', function () {
            file.close(resolve(true))
          })
        } else {
          return reject(false)
        }
      }).on('error', (err) => {
        return reject(false)
      })
    })
  }

  /**
   * Get all the assets objects from a space
   * @returns 
   */
  async getAssets() {
    if (!this.assetsArray) {
      try {
        const assetsPageRequest = await this.sbClient.get(`spaces/${this.spaceId}/assets`, {
          per_page: 100,
          page: 1
        })
        const pagesTotal = Math.ceil(assetsPageRequest.headers.total / 100)
        const assetsRequests = []
        for (let i = 1; i <= pagesTotal; i++) {
          assetsRequests.push(
            this.sbClient.get(`spaces/${this.spaceId}/assets`, {
              per_page: 100,
              page: i
            })
          )
        }
        const assetsResponses = await Promise.all(assetsRequests)
        this.assetsArray = assetsResponses.map(r => r.data.assets).flat()
      } catch (err) {
        console.error('✖ Error fetching the assets. Please double check the source space id.')
      }
    }
    return this.assetsArray
  }

  /**
   * Get the filename of the data of an asset
   * @param {Object} asset The asset object
   * @returns 
   */
  getAssetDataFilename(asset) {
    const timestamp = new Date(asset.updated_at).getTime()
    return `sb_asset_data_${timestamp}.json`;
  }
}
