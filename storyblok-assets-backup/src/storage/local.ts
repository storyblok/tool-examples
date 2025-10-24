import BackupStorage, { BackupAssetWrapper, Asset } from "./backup-storage.js";
import fs from "fs";
import glob from "glob";
import path from "path";

export default class LocalStorage extends BackupStorage {
  /**
   * Initialize LocalStorage instance
   * @param options Options passed to BackupStorage
   */
  constructor(options: any) {
    super(options);

    // After backup callback: remove space folder if no metadata files exist
    this.afterBackupCallback = () => {
      if (
        !glob.sync(`${this.spaceDirectory}/**/sb_asset_data_*.json`)?.length
      ) {
        fs.rmdirSync(this.spaceDirectory, { recursive: true });
      }
    };
  }

  /**
   * Get all assets that have already been backed up locally
   * @returns Array of objects containing asset ID and last updated timestamp
   */
  async backedUpAssets(): Promise<Array<{ id: number; updated_at: number }>> {
    const assets = glob.sync(`${this.spaceDirectory}/**/sb_asset_data_*.json`);
    return assets.map((file) => {
      const parts = file.split("/");
      const timestamp = file.match(/sb_asset_data_(.*).json/)![1];
      return {
        id: parseInt(parts[parts.length - 2]),
        updated_at: parseInt(timestamp),
      };
    });
  }

  /**
   * Backup a single asset locally
   * @param param0 BackupAssetWrapper containing asset and existing flag
   * @returns True if backup succeeds, false otherwise
   */
  async backupAsset({ asset, existing }: BackupAssetWrapper): Promise<boolean> {
    const dir = this.getAssetDirectory(asset.id);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const metaDataPath = `${dir}/${this.getAssetDataFilename(asset)}`;
    try {
      fs.writeFileSync(metaDataPath, JSON.stringify(asset, null, 4));
      await this.downloadAsset(asset);

      // Remove old metadata files if asset already exists
      if (existing) {
        const metadataFiles = glob
          .sync(`${dir}/sb_asset_data_*.json`)
          .filter((f) => f !== metaDataPath);
        metadataFiles.forEach((file) => fs.rmSync(file));
      }

      return true;
    } catch (err) {
      console.error(err);
      fs.rmdirSync(dir, { recursive: true });
      return false;
    }
  }

  /**
   * Get the backed up assets for restore. It only retrieves the latest metadata of an asset
   * @param assetIds Optional asset ID or array of IDs; if omitted, returns all assets
   * @returns Array of objects containing local file path and asset metadata
   */
  async getLatestBackedUpAssets(assetIds?: number[]) {
    const assets: { file: string; meta: Asset }[] = [];
    let idsArray: number[] = [];

    if (typeof assetIds === "number") idsArray.push(assetIds);
    else if (Array.isArray(assetIds)) idsArray = [...assetIds];

    // If no specific IDs provided, restore all assets
    if (!assetIds) {
      const allFolders = glob.sync(`${this.spaceDirectory}/*/**/`);
      idsArray = allFolders.map((f) => parseInt(f.split("/").at(-2)!));
    }

    idsArray.forEach((id) => {
      const metadataFiles = glob.sync(
        `${this.getAssetDirectory(id)}/sb_asset_data_*.json`
      );
      const mostRecent = metadataFiles[metadataFiles.length - 1];
      const assetMeta = JSON.parse(fs.readFileSync(mostRecent, "utf-8"));

      if (!assetMeta)
        throw new Error(`Asset with ID ${id} not found in backup.`);

      assets.push({
        file: path.join(this.getAssetDirectory(id), assetMeta.short_filename),
        meta: assetMeta,
      });
    });

    return assets;
  }
}
