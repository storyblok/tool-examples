# Clone Assets

This script can be used to clone assets from a space to a cloned space, in order to have the assets stored in the cloned one. 
Once all the assets are stored in the target space, the script will replace the url of the assets in the entries of that space and it'll update them keeping the correct publish/unpublish status.

Name | Description | Author
------------ | ------------- | -------------
Clone Assets | A tool to clone assets from a space to its clone | [Christian Zoppi](https://github.com/christianzoppi)


## How to use

Copy the `.env.example` file to `.env` and fill out the variables. These are the parameters you will have to fill out:

- `VITE_PERSONAL_ACCESS_TOKEN`: Personal Access Token from your account.
- `VITE_SOURCE_SPACE_ID`: Source space id.
- `VITE_TARGET_SPACE_ID`: Target space id.
- `VITE_SIMULTANEOUS_UPLOADS` (optional, default is 20): Max simultaneous uploads.
- `VITE_SOURCE_SPACE_REGION` (optional, default is EU): Source space region.
- `VITE_TARGET_SPACE_REGION` (optional, default is EU): Target space region.
- `VITE_CLEAR_SOURCE` (optional, default is `false`): Delete assets in source space when the migration is completed. Set to `true` to delete the assets from the source space after the cloning is complete. Use just if strictly necessary. 
- `VITE_USED_ASSETS_ONLY` (optional, default is `false`): Clone only used assets. Set to `true` to only migrate assets that are used in the target space from the source space.
- `VITE_DUPLICATE_FOLDERS` (optional, default is `false`): Duplicate folders with the same name when performing the migration. Set to `true` to create duplicated folders when performing the migration. By default the script will compare the folders by name and map the ones in the source space to the ones in the target space.
- `VITE_DETECT_IMAGE_SIZE` (optional, default is `false`): Detect size of images without size in the URL. Set to `true` to make the script add the size for you during the migration. Just useful if sizes are missing also on the source space. This is useful if you have any assets without the image set because of an incorrect use of the MAPI.
- `VITE_OFFSET` (optional, default is 0): This offset can be used to run migrations in batches. It should be combined with the `VITE_LIMIT` parameter.
- `VITE_LIMIT` (optional, default is 0): This is the number of assets starting from the `VITE_OFFSET` index number that will be cloned. To move the first 100 assets of a space, you can set `VITE_LIMIT` to 100 and `VITE_OFFSET` to 0, to move the assets from 101 to 200 you can set `VITE_LIMIT` to 100 and `VITE_OFFSET` to 100.

Then you only need to run `npm i` to install and then `npm run start` to perform the migration. The whole process can take a lot of time if your space has many assets, so it's recommended to use `VITE_USED_ASSETS_ONLY` when possible and also use a test space to perform the migration first to make sure it was completed successfully.