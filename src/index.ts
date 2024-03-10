import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { normalize, parse, ParsedPath, sep, join } from 'node:path'
import { env } from 'node:process'

type FileData = {
  path: string
  parsed: ParsedPath
}

type Options = {
  directory: string
  overwriteIndex: boolean
  appendIndex: boolean
  randomPlacement: boolean
}

const CURRENT_DIRECTORY = '.'
const FILES_TO_IGNORE = new Set(['.DS_Store', 'furniture', 'index.js'])
const DIALOG_IDS_REGEX = /dialog\s?id="(.[^"]+)"/g
const FURNITURE_FOLDER = 'furniture'
const DEFAULT_OUTPUT_FILENAME = "index"
const MAX_RANDOM_HEIGHT = 1250;
const MAX_RANDOM_WIDTH = 2500;
const HTML_TITLE = "welcome to a place on my computer i've created just for you"
// Environment variables that can be set
// to configure folder party generation
const FOLDER_ENV_VAR = 'FOLDER'
const OVERWRITE_INDEX_ENV_VAR = 'OVERWRITE'
const APPEND_INDEX_ENV_VAR = 'APPEND'
const RANDOM_POSITION_ENV_VAR = 'RANDOM'

function getOptionsFromEnv(e: NodeJS.ProcessEnv): Options {
  const options: Options = {
    directory: CURRENT_DIRECTORY,
    overwriteIndex: false,
    appendIndex: false,
    randomPlacement: false,
  }
  const folderName: string | undefined = e[FOLDER_ENV_VAR]
  if (folderName && typeof folderName == "string") {
    options.directory = normalize(folderName)
  }

  const overwrite: string | undefined = e[OVERWRITE_INDEX_ENV_VAR]
  if (overwrite && typeof overwrite == "string") {
    options.overwriteIndex = overwrite === "0" ? false : true
  }

  const append: string | undefined = e[APPEND_INDEX_ENV_VAR]
  if (append && typeof append == "string") {
    options.appendIndex = append === "0" ? false : true
  }

  const random: string | undefined = e[RANDOM_POSITION_ENV_VAR]
  if (random && typeof random == "string") {
    options.appendIndex = append === "0" ? false : true
  }

  return options
}

function listFilesInDir(dir: string): string[] {
  return readdirSync(dir, { encoding: 'utf-8', recursive: true })
}

function readFileContent(path: string): string {
  return readFileSync(path, { encoding: 'utf-8' })
}

function parseFilesFromHtml(content: string): Set<string> {
  const existingFiles = new Set<string>()
  const idMatches = content.matchAll(DIALOG_IDS_REGEX)
  for (const match of idMatches) {
    const filenameInId = match[1]
    if (filenameInId && typeof filenameInId === "string") {
      existingFiles.add(filenameInId)
    }
  }

  return existingFiles
}

function getAppendIndex(content: string): number {
  // Append files before furniture if there's a furniture section
  const furnitureOpenTagIndex = content.indexOf('<section aria-label="furniture">')
  if (furnitureOpenTagIndex > 0) {
    return furnitureOpenTagIndex - 1
  }
  
  // Append files at the end of the body
  const bodyCloseTagIndex = content.indexOf('</body>')
  if (bodyCloseTagIndex > 0) {
    return bodyCloseTagIndex - 1
  }

  // Otherwise append files at the end of the document
  return content.length - 1
}

type TemplateInput = {
  files: FileData[]
  furniture: FileData[]
  randomPlacement?: boolean
  existingIndex?: FileData
  existingFiles?: Set<string>
  existingFileContent?: string
  appendToIndex?: number
}

function sortFilesIntoInput(files: FileData[], options: Options): TemplateInput {
  const input: TemplateInput = {
    files: [],
    furniture: [],
  }

  // If new files should be appended to the existing html file,
  // get the file contents and a list of files already included in it
  if (options.appendIndex) {
    try {
      const fullPath = join(options.directory, `${DEFAULT_OUTPUT_FILENAME}.html`)
      input.existingFileContent = readFileContent(fullPath)
      input.existingFiles = parseFilesFromHtml(input.existingFileContent)
      input.appendToIndex = getAppendIndex(input.existingFileContent)
    } catch (error) {
      console.warn("> > unable to append new files to existing index.html:", error)
      console.warn("> > creating new file instead of appending")
    }
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    // Skip file if it's ignored globally
    if (FILES_TO_IGNORE.has(file.parsed.name)) {
      continue
    }
    // Skip file if it's already been included in the existing html
    if (
      options.appendIndex &&
      input.existingFiles &&
      input.existingFiles.has(file.path)
    ) {
      continue
    }

    if (file.parsed.dir === FURNITURE_FOLDER) {
      input.furniture.push(file)
    } else if (file.path === `${DEFAULT_OUTPUT_FILENAME}.html`) {
      input.existingIndex = file
    } else {
      input.files.push(file)
    }
  }

  return input
}

function template(files: string[], options: Options): { content: string, templateInput: TemplateInput } {
  const data: FileData[] = files.map(f => ({ path: f, parsed: parse(f) }))
  const templateInput = sortFilesIntoInput(data, options)
  if (options.appendIndex) {
    const newFiles = templateInput.files.length
    console.log(`> > adding ${newFiles} file${newFiles === 1 ? '': 's'} to existing ${DEFAULT_OUTPUT_FILENAME}.html`)
  }
  return { templateInput, content: generateTemplate(templateInput) }
}

function websiteFilePath({
  directory,
  options,
}: {
  directory: string,
  options: Options
 }): string {
  let filename = DEFAULT_OUTPUT_FILENAME
  // Generate a unique filename if the option to overwrite the existing file
  // isn't explicitly set
  if (!options.overwriteIndex) {
    const pathSeparator = new RegExp(sep, "g")
    const spaces = new RegExp(/\s+/, "g")
    const now = new Date()
    const date = now.toLocaleDateString().replace(pathSeparator, ".").replace(spaces, "-")
    const time = now.toLocaleTimeString().replace(pathSeparator, ".").replace(spaces, "-")
    filename += `_${date}_${time}`
  }

  return `${directory}/${filename}.html`
}

(function main() {
  try {
    const options = getOptionsFromEnv(env)
    const { directory } = options
    console.log(`> > generating folder party from ${directory === CURRENT_DIRECTORY ? 
      "current directory": directory}`)
    const files = listFilesInDir(directory)
    console.log(`> > found ${files.length} files for folder party`)
    const { content } = template(files, options)
    const filePath = websiteFilePath({ directory, options })
    writeFileSync(filePath, content, { encoding: 'utf-8' })
    console.log(`> > creating folder party website file: ${filePath}`)
  } catch (err) {
    console.error("folder party creation failed:", err)
    process.exit(1)
  }
})()

// Template logic * ~ * ~ *
function generateTemplate(input: TemplateInput): string {
  // If there's an index to append new content to,
  // do that instead of generating a new html document
  if (typeof input.appendToIndex === "number") {
    const beforeNewContent = input.existingFileContent.slice(0, input.appendToIndex + 1)
    const afterNewContent = input.existingFileContent.slice(input.appendToIndex + 1)
    const newContent = input.files.map((f) => createButtonDialogPair(f, { randomPlacement: input.randomPlacement })).join("\n") + "\n      "
    return beforeNewContent + newContent + afterNewContent
  }

  return createHtmlDocument(input)
}

function createHtmlDocument(input: TemplateInput): string {
  return `<!DOCTYPE html>
<html lang="en">
${createHead()}
${createBody(input)}
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
      html {
        background-color: #d2d2d2;
      }

      /* Styles for draggable elements */

      /* display inline-block so that elements are
      positioned absolutely next to each other when
      the document loads EXCEPT for dialog elements
      which manage their own display + visibility */
      [data-draggable]:not(dialog) {
        display: inline-block;
      }

      [data-draggable] {
        user-select: none;
        margin: 0;
        padding: 1rem;
      }

      [data-draggable]:hover {
        cursor: move;
      }

      /* Styles for filenames */
      button.filename {
        background-color: #d2d2d2;
        border: none;
        border-radius: 8px;
        box-shadow: 5px 5px 5px rgb(51, 51, 51, 0.75);
        color: blue;
        font-family: 'Times New Roman', Times, serif;
        font-size: 1rem;
        max-width: 250px;
        padding: 5px;
        overflow-wrap: anywhere;
        text-align: center;
        text-decoration: underline;
        width: max-content;
      }

      button.filename:focus {
        background-color: purple;
        color: white;
        outline: none;
        text-decoration: none;
      }

      button.close-fileviewer {
        background-color: unset;
        border: none;
        color: #333333;
        font-family: monospace;
        float: right;
        margin: 0.5rem -0.5rem -0.5rem 0.5rem;
        text-transform: uppercase;
      }

      /* Styles for dialogs and dialog buttons */
      dialog.fileviewer[open] {
        background-color: #dfdfdf;
        box-shadow: 5px 5px 5px rgb(51, 51, 51, 0.75);
        border-radius: 8px;
        border: 2px dotted #333333;
        /* Needed to size dialogs in Firefox to fit their content */
        width: max-content;
        z-index: 2;
      }

      button.close-fileviewer:active,
      button.close-fileviewer:focus {
        background-color: purple;
        border-radius: 5px;
        color: white;
        outline: none;
      }

      /* Styles for embedded media */
      /* Note: the *-text classes are useful for content
      that browsers won't expand to fit the max sizes,
      like text and html */
      object {
        /* Set a global max size so content
        isn't TOO big */
        max-width: 600px;
        max-height: 600px;
      }

      object.tiny {
        max-height: 60px;
        max-width: 175px;
      }

      object.tiny-text {
        height: 60px;
        width: 175px;
      }

      object.small {
        max-height: 250px;
        max-width: 150px;
      }

      object.small-text {
        height: 100px;
        width: 150px;
      }

      object.medium {
        max-height: 300px;
        max-width: 400px;
      }

      object.medium-text {
        height: 300px;
        width: 400px;
      }

      object.large {
        max-width: 500px;
        max-height: 500px;
      }

      object.large-text {
        width: 500px;
        height: 500px;
      }

      /* Styles for furniture */
      section[aria-label="furniture"] > img {
        z-index: -1;
      }
    </style>`
}

function createScript(): string {
  return `
    <script>
      function positionInPlace(element) {
        const { top, left } = element.getBoundingClientRect()
        const { scrollX, scrollY } = window
        setTopLeft(element, top + scrollY, left + scrollX)
      }

      function setTopLeft(element, top, left) {
        element.style.setProperty("top", top + "px")
        element.style.setProperty("left", left + "px")
      }

      function setPositionAbsolute(element) {
        element.style.setProperty("position", "absolute")
      }

      const MOUSE_BUTTON_MAIN = 0
      function moveOnMouseDown(event) {
        // Use the currentTarget for calculating position, because it's the
        // element that has the "data-draggable" property on it. The target
        // may be another element inside of it.
        const { currentTarget, pageX, pageY, clientX, clientY, button } = event
        // Don't continue if the main mouse button (left click) is not used;
        // this prevents funny behavior on right or middle click
        if (button !== undefined && button !== MOUSE_BUTTON_MAIN) {
          return
        }
        const { left, top } = currentTarget.getBoundingClientRect()
        const shiftX = clientX - left
        const shiftY = clientY - top

        function moveTo(pageX, pageY) {
          const newLeft = pageX - shiftX + "px"
          const newTop = pageY - shiftY + "px"
          currentTarget.style.setProperty("left", newLeft)
          currentTarget.style.setProperty("top", newTop)
        }

        function onMouseMove(event) {
          moveTo(event.pageX, event.pageY)
        }

        function onMouseUp(event) {
          document.removeEventListener("mousemove", onMouseMove)
          document.removeEventListener("mouseup", onMouseUp)
        }

        document.addEventListener("mousemove", onMouseMove)
        document.addEventListener("mouseup", onMouseUp)
      }

      // To distinguish between moving an element and clicking an element,
      // this handler is triggered by the "mousedown" instead of "click" event,
      // so it can listen for "mousemove" events and ignore them.
      function openViewerOnMouseDown(event) {
        // Don't continue if the main mouse button (left click) is not used;
        // this prevents funny behavior on right or middle click
        if (event.button !== undefined && event.button !== MOUSE_BUTTON_MAIN) {
          return
        }

        let elementHasMoved = false
        function onMouseMove(event) {
          elementHasMoved = true
        }

        function onMouseUp(event) {
          if (elementHasMoved !== true) {
            onClick(event)
          }
          document.removeEventListener("mousemove", onMouseMove)
          document.removeEventListener("mouseup", onMouseUp)
        }

        document.addEventListener("mousemove", onMouseMove)
        document.addEventListener("mouseup", onMouseUp)
      }

      // Because click events are handled through the "mousedown" trigger,
      // the default button behavior of space and enter keys triggering a
      // click need to be added manually
      function openViewerOnKeyPress(event) {
        if (event.code === 'Enter' || event.code === 'Space') {
          onClick(event)
        }
      }

      function onClick(event) {
        const dialogId = event.target.getAttribute("aria-controls")
        if (!dialogId) {
          return
        }
        const dialog = document.getElementById(dialogId)
        if (!dialog) {
          return
        }
        if (dialog.open === false) {
          const { top, left, height, width } = event.target.getBoundingClientRect()
          const { scrollX, scrollY } = window
          setTopLeft(dialog, top + height + scrollY + 10, left + scrollX)
          setPositionAbsolute(dialog)
          dialog.show()
        }
      }

      document.addEventListener("DOMContentLoaded", (_event) => {
        // Add drag-to-move functionality
        const draggable = document.querySelectorAll("[data-draggable]")
        draggable.forEach((ele) => ele.addEventListener("mousedown", moveOnMouseDown))
        
        // Add file viewer functionality to draggable elements
        const fileViewers = document.querySelectorAll("[data-fileviewer][data-draggable]")
        fileViewers.forEach((ele) => {
          ele.addEventListener("mousedown", openViewerOnMouseDown)
          ele.addEventListener("keypress", openViewerOnKeyPress)
        })

        // Add file viewer functionality to non-draggable elements;
        // this is done separately from draggable elements, since there's
        // extra logic to _not_ open the file viewer when the element is dragged
        const staticFileViewers = document.querySelectorAll("[data-fileviewer]:not([data-draggable])")
        staticFileViewers.forEach((ele) => ele.addEventListener("click", onClick))
      })

      // The following code needs to wait for all resources (especially images) to
      // be loaded on the page to position them propertly; if a resource isn't loaded,
      // it can't be positioned on the page with its height and width.
      //
      // This code is *only* needed if each draggable item doesn't already have a
      // "top", "left", and "position: absolute" set in its inline style, like:
      // \`style="top: 575px; left: 413px; position: absolute;"\`.
      //
      // If each draggable element on the page already has an inline position,
      // it can be removed.
      window.addEventListener("load", (_event) => {
        const draggable = document.querySelectorAll("[data-draggable]")
        // Position each element absolutely so document flow isn't changed
        // when one element is moved
        draggable.forEach(positionInPlace)
        draggable.forEach(setPositionAbsolute)
      })
    </script>`
}

type FileOptions = Pick<TemplateInput, "randomPlacement">

function createBody(input: TemplateInput): string {
  return `
  <body>
    <main>${input.files.map((f) => createButtonDialogPair(f, { randomPlacement: input.randomPlacement })).join("\n")}
      ${createFurniture(input.furniture, { randomPlacement: input.randomPlacement })}
    </main>
  </body>`
}

function createButtonDialogPair(file: FileData, options: FileOptions): string {
  return `
      ${createButton(file, options)}
      ${createDialog(file)}`
}

function isFolder(file: FileData) {
  return file.parsed.ext === ""
}

function displayName(file: FileData) {
  return isFolder(file) ? `${file.path}/` : file.path
}

function createButton(file: FileData, options?: FileOptions): string {
  return `<button
        class="filename"
        aria-haspopup="dialog"
        aria-controls="${file.path}"${ options?.randomPlacement ? `
        style="position: absolute; top: ${randomInt(0, MAX_RANDOM_HEIGHT)}px; left: ${randomInt(0, MAX_RANDOM_WIDTH)}px;"` : "" }
        data-fileviewer
        data-draggable>
        ${displayName(file)}
      </button>`
}

function createDialog(file: FileData): string {
  const dialogContent = isFolder(file) ? `<pre>${displayName(file)} folder</pre>` :  `<object class="file" data="${file.path}" draggable="false"></object>`
  return `<dialog id="${file.path}" class="fileviewer" data-draggable>
        ${dialogContent}
        <form method="dialog"><button class="close-fileviewer">close</button></form>
      </dialog>`
}

function createFurniture(furniture: FileData[], options?: FileOptions) {
  return `<section aria-label="furniture">
        ${furniture.map(item => {
          return `<img src="${item.path}" ${options?.randomPlacement ? `style="position: absolute; top: ${randomInt(0, MAX_RANDOM_HEIGHT)}px; left: ${randomInt(0, MAX_RANDOM_WIDTH)}px;"` : ""} draggable="false" data-draggable />`
        }).join("\n        ")}
      </section>`
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function randomInt(min: number, max: number): number {
  return Math.round(Math.random() * (max - min) + min)
}
