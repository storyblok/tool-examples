import LocalStorage from './storage/local.js'
import S3Storage from './storage/s3.js'
import StoryblokClient from 'storyblok-js-client'

export default class SbBackup {
  /**
   * Create a new instance of the SbBackup tool
   * @param {string} param0.token The oauth token of the user
   * @param {string} param0.storage local or s3, it's the type of storage
   * @param {string} param0.basePath The local path of the backups
   * @param {string} param0.s3Settings The settings for the s3 authentication
   * @param {boolean} param0.metadata Check for updated metadata
   */
  constructor({ token, storage = 'local', basePath, s3Settings, metadata = true }) {
    this.sbClient = new StoryblokClient({
      oauthToken: token
    }, 'https://mapi.storyblok.com/v1/')

    const storageOptions = { basePath, metadata, sbClient: this.sbClient }
    switch (storage) {
      case 'local':
        this.storage = new LocalStorage(storageOptions)
        break
      case 's3':
        this.storage = new S3Storage({ s3Settings, ...storageOptions })
        break
    }
  }

  /**
   * Backup all the spaces in an account
   */
  async backupAllSpaces() {
    try {
      const spaces = await this.sbClient.get(`spaces`)
      if (spaces.data?.spaces.length) {
        for (let index = 0; index < spaces.data.spaces.length; index++) {
          await this.backupSpace(spaces.data.spaces[index].id)
        }
      } else {
        console.log('No spaces to backup.')
      }
    } catch (err) {
      console.error(`✖ An error occurred while fetching the spaces: ${err.message}`)
    }
  }

  /**
   * Backup a single space
   * @param {int} spaceId The id of the space
   */
  async backupSpace(spaceId) {
    try {
      this.storage.setSpace(spaceId)
      const assetsToBackup = await this.storage.assetsToBackup()
      if (assetsToBackup.length) {
        await this.storage.backupAssets()
        console.log(`✓ Assets of space ${spaceId} backed up correctly`)
      } else {
        console.log(`✓ No new assets to backup in space ${spaceId}`)
      }
      if (typeof this.storage.afterBackupCallback === 'function') {
        this.storage.afterBackupCallback()
      }
    } catch (err) {
      console.error(err)
      console.error(`✖ Backup task interrupted because of an error`)
    }
  }
}
