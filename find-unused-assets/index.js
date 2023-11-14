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
    name: 'target_space_id',
    message: "Please enter the Target Space Id",
  },
  {
    type: 'input',
    name: 'simultaneous_uploads',
    message: "Simultaneous Uploads",
    default: 20
  },
  {
    type: 'input',
    name: 'region',
    message: "Please enter the Region code. Leave empty for default EU region",
    default: null
  },
]

inquirer.prompt(questions).then((answers) => {
  const migration = new Migration(answers.oauth, answers.target_space_id, answers.simultaneous_uploads, answers.region)
  migration.start()
})
