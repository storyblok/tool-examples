import BackupStorage, { BackupAssetWrapper, Asset } from "./backup-storage.js";
import fs from "fs";
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

interface S3Settings {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  bucket?: string;
}

interface S3StorageOptions {
  basePath?: string;
  metadata?: boolean;
  sbClient: any;
  s3Settings: S3Settings;
}

export default class S3Storage extends BackupStorage {
  private s3Client: S3Client;
  private bucket: string;

  /**
   * Initialize S3Storage instance
   * @param options S3StorageOptions containing S3 credentials, Storyblok client, and optional metadata/basePath
   */
  constructor(options: S3StorageOptions) {
    options.basePath = "./temp";
    super(options);

    this.s3Client = new S3Client({
      credentials: {
        accessKeyId: options.s3Settings.accessKeyId,
        secretAccessKey: options.s3Settings.secretAccessKey,
      },
      region: options.s3Settings.region || "us-east-1",
    });

    this.bucket = options.s3Settings.bucket || "sb-assets-backup";

    // Clean temporary directory after backup
    this.afterBackupCallback = () => {
      fs.rmdirSync("./temp", { recursive: true });
    };
  }

  /**
   * List all assets already backed up in the S3 bucket for the current space
   * @returns Array of objects containing asset ID and last updated timestamp
   */
  async backedUpAssets(): Promise<Array<{ id: number; updated_at: number }>> {
    const r = await this.s3Client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.spaceId?.toString(),
      })
    );

    return (r.Contents || [])
      .filter((item) => item.Key?.includes("/sb_asset_data_"))
      .map((item) => ({
        id: parseInt(item.Key!.split("/")[1]),
        updated_at: parseInt(item.Key!.match(/\/sb_asset_data_(.*).json/)![1]),
      }));
  }

  /**
   * Retrieve backed up assets from S3 by ID(s) for restore
   * @param assetIds Optional single asset ID or array of IDs; if omitted, should return all assets
   * @returns Array of objects containing file path and metadata
   */
  async getLatestBackedUpAssets(assetIds?: number[]) {
    return [];
  }

  /**
   * Backup a single asset to S3
   * @param param0 BackupAssetWrapper containing asset and existing flag
   * @returns True if backup succeeds, false otherwise
   */
  async backupAsset({ asset, existing }: BackupAssetWrapper): Promise<boolean> {
    const dir = this.getAssetDirectory(asset);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    try {
      // Download asset to temporary local folder
      await this.downloadAsset(asset);

      // Upload asset metadata JSON to S3
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: `${this.spaceId}/${asset.id}/${this.getAssetDataFilename(
            asset
          )}`,
          Body: JSON.stringify(asset, null, 4),
        })
      );

      // Upload asset file itself to S3
      const filename = asset.filename.split("/").pop()!;
      const assetStream = fs.createReadStream(`${dir}/${filename}`);
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: `${this.spaceId}/${asset.id}/${filename}`,
          Body: assetStream,
        })
      );

      // Remove temporary local directory
      fs.rmdirSync(dir, { recursive: true });

      // If asset existed before, remove old metadata files in S3
      if (existing) {
        const r = await this.s3Client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: `${this.spaceId}/${asset.id}/sb_asset_data_`,
          })
        );

        const metadataFiles = (r.Contents || []).filter(
          (f) =>
            f.Key !==
            `${this.spaceId}/${asset.id}/${this.getAssetDataFilename(asset)}`
        );

        if (metadataFiles.length) {
          await this.s3Client.send(
            new DeleteObjectsCommand({
              Bucket: this.bucket,
              Delete: { Objects: metadataFiles.map((f) => ({ Key: f.Key! })) },
            })
          );
        }
      }

      return true;
    } catch (err) {
      console.error(err);
      fs.rmdirSync(dir, { recursive: true });
      return false;
    }
  }
}
