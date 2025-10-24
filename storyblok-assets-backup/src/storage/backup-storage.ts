import fs from "fs";
import async from "async";
import https from "https";
import StoryblokClient from "storyblok-js-client";

export interface BackupStorageOptions {
  basePath?: string;
  metadata?: boolean;
  sbClient: StoryblokClient;
}

export interface Asset {
  id: number;
  filename: string;
  updated_at: number;
  [key: string]: any;
}

export interface BackupAssetWrapper {
  asset: Asset;
  existing: boolean;
}

interface BackedUpAsset {
  file: string;
  meta: Asset;
}

export default abstract class BackupStorage {
  protected simultaneousBackups = 10;
  protected basePath: string;
  protected metadata?: boolean;
  protected sbClient: StoryblokClient;
  protected assetsArray: Asset[] | null = null;
  protected assetsToBackupArray: BackupAssetWrapper[] | null = null;
  protected assetsRetries: Record<string, number> = {};
  public afterBackupCallback?: () => void;
  protected spaceId?: number;

  /**
   * Initialize BackupStorage instance
   * @param options.basePath Local root path for backups
   * @param options.metadata Whether to track asset metadata
   * @param options.sbClient Storyblok client instance
   */
  constructor(options: BackupStorageOptions) {
    this.basePath = options?.basePath?.replace(/^\/+|\/+$/g, "") || "./backups";
    this.metadata = options?.metadata;
    this.sbClient = options.sbClient;
  }

  /**
   * Set the current space ID
   * @param spaceId Storyblok space ID
   */
  setSpace(spaceId: number) {
    this.spaceId = spaceId;
    if (!fs.existsSync(this.spaceDirectory)) {
      fs.mkdirSync(this.spaceDirectory, { recursive: true });
    }
    this.assetsArray = null;
    this.assetsToBackupArray = null;
  }

  /**
   * Returns the root directory path of the current space
   */
  get spaceDirectory(): string {
    return `${this.basePath}/${this.spaceId}`;
  }

  /**
   * Returns the directory path for a given asset
   * @param assetId Asset ID or Asset object
   */
  getAssetDirectory(assetId: number | Asset): string {
    const id = typeof assetId === "number" ? assetId : assetId.id;
    return `${this.spaceDirectory}/${id}`;
  }

  /**
   * Return a list of assets that have already been backed up
   */
  abstract backedUpAssets(): Promise<Array<{ id: number; updated_at: number }>>;

  /**
   * Get backed up assets by IDs (for restore)
   * @param assetIds Optional asset ID or array of IDs
   */
  abstract getLatestBackedUpAssets(
    assetIds?: number[]
  ): Promise<BackedUpAsset[]>;

  /**
   * Backup a single asset
   * @param assetWrapper Asset object with existing flag
   * @returns True if backup succeeds, false otherwise
   */
  abstract backupAsset(assetWrapper: BackupAssetWrapper): Promise<boolean>;

  /**
   * Determine which assets need to be backed up
   * @returns Array of assets to backup
   */
  async assetsToBackup(): Promise<BackupAssetWrapper[]> {
    if (!this.assetsToBackupArray) {
      this.assetsToBackupArray = [];
      const backedUpAssets = await this.backedUpAssets();
      const assets = await this.getAssets();

      if (this.metadata) {
        for (const asset of assets) {
          const match = backedUpAssets.find((b) => b.id === asset.id);
          if (match) {
            if (new Date(asset.updated_at).getTime() !== match.updated_at) {
              this.assetsToBackupArray.push({ asset, existing: true });
            }
          } else {
            this.assetsToBackupArray.push({ asset, existing: false });
          }
        }
      } else {
        this.assetsToBackupArray = assets
          .filter((a) => !backedUpAssets.find((b) => b.id === a.id))
          .map((asset) => ({ asset, existing: false }));
      }
    }

    return this.assetsToBackupArray;
  }

  /**
   * Backup all assets in the current space
   * @returns True if all backups succeed, false otherwise
   */
  async backupAssets(): Promise<boolean> {
    const assetsToBackup = await this.assetsToBackup();
    return new Promise((resolve, reject) => {
      async.eachLimit(
        assetsToBackup,
        this.simultaneousBackups,
        async (asset) => {
          const res = await this.backupAsset(asset);
          if (!res) console.log(`Error backing up ${asset.asset.filename}`);
        },
        (err) => {
          if (err) reject(false);
          else resolve(true);
        }
      );
    });
  }

  /**
   * Fetch all assets from Storyblok for the current space
   * @returns Array of Storyblok assets
   */
  async getAssets(): Promise<Asset[]> {
    if (!this.assetsArray) {
      try {
        const assetsPageRequest = await this.sbClient.get(
          `spaces/${this.spaceId}/assets`,
          {
            per_page: 100,
            page: 1,
          }
        );
        const pagesTotal = Math.ceil(assetsPageRequest.total / 100);
        const assetsRequests = [];
        for (let i = 1; i <= pagesTotal; i++) {
          assetsRequests.push(
            this.sbClient.get(`spaces/${this.spaceId}/assets`, {
              per_page: 100,
              page: i,
            })
          );
        }
        const assetsResponses = await Promise.all(assetsRequests);
        this.assetsArray = assetsResponses.map((r) => r.data.assets).flat();
      } catch (err) {
        console.error(
          "✖ Error fetching the assets. Please double check the source space id."
        );
      }
    }
    return this.assetsArray || [];
  }

  /**
   * Download an asset from Storyblok to local filesystem
   * @param asset Asset object from Storyblok
   * @returns True if download succeeds, false otherwise
   */
  async downloadAsset(asset: Asset): Promise<boolean> {
    const filename = asset.filename.split("/").pop()!;
    const dir = this.getAssetDirectory(asset.id);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = `${dir}/${filename}`;
    const file = fs.createWriteStream(filePath);

    return new Promise((resolve, reject) => {
      https
        .get(asset.filename, (res) => {
          if (res.statusCode === 200) {
            res.pipe(file);
            file.on("finish", () => file.close(() => resolve(true)));
          } else {
            reject(false);
          }
        })
        .on("error", () => reject(false));
    });
  }

  /**
   * Get the filename to store asset metadata
   * @param asset Asset object
   * @returns Filename string (e.g., sb_asset_data_123456789.json)
   */
  getAssetDataFilename(asset: Asset): string {
    const timestamp = new Date(asset.updated_at).getTime();
    return `sb_asset_data_${timestamp}.json`;
  }
}
