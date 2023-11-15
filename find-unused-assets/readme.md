# Find Unused Assets

This script can be used to get names of all unused assets in a Storyblok space. It gets all assests from all stories and runs individual requests for each asset and prints its name if it is not used in any story.

Name | Description | Author
------------ | ------------- | -------------
Find Unused Assets | A tool to find all unused assets in a space | [Bogdan Selenginskiy](https://github.com/bseleng)


## How to use

Run `npm i` to install and then `npm run start`. 

You'll have to provide a Personal Access Token from your account, the id of the target space and the number of the max simultaneous uploads. The default for the max simultaneous uploads is 20 but you can increase it slightly to make the upload faster if your computer and connection can handle it or you can decrease it if you want to use less bandwidth and memory.  