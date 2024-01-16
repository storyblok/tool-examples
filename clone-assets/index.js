import Migration from './src/index.js'
import inquirer from 'inquirer'

const questions = [
  {
    type: 'input',
    name: 'oauth',
    message: "Please enter your Personal Access Token (get one at http://app.storyblok.com/#!/me/account)",
  },
  {
    type: 'input',
    name: 'sourceSpaceId',
    message: "Please enter the Source Space Id",
  },
  {
    type: 'input',
    name: 'targetSpaceId',
    message: "Please enter the Target Space Id",
  },
  {
    type: 'input',
    name: 'simultaneousUploads',
    message: "Simultaneous Uploads",
    default: 20
  },
  {
    type: 'input',
    name: 'region',
    message: "Please enter the Region code for the source space. Leave empty for default UE region",
    default: null
  },
  {
    type: 'input',
    name: 'targetRegion',
    message: "Please enter the Region code for the target space. Leave empty for default UE region",
    default: null
  },
]

inquirer.prompt(questions).then((answers) => {
  const migration = new Migration(answers.oauth, answers.sourceSpaceId, answers.targetSpaceId, answers.simultaneousUploads, answers.region, answers.targetRegion)
  migration.start()
})
