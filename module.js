#!/usr/bin/env node
const path = require('path')
const shell = require('shelljs')
const {log} = require('log-md')

function pullSource (branch) {
  // Throw away stderr
  const noStderr = '2> /dev/null'

  return `git pull origin --quiet ${branch} --depth 1 ${noStderr}`
}

function cloneRemote (outputDirectory, options) {
  const { owner, project, branch, assetPath } = options

  // An assetPath equal to the project name means
  // user is trying to download a GitHub project from root
  if (assetPath === project) {
    shell.mkdir('-p', path.join(outputDirectory, assetPath))
    shell.cd(path.join(outputDirectory, assetPath))
    shell.exec('git init --quiet')
    shell.exec(`git remote add origin https://github.com/${owner}/${project}`)

    const errorMessage =
      'No default branch found. Add the branch name to the URL and try again.'

    // User is in the project root directory, try cloning from `main`
    shell.exec(pullSource('main'))
    // Nothing added on `main`, try the old `master`
    const pullExit = shell.exec(`[ "$(ls -A .)" ] || ${pullSource('master')}`)
    // Nothing added. We need a branch so we exit with error
    const copyExit = shell.exec(`[ "$(ls -A .)" ] || echo ${errorMessage}`)
    shell.rm('-rf', '.git')

    if (pullExit.code !== 0) {
      log('Error when trying to pull git data', pullExit.stderr)
      process.exit(pullExit.code)
    } else if (copyExit.code !== 0) {
      log('Error when trying to copy git data', copyExit.stderr)
      process.exit(copyExit.code)
    } else {
      log('')
      log(`_Success_! \`${project}\` downloaded to \`${outputDirectory}\`.`)
    }
  } else {
    // Here is the actual magic. Usd sparse checkout to grab
    // contents of a specific folder
    const tempDownloadName = '.go-git-it-temp-folder'

    // Create a temp directory to add a git repo. This is needed
    // so we can have the right config when pulling data, as we only
    // want the specific folder path defined by user.
    shell.mkdir('-p', path.join(outputDirectory, tempDownloadName))
    shell.cd(path.join(outputDirectory, tempDownloadName))
    // Start git
    shell.exec('git init --quiet')
    // Add sparse checkout to git so we can download specific files only
    shell.exec(`git remote add origin https://github.com/${owner}/${project}`)
    shell.exec('git config core.sparsecheckout true')
    // Write to git the asset path user is trying to downnload
    shell.exec(`echo "${assetPath}" >> .git/info/sparse-checkout`)
    // Pull data
    const pullExit = shell.exec(`git pull origin --quiet ${branch} --depth 1`)
    // Copy assets to the final output directory
    shell.cp('-r', assetPath, outputDirectory)
    // Go back to root directory so we can delete the temp folder
    shell.cd('../')
    // Remove the temp folder
    shell.rm('-rf', path.join(outputDirectory, tempDownloadName))

    if (pullExit.code === 0) {
      log('')
      log(`_Success_! ${project} downloaded to \`${outputDirectory}\`.`)
    }
  }
}

function goGitIt (gitURL, outputDirectory = process.cwd()) {
  const repoData = new URL(gitURL).pathname
  const [owner, project] = repoData.split('/').slice(1, 3)
  const [branch] = repoData.split('/').slice(4)
  const assetPath = repoData.split('/').slice(5).join('/') || project

  const projectMetadata = `${owner}/${project}`
  const donwloadName = path.basename(assetPath)
  log(`\nDownloading \`${donwloadName}\` from \`@${projectMetadata}\`...`)

  const options = { owner, project, branch, assetPath }

  cloneRemote(outputDirectory, options)
}

if (require.main === module) {
  const args = process.argv

  // We need at least one argument to run
  if (args.length < 3) {
    log(`
      You need to provide a valid GitHub URL to start a download.
    `)
    process.exit()
  }

  if (args.length === 3) {
    goGitIt(args[args.length - 1])
    process.exit()
  }

  if (args.length === 4) {
    goGitIt(args[args.length - 2], args[args.length - 1])
    process.exit()
  }
}

module.exports = goGitIt
