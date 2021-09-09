Name | Description | Author
------------ | ------------- | -------------
Storyblok Assets Backup | Tool for differential backups of the assets of any Storyblok space | [Christian Zoppi](https://github.com/christianzoppi), [Gerrit Plehn](https://github.com/GerritPlehn) 

<div align="center">
	<h1 align="center">Storyblok Assets Backup</h1>
	<p align="center">This is the script to perform incremental backups of assets uploaded in <a href="http://www.storyblok.com?utm_source=github.com&utm_medium=readme&utm_campaign=assets-backup" target="_blank">Storyblok</a> to your local machine or an S3 bucket.</p>
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

Backup all the assets of your spaces. You can perform the backup for specific spaces or for all of them. The backup is incremental, so it will save just what is missing from your current backup. Backups can be performed locally or on an S3 bucket.

### Getting Started
You need to place the package on your machine or on your server and you can install it with `npm i <folder>`. This is an example of how you can use this package. 

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
The settings of the constructor of the class `SbBackup` are:
- **token**: the oauth token of your Storyblok account. You can retrieve it [here](https://app.storyblok.com/#!/me/account);  
- **storage**: the value can be `local` or `s3`. `local` will make the script store files on a local folder. You can [read more here](#data-structure) about the folders and the data structure;
- **basePath**: optional, defaults to `./backups` - this is the path of the backup folder in case you are performing a local backup;
- **s3Settings.accessKeyId**: optional - this is the IAM access key id for authentication on your S3 bucket;  
- **s3Settings.secretAccessKey**: optional - this is the IAM secret access key for authentication on your S3 bucket.
- **metadata**: optional, defaults to `true` - indicates if metadata should be checked for updates. If metadata changed the asset will be backed up again.

### Methods
All instances of the `SbBackup` class can perform 2 actions: backup a space or backup all the spaces.

#### SbBackup.backupSpace(spaceId)
This method can backup a single space. You have to provide the space id as an argument.

**Example**:
```
sbBackup.backupSpace(123456)
```

#### SbBackup.backupAllSpaces()
This method can backup all the spaces in your account.

**Example**:
```
sbBackup.backupAllSpaces()
```

### Data structure
The script will store and organise the content by creating a folder for each space, the folder will have the id of the space. Inside the folder of the space there will be a folder with the id of each asset. Inside the folder of each asset there will be the asset itself and a file called `sb_asset_data_[TIMESTAMP].json` with the [Asset Object](https://www.storyblok.com/docs/api/management#core-resources/assets/the-asset-object) from the Storyblok MAPI. The structure will be the same for both the `local` and the `s3` backups.

When performing the S3 backup the script will create a `./temp` folder to store the files temporarily before sending them to the bucket.

## 🔗 Related Links

* **[Storyblok & Javascript on GitHub](https://github.com/search?q=org%3Astoryblok+topic%3Ajavascript)**: Check all of our Javascript open source repos;
* **[Technology Hub](https://www.storyblok.com/technologies?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js-client)**: We prepared technology hubs so that you can find selected beginner tutorials, videos, boilerplates, and even cheatsheets all in one place;
* **[Storyblok CLI](https://github.com/storyblok/storyblok)**: A simple CLI for scaffolding Storyblok projects and fieldtypes.

## ℹ️ More Resources

### Support

* Bugs or Feature Requests? [Submit an issue](../../../issues/new);

* Do you have questions about Storyblok or you need help? [Join our Discord Community](https://discord.gg/jKrbAMz).

### Contributing

Please see our [contributing guidelines](https://github.com/storyblok/.github/blob/master/contributing.md) and our [code of conduct](https://www.storyblok.com/trust-center#code-of-conduct?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-js-client).
This project use [semantic-release](https://semantic-release.gitbook.io/semantic-release/) for generate new versions by using commit messages and we use the Angular Convention to naming the commits. Check [this question](https://semantic-release.gitbook.io/semantic-release/support/faq#how-can-i-change-the-type-of-commits-that-trigger-a-release) about it in semantic-release FAQ.

### License  

This repository is published under the [MIT license](LICENSE).
