Name | Description | Author
------------ | ------------- | -------------
| Storyblok Assets Backup | Tool for differential backups of the assets from any Storyblok space | [Christian Zoppi](https://github.com/christianzoppi), [Gerrit Plehn](https://github.com/GerritPlehn) |

<div align="center">
	<h1 align="center">Storyblok Assets Backup</h1>
	<p align="center">A script for performing incremental backups of assets uploaded to <a href="http://www.storyblok.com?utm_source=github.com&utm_medium=readme&utm_campaign=assets-backup" target="_blank">Storyblok</a>, either locally or to an S3 bucket.</p>
</div>

<p align="center">
  <a href="https://discord.gg/jKrbAMz">
   <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=09b3af">
   </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-09b3af?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a><br/>
  <a href="https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js-client">
    <img src="https://img.shields.io/badge/Try%20Storyblok-Free-09b3af?style=appveyor&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAHqADAAQAAAABAAAAHgAAAADpiRU/AAACRElEQVRIDWNgGGmAEd3D3Js3LPrP8D8WXZwSPiMjw6qvPoHhyGYwIXNAbGpbCjbzP0MYuj0YFqMroBV/wCxmIeSju64eDNzMBJUxvP/9i2Hnq5cM1devMnz984eQsQwETeRhYWHgIcJiXqC6VHlFBjUeXgav40cIWkz1oLYXFmGwFBImaDFBHyObcOzdW4aSq5eRhRiE2dgYlpuYoYSKJi8vw3GgWnyAJIs/AuPu4scPGObd/fqVQZ+PHy7+6udPOBsXgySLDfn5GRYYmaKYJcXBgWLpsx8/GPa8foWiBhuHJIsl2DkYQqWksZkDFgP5PObcKYYff//iVAOTIDlx/QPqRMb/YSYBaWlOToZIaVkGZmAZSQiQ5OPtwHwacuo4iplMQEu6tXUZMhSUGDiYmBjylFQYvv/7x9B04xqKOnQOyT5GN+Df//8M59ASXKyMHLoyDD5JPtbj42OYrm+EYgg70JfuYuIoYmLs7AwMjIzA+uY/zjAnyWJpDk6GOFnCvrn86SOwmsNtKciVFAc1ileBHFDC67lzG10Yg0+SjzF0ownsf/OaofvOLYaDQJoQIGix94ljv1gIZI8Pv38zPvj2lQWYf3HGKbpDCFp85v07NnRN1OBTPY6JdRSGxcCw2k6sZuLVMZ5AV4s1TozPnGGFKbz+/PE7IJsHmC//MDMyhXBw8e6FyRFLv3Z0/IKuFqvFyIqAzd1PwBzJw8jAGPfVx38JshwlbIygxmYY43/GQmpais0ODDHuzevLMARHBcgIAQAbOJHZW0/EyQAAAABJRU5ErkJggg==" alt="Follow @Storyblok" />
  </a>
</p>

## 🚀 Usage

Backup all assets from your Storyblok spaces. You can back up specific spaces or all of them. The process is incremental — it only saves files missing from your current backup. Backups can be stored locally or in an S3 bucket.

### Getting Started

Place the package on your machine or server, then install it using `npm i <folder>`. Here’s an example of how to use it:

```js
import SbBackup from 'storyblok-assets-backup'

const sbBackup = new SbBackup({
    token: '', 
    storage: 's3',
    s3Settings: {
      accessKeyId: '',
      secretAccessKey: ''
    },
    metadata: true
})

sbBackup.backupSpace(123456)
sbBackup.backupAllSpaces()
```

### Settings

Constructor options for the `SbBackup` class:

* **token**: Your Storyblok account OAuth token. Retrieve it [here](https://app.storyblok.com/#!/me/account).
* **storage**: Either `local` or `s3`. The `local` option stores files in a local folder. See [Data structure](#data-structure) for more details.
* **basePath**: Optional. Defaults to `./backups`. The local folder path for backups.
* **s3Settings.accessKeyId**: Optional. Your IAM access key ID for S3 authentication.
* **s3Settings.secretAccessKey**: Optional. Your IAM secret access key for S3 authentication.
* **metadata**: Optional. Defaults to `true`. When enabled, the script checks for metadata changes and re-backs up assets if needed.

### Methods

Instances of the `SbBackup` class can perform two actions: backing up a space or backing up all spaces.

#### SbBackup.backupSpace(spaceId)

Backs up a single space. Provide the space ID as an argument.

**Example:**

```
sbBackup.backupSpace(123456)
```

#### SbBackup.backupAllSpaces()

Backs up all spaces in your account.

**Example:**

```
sbBackup.backupAllSpaces()
```

#### SbBackup.restoreAssets(spaceId, assetsIds)

Restores one or more assets to your space. Currently available only for `local` backups (not S3).
If your backup is in S3, download it to `backup/{SPACE_ID}` in your project root before running the script locally.
Each asset folder should follow this structure: `backup/{SPACE_ID}/{ASSET_ID}`. Once stored locally, run the script using the `local` storage type to restore your assets.

Restoration directly from S3 is not yet planned.

`spaceId`: The ID of your Storyblok space.
`assetsIds`: (Optional) An array of asset IDs to restore, e.g. `[12345, 12346, 393089]`. If empty, all assets will be restored.

**Example:**

```js
// Restore only 2 assets
sbBackup.restoreAssets(1234, [78789, 3332])
// Restore all assets
sbBackup.restoreAssets(1234) 
```

### Data structure

The script organizes backups into folders by space ID.
Inside each space folder, there’s a folder for every asset (named by asset ID).
Each asset folder contains:

* The asset file itself
* A `sb_asset_data_[TIMESTAMP].json` file with the [Asset Object](https://www.storyblok.com/docs/api/management#core-resources/assets/the-asset-object) from the Storyblok MAPI

The structure is identical for both `local` and `s3` backups.

When using S3, the script creates a temporary `./temp` folder before uploading files to the bucket.

## 🔗 Related Links

* **[Storyblok & JavaScript on GitHub](https://github.com/search?q=org%3Astoryblok+topic%3Ajavascript)** – Explore all our open-source JavaScript repositories.
* **[Technology Hub](https://www.storyblok.com/technologies?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js-client)** – Find curated tutorials, videos, boilerplates, and cheatsheets for various technologies.
* **[Storyblok CLI](https://github.com/storyblok/storyblok)** – A simple CLI for scaffolding Storyblok projects and field types.

## ℹ️ More Resources

### Support

* Found a bug or want to request a feature? [Open an issue](../../../issues/new).
* Need help or have questions? [Join our Discord Community](https://discord.gg/jKrbAMz).

### Contributing

Please see our [contributing guidelines](https://github.com/storyblok/.github/blob/master/contributing.md) and [code of conduct](https://www.storyblok.com/trust-center#code-of-conduct?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js-client).
This project uses [semantic-release](https://semantic-release.gitbook.io/semantic-release/) to generate new versions based on commit messages.
We follow the Angular commit convention — see [this FAQ entry](https://semantic-release.gitbook.io/semantic-release/support/faq#how-can-i-change-the-type-of-commits-that-trigger-a-release) for details.

### License

This repository is published under the [MIT license](LICENSE).
