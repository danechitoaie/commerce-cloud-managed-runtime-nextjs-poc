const next = require("next");
const express = require("express");
const aws = require("aws-serverless-express");
// const compression = require("compression");
const path = require("path");

module.exports.get = (event, context) => {
    const nextApp = next({
        dev: false,
        dir: path.resolve(__dirname),
        conf: { compress: false },
        customServer: true,
        // minimalMode: true,
    });

    const handle = nextApp.getRequestHandler();

    nextApp.prepare().then(() => {
        const expressApp = express();
        // expressApp.use(compression());
        // expressApp.use("/_next/static", express.static(path.join(__dirname, ".next", "static")));
        expressApp.all("*", (req, res) => {
            return handle(req, res);
        });

        const server = aws.createServer(expressApp);
        aws.proxy(server, event, context);
    });
};
