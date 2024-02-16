import { readdirSync, writeFileSync } from 'node:fs'
import { normalize, parse, ParsedPath } from 'node:path'
import { env } from 'node:process'

type FileData = {
  path: string
  parsed: ParsedPath
}

const CURRENT_DIRECTORY = '.'
const FOLDER_ENV_VAR = 'PARTY_FOLDER'
const FILES_TO_IGNORE = new Set(['.DS_Store'])
const HTML_TITLE = "welcome to a place on my computer i've created just for you"

function getDirFromEnv(e: NodeJS.ProcessEnv): string {
  const folderName: string | undefined = e[FOLDER_ENV_VAR]
  if (folderName && typeof folderName == "string") {
    return normalize(folderName)
  }

  return CURRENT_DIRECTORY
}

function listFilesInDir(dir: string): string[] {
  const files = readdirSync(dir, { encoding: 'utf-8', recursive: true })
  return filterIgnoredFiles(files)
}

function filterIgnoredFiles(filenames: string[]): string[] {
  return filenames.filter(fn => !FILES_TO_IGNORE.has(fn))
}

function template(files: string[]): string {
  const data: FileData[] = files.map(f => ({ path: f, parsed: parse(f) }))
  return generateTemplate(data)
}

(function main() {
  try {
    const directory = getDirFromEnv(env)
    console.log(`> > generating folder party from ${directory === CURRENT_DIRECTORY ? 
      "current directory": directory}`)
    const files = listFilesInDir(directory)
    console.log(`> > found ${files.length} files to add to folder party`)
    // TODO: make sure not to overwrite files or get confirmation?
    writeFileSync(`${directory}/index.html`, template(files), { encoding: 'utf-8' })
  } catch (err) {
    console.error("folder party creation failed:", err)
    process.exit(1)
  }
})()

// Template logic * ~ * ~ *
function generateTemplate(data: FileData[]): string {
  return createHtmlDocument(data)
}

function createHtmlDocument(data: FileData[]): string {
  return `<!DOCTYPE html>
<html lang="en">
${createHead()}
${createBody(data)}
</html>`
}

function createHead(): string {
  return `  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${HTML_TITLE}</title>
${createStyle()}
${createScript()}
  </head>`
}

// Styles (plus, specific styles for each media content)
function createStyle(): string {
  return `
    <style>
      html { background-color: pink; }
    </style>`
}

function createScript(): string {
  return `
    <script>console.log("TODO")</script>`
}

function createBody(data: FileData[]): string {
  return `
  <body>
    <main>${data.map((file) => {
        return `
      ${createButton(file)}
      ${createDialog(file)}`
      }).join("\n")}
      ${createFurniture()}
    </main>
  </body>`
}

function createButton(file: FileData): string {
  return `<button
        class="filename"
        aria-haspopup="dialog"
        aria-controls="${file.path}"
        data-fileviewer
        data-draggable>
        ${file.path}
      </button>`
    }

function createDialog(file: FileData): string {
  return `<dialog id="${file.path}" class="fileviewer" data-draggable>
        <object class="file" data="${file.path}"></object>
      </dialog>`
}

function createFurniture() {
  return `<p>TODO: furniture</p>`
}

// Button properties?

// Nice-to-haves:
// furniture folder
// party-config.json
// custom.css detection + insertion
