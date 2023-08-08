#!/usr/bin/env node
const glob = require('glob')
const fs = require('fs')
const myjson = require('myjson-api')
const compiler = require('vue/compiler-sfc')
const argv = require('yargs').argv

function replaceBetween (str, start, end, what) {
  return str.substring(0, start) + what + str.substring(end)
}

function readData (imported) {
  const data = JSON.parse(imported)
  Object.keys(data).forEach(file => {
    const sfcContent = fs.readFileSync(file).toString()
    const componentAst = compiler.parse(sfcContent)
    componentAst.descriptor.customBlocks
      .filter(block => block.type === 'i18n')
      .forEach(i18n => {
        console.log(`updating file ${file}`)
        fs.writeFileSync(
          file,
          replaceBetween(sfcContent, i18n.loc.start.offset, i18n.loc.end.offset, `\n${JSON.stringify(data[file], null, 2)}\n`)
        )
    })
  })
}

function createLocale (newLocale, extendedLocale) {
  const dir = argv.dir || 'src/'
  glob(`${dir}**/*.vue`, (_, files) => {
    const out = {}
    files.forEach(file => {
      const componentAst = compiler.parse(fs.readFileSync(file).toString())
      componentAst.descriptor.customBlocks
        .filter(block => block.type === 'i18n')
        .forEach(block => {
          let content = JSON.parse(block.content)
          Object.entries(content[extendedLocale]).forEach(([k, v]) => {
            if ( !content[newLocale][k] )
              content[newLocale][k] = v
          })
          out[file] = content
        })
    })
    readData(JSON.stringify(out))
    console.log(`Creating ${newLocale} language keys from ${extendedLocale}`)
  })
}

function runCreate() {
  process.stdin.setEncoding('utf8')

  let newLocale =  argv.new
  let extendedLocale = argv.extend
  createLocale(newLocale, extendedLocale)
}

function runImport () {
  process.stdin.setEncoding('utf8')

  let importData = ''
  process.stdin.on('readable', () => {
    const chunk = process.stdin.read()
    if (chunk !== null) {
      importData += chunk
    }
  })

  process.stdin.on('end', () => {
    readData(importData)
  })
}

function runExport (fn) {
  const dir = argv.dir || 'src/'
  glob(`${dir}**/*.vue`, (_, files) => {
    const out = {}
    files.forEach(file => {
      const componentAst = compiler.parse(fs.readFileSync(file).toString())
      componentAst.descriptor.customBlocks
        .filter(block => block.type === 'i18n')
        .forEach(block => {
          out[file] = JSON.parse(block.content)
        })
    })
    fn ? fn(out) : console.log(JSON.stringify(out, null, 2))
  })
}

switch (process.argv[2]) {
  case 'import':
    runImport()
    break
  case 'export':
    runExport()
    break
  case 'create':
    runCreate()
    break
  case 'translate':
    runExport((out) => {
      myjson.create(out)
      .then((response) => {
        console.log(`Open the following URL to start translation:`)
        console.log('')
        console.log(`   https://f.github.io/vue-i18n-translator/#${response.id}`)
      })
    })
    break
  default:
    console.log('vue3-i18n-service v' + require('../package.json').version)
    console.log('commands:')
    console.log('   vue3-i18n-service export > translations.json')
    console.log('     Collects all the <i18n> tags in SFC .vue files and exports them in a file\n')
    console.log('     Flags:')
    console.log('         --dir=src/ Specify the directory where SFCs are located, defaults to src/\n')
    console.log('   vue3-i18n-service import < translations.json')
    console.log('     Distributes all the changes on translations.json file to the related components\n')
    console.log('   vue3-i18n-service translate')
    console.log('     Opens translation page to translate your UI.\n')
}
