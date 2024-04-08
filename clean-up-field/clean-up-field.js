const StoryblokClient = require('storyblok-js-client')

// Insert your oauth token and folder id
const Storyblok = new StoryblokClient({
  oauthToken: 'YOUR_OAUTH_TOKEN'
})

const fieldToDelete = 'my_field'
const componentName = 'page'

// Insert your source space and folder id
const spaceId = 'YOUR_SPACE_ID'

const StoryblokHelper = {
  getAll(page) {
    return Storyblok.get('spaces/' + spaceId + '/stories', {
      per_page: 25,
      page: page,
      contain_component: componentName
    })
  },
  cleanUp(tree) {
    var traverse = function (jtree) {
      if (jtree.constructor === Array) {
        for (var item = 0; item < jtree.length; item++) {
          traverse(jtree[item])
        }
      } else if (jtree.constructor === Object) {
        if (jtree[fieldToDelete]) {
          delete jtree[fieldToDelete]
        }

        for (var treeItem in jtree) {
          traverse(jtree[treeItem])
        }
      }
    }

    traverse(tree)
    return tree
  }
}

async function getAllStories(){
  var page = 1
  var res = await StoryblokHelper.getAll(page)
  var all = res.data.stories
  var lastPage = Math.ceil((res.total / 25))

  while (page < lastPage){
    page++
    res = await StoryblokHelper.getAll(page)
    res.data.stories.forEach((story) => {
      all.push(story)
    })
  }

  for (var i = 0; i < all.length; i++) {
    console.log('Updating: ' + all[i].name)

    try {
      let storyResult = await Storyblok.get('spaces/' + spaceId + '/stories/' + all[i].id)
      await Storyblok.put('spaces/' + spaceId + '/stories/' + all[i].id, {
        story: {content: StoryblokHelper.cleanUp(storyResult.data.story.content)}
      })
    } catch(e) {
      console.log(e)
    }
  }

  return all
}

getAllStories().then(() => {
  console.log('Finished')
})