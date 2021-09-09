import BackupStorage from './backup-storage.js'
import glob from 'glob'
import fs from 'fs'

export default class LocalStorage extends BackupStorage {
  constructor(options) {
    super(options)
    this.afterBackupCallback = () => {
      if(!glob.sync(`${this.spaceDirectory}/**/sb_asset_data_*.json`)?.length) {
        fs.rmdirSync(this.spaceDirectory, { recursive: true })
      }
    }
  }

  /**
   * Override of the default method
   */
  async backedUpAssets() {
    const assets = glob.sync(`${this.spaceDirectory}/**/sb_asset_data_*.json`)

    return assets.map(file => {
      const path_parts = file.split('/')
      const timestamp = file.match(/sb_asset_data_(.*).json/)[1]

      return {
        id: parseInt(path_parts[path_parts.length - 2]),
        updated_at: parseInt(timestamp)
      }
    })
  }

  /**
   * Override of the default method
   */
  async backupAsset({ asset, existing }) {
    if (!fs.existsSync(this.getAssetDirectory(asset))) {
      fs.mkdirSync(this.getAssetDirectory(asset), { recursive: true })
    }
    const metaDataPath = `${this.getAssetDirectory(asset)}/${this.getAssetDataFilename(asset)}`
    try {
      fs.writeFileSync(metaDataPath, JSON.stringify(asset, null, 4))
      await this.downloadAsset(asset)
      if (existing) {
        const metadataFiles = glob.sync(`${this.getAssetDirectory(asset)}/sb_asset_data_*.json`).filter(f => f !== metaDataPath)
        for (const metadataFile of metadataFiles) {
          fs.rmSync(metadataFile)
        }
      }
      return true
    } catch (err) {
      fs.rmdirSync(this.getAssetDirectory(asset), { recursive: true })
      return false
    }
  }
}
