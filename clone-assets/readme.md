# Clone Assets

This script can be used to clone assets from a space to a cloned space, in order to have the assets stored in the cloned one. 
Once all the assets are stored in the target space, the script will replace the url of the assets in the entries of that space and it'll update them keeping the correct publish/unpublish status.

Name | Description | Author
------------ | ------------- | -------------
Clone Assets | A tool to clone assets from a space to its clone | [Christian Zoppi](https://github.com/christianzoppi)


## How to use

Run `npm i` to install and then `npm run start`. There are the parameters you will get asked:

- Personal Access Token from your account.
- Source space id.
- Target space id.
- Max simultaneous uploads (default is 20).
- Source space region (default is EU).
- Target space region (default is EU).
- Delete assets in source space (default is no). Set to `yes` to delete the assets from the source space after the cloning is complete. Use just if strictly necessary. 
- Detect size of images without size in the URL (default is no). Set to `yes` to make the script add the size for you during the migration. Just useful if sizes are missing also on the source space.
- Clone only used assets (default is no). Set to `yes` to only migrate assets that are used in the target space from the source space.