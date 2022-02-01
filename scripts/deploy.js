const path = require("path");
const fs = require("fs-extra");
const task = require("tasuku");
const yargs = require("yargs");
const fetch = require("cross-fetch");
const rimraf = require("rimraf");
const tar = require("tar");
const globby = require("globby");
const shellExec = require("shell-exec");

async function run() {
    await task("Deleting [dist] folder...", async () => {
        rimraf.sync("dist");
    });

    await task("Creating [dist/build] folder...", async () => {
        await fs.mkdir(path.resolve(__dirname, "..", "dist"));
        await fs.mkdir(path.resolve(__dirname, "..", "dist", "build"));
    });

    await task("Creating [loader.js]...", async () => {
        const file = path.resolve(__dirname, "..", "dist", "build", "loader.js");
        await fs.writeFile(file, "/* ¯\\_(ツ)_/¯ */\n");
    });

    await task("Copying files...", async () => {
        await fs.copy(path.resolve(__dirname, "..", ".next"), path.resolve(__dirname, "..", "dist", "build", ".next"));
        await fs.copy(path.resolve(__dirname, "..", "pages"), path.resolve(__dirname, "..", "dist", "build", "pages"));
        await fs.copy(path.resolve(__dirname, "..", "public"), path.resolve(__dirname, "..", "dist", "build", "public"));
        await fs.copy(path.resolve(__dirname, "..", "styles"), path.resolve(__dirname, "..", "dist", "build", "styles"));
        await fs.copy(path.resolve(__dirname, "..", "package.json"), path.resolve(__dirname, "..", "dist", "build", "package.json"));
        await fs.copy(path.resolve(__dirname, "..", "package-lock.json"), path.resolve(__dirname, "..", "dist", "build", "package-lock.json"));
        await fs.copy(path.resolve(__dirname, "..", "ssr.js"), path.resolve(__dirname, "..", "dist", "build", "ssr.js"));
        await fs.copy(path.resolve(__dirname, "..", "tsconfig.json"), path.resolve(__dirname, "..", "dist", "build", "tsconfig.json"));
    });

    await task("Running [npm install --production]...", async () => {
        await shellExec("npm install --production", {
            cwd: path.resolve(__dirname, "..", "dist", "build"),
        });
    });

    await task("Creating [dist/build.tar]...", async () => {
        const pkg = require("../package.json");
        const file = path.resolve(__dirname, "..", "dist", "build.tar");
        const prefix = `${pkg.name}/bld`;
        const cwd = path.resolve(__dirname, "..", "dist", "build");

        const fileList = await globby(["**/*", "!node_modules/.bin/**/*"], { cwd, dot: true });
        await tar.create({ file, prefix, cwd }, fileList);
    });

    await task("Deploying build...", async ({ setOutput, setError }) => {
        const file = path.resolve(__dirname, "..", "dist", "build.tar");
        if (!fs.existsSync(file)) {
            setError(`${file} does not exist! Please make sure you run "npm run build" first!`);
            return;
        }

        await new Promise((resolve, reject) => {
            yargs
                .usage("Usage: $0 [options]")
                .option("username", { type: "string", description: "Username", demandOption: true })
                .option("apiKey", { type: "string", description: "API Key", demandOption: true })
                .option("message", { type: "string", description: "Message", demandOption: true })
                .help()
                .parse(process.argv, async (yargsErr, argv, output) => {
                    if (yargsErr) {
                        reject(yargsErr);
                        return;
                    }

                    if (output) {
                        reject(output);
                        return;
                    }

                    const pkg = require("../package.json");
                    const url = `https://cloud.mobify.com/api/projects/${encodeURIComponent(pkg.name)}/builds/`;

                    const { username, apiKey } = argv;

                    const data = await fs.promises.readFile(file);
                    const b64Data = data.toString("base64");

                    const cwd = path.resolve(__dirname, "..", "dist", "build");
                    const ssrOnlyFileList = await globby(["**/*", "!node_modules/.bin/**/*"], { cwd, dot: true });

                    const body = JSON.stringify({
                        message: argv.message,
                        encoding: "base64",
                        data: b64Data,
                        ssr_parameters: { ssrFunctionNodeVersion: pkg.commerceCloudRuntime.ssrFunctionNodeVersion },
                        ssr_only: ssrOnlyFileList,
                        ssr_shared: [],
                    });

                    try {
                        const res = await fetch(url, {
                            method: "POST",
                            headers: {
                                authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}`,
                                "content-type": "application/json",
                                "content-length": body.length.toString(),
                                "user-agent": "progressive-web-sdk#0.3.46",
                            },
                            body,
                        });

                        if (res.status === 401) {
                            const message = await res.text();
                            reject(message);
                            return;
                        }

                        const { message } = await res.json();

                        if (res.ok) {
                            resolve(message);
                        } else {
                            reject(message);
                        }
                    } catch (fetchErr) {
                        reject(fetchErr);
                    }
                });
        })
            .then((output) => {
                setOutput(output);
            })
            .catch((output) => {
                setError(output);
            });
    });
}

run();
