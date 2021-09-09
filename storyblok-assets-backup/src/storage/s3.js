import BackupStorage from './backup-storage.js'
import fs from 'fs'
import AWS from 'aws-sdk'

export default class S3Storage extends BackupStorage {
  constructor(options) {
    options.basePath = './temp'
    super(options)
    this.s3Client = new AWS.S3({ accessKeyId: options.s3Settings.accessKeyId, secretAccessKey: options.s3Settings.secretAccessKey })
    this.bucket = options.bucket || 'sb-assets-backup'
    this.afterBackupCallback = () => {
      fs.rmdirSync('./temp', { recursive: true })
    }
  }

  /**
   * Override of the default method
   */
  async backedUpAssets() {
    const r = await this.s3Client.listObjectsV2({ Bucket: `${this.bucket}`, Prefix: `${this.spaceId}` }).promise()
    return this.backedUpAssetsArray = r.Contents
      .filter(item => item.Key.includes('/sb_asset_data_'))
      .map(item => {
        return {
          id: parseInt(item.Key.split('/')[1]),
          updated_at: parseInt(item.Key.match(/\/sb_asset_data_(.*).json/)[1])
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
    try {
      await this.downloadAsset(asset)
      await this.s3Client.putObject({ Bucket: this.bucket, Key: `${this.spaceId}/${asset.id}/${this.getAssetDataFilename(asset)}`, Body: JSON.stringify(asset, null, 4) }).promise()
      const filename = asset.filename.split('/').pop()
      const assetStream = fs.createReadStream(`${this.getAssetDirectory(asset)}/${filename}`)
      await this.s3Client.putObject({ Bucket: this.bucket, Key: `${this.spaceId}/${asset.id}/${filename}`, Body: assetStream }).promise()
      fs.rmdirSync(this.getAssetDirectory(asset), { recursive: true })
      if (existing) {
        const r = await this.s3Client.listObjectsV2({ Bucket: `${this.bucket}`, Prefix: `${this.spaceId}/${asset.id}/sb_asset_data_` }).promise()
        const metadataFiles = r.Contents.filter(f => f.Key !== `${this.spaceId}/${asset.id}/${this.getAssetDataFilename(asset)}`)
        await this.s3Client.deleteObjects({ Bucket: `${this.bucket}`, Delete: { Objects: metadataFiles.map(f => { return { Key: f.Key } }) } }).promise()
      }
      return true
    } catch (err) {
      console.error(err)
      fs.rmdirSync(this.getAssetDirectory(asset), { recursive: true })
      return false
    }
  }
}
