# Migrate Assets

This script can be used to migrate assets from a space to a cloned space, in order to have the assets stored in the cloned one. 
Once all the assets are stored in the target space, the script will replace the url of the assets in the entries of that space and it'll update them keeping the correct publish/unpublish status.

Name | Description | Author
------------ | ------------- | -------------
Move Assets | A tool to clone assets from a space to its clone | [Christian Zoppi](https://github.com/christianzoppi)


## How to use

Run `npm i` to install and then `npm run start`. You'll have to provide a Personal Access Token from your account, the id of the source space, the id of the target space and the number of the max simultaneous uploads. The default for the max simultaneous uploads is 20 but you can increase it slightly to make the upload faster if your computer and connection can handle it or you can decrease it if you want to use less bandwidth and memory.  