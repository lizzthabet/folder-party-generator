"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// This code and approach has been generously borrowed from:
// https://dev.to/adamcoster/create-a-live-reload-server-for-front-end-development-3gnp
// and tweaked with Typescript
const http_1 = require("http");
const fs_1 = require("fs");
const path_1 = require("path");
const ws_1 = require("ws");
// Customize the port you want your server to run on
const HTTP_PORT = process.env.PORT || 6700;
// Customize the port the websocket connection uses
// Note: update it both here and `client-websocket.ts`
const WEBSOCKET_PORT = 6800;
const CLIENT_WEBSOCKET_CODE = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'client-websocket.js'), 'utf8');
// Most static sites have a `public` folder with everything in it.
// Customize this if it's a different folder.
const SERVE_CONTENT_FROM = process.env.FOLDER || "public";
// Websocket server (for allowing browser and dev server to have 2-way communication)
// We don't even need to do anything except create the instance!
new ws_1.Server({ port: WEBSOCKET_PORT });
function parseFilenameIfExists(route) {
    const noExtension = (0, path_1.extname)(route) === '';
    const fileExists = (0, fs_1.existsSync)(route);
    if (fileExists) {
        const fileStat = (0, fs_1.statSync)(route);
        // If the requested file is a directory, assume there's an index page to serve
        if (fileStat.isDirectory()) {
            return (0, path_1.join)(route, 'index.html');
        }
        else if (fileStat.isFile()) {
            return route;
        }
    }
    // If there's no extension and file doesn't exist, let's try parsing the route
    // as an html file and serve it if it's present
    if (!fileExists && noExtension) {
        const htmlFilePath = `${route}.html`;
        if ((0, fs_1.existsSync)(htmlFilePath)) {
            return htmlFilePath;
        }
    }
    return null;
}
// Get the file content and if it exists, inject the websocket snippet
function getFileIfExists(route) {
    // We don't care about performance for our dev server, so sync functions are fine.
    // If the route exists it's either the exact file we want or the path to a directory
    // in which case we'd serve up the 'index.html' file.
    const filepath = parseFilenameIfExists(route);
    if (filepath) {
        const file = (0, fs_1.readFileSync)(filepath);
        if ((0, path_1.extname)(filepath) === ".html") {
            // Inject the client-side websocket code by adding the script to the end;
            // browsers allow for tons of deviation from *technically correct* HTML.
            const fileWithReloadScript = `${file.toString()}\n\n<script>${CLIENT_WEBSOCKET_CODE}</script>`;
            return Buffer.from(fileWithReloadScript);
        }
        return file;
    }
    return null;
}
// Add headers for specific media types that browsers are picky about
function getHeadersForRoute(route) {
    const headers = {};
    if ((0, path_1.extname)(route) === ".svg") {
        headers["Content-Type"] = "image/svg+xml";
    }
    return headers;
}
/** General request handler and router */
const requestHandler = function (req, res) {
    console.log(`> > request for ${req.url}`);
    const method = req.method.toLowerCase();
    if (method === 'get') {
        // No need to ensure the route can't access other local files,
        // since this is for development only.
        const url = new URL(req.url, `http://${req.headers.host}`);
        const route = (0, path_1.normalize)((0, path_1.join)(__dirname, SERVE_CONTENT_FROM, decodeURI(url.pathname)));
        const staticFile = getFileIfExists(route);
        if (staticFile !== null) {
            const headers = getHeadersForRoute(route);
            res.writeHead(200, headers);
            res.end(staticFile);
            return;
        }
    }
    res.writeHead(404);
    res.end();
    return;
};
const server = (0, http_1.createServer)(requestHandler);
server.listen(HTTP_PORT);
console.log(`Server listening port ${HTTP_PORT}...`);
//# sourceMappingURL=dev-server.js.map