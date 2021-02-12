# Clean Up Fields

This script removes a specific field from all stories.

Name | Description | Author
------------ | ------------- | -------------
Clean Up Field | A tool to remove a specific field from all Stories | [Alexander Feiglstorfer](https://github.com/onefriendaday)


## How to use

Add a `oauth` token, a field name, a component name and the space id in the `clean-up-field.js`

```
// Insert your oauth token and folder id
const Storyblok = new StoryblokClient({
  oauthToken: 'YOUR_OAUTH_TOKEN'
})

const fieldToDelete = 'my_field'
const componentName = 'page'

// Insert your source space and folder id
const spaceId = 'YOUR_SPACE_ID'
```

Then run the script:

```
node clean-up-field.js
```