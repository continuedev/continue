"use strict";
var child_process = require("child_process"),
    path     = require("path"),
    fs       = require("fs"),
    pkg      = require("./package.json"),
    util     = require("./util");

util.setup();

var minimist = require("minimist"),
    chalk    = require("chalk"),
    glob     = require("glob"),
    tmp      = require("tmp");

/**
 * Runs pbts programmatically.
 * @param {string[]} args Command line arguments
 * @param {function(?Error, string=)} [callback] Optional completion callback
 * @returns {number|undefined} Exit code, if known
 */
exports.main = function(args, callback) {
    var argv = minimist(args, {
        alias: {
            name: "n",
            out : "o",
            main: "m",
            global: "g",
            import: "i"
        },
        string: [ "name", "out", "global", "import" ],
        boolean: [ "comments", "main" ],
        default: {
            comments: true,
            main: false
        }
    });

    var files  = argv._;

    if (!files.length) {
        if (callback)
            callback(Error("usage")); // eslint-disable-line callback-return
        else
            process.stderr.write([
                "protobuf.js v" + pkg.version + " CLI for TypeScript",
                "",
                chalk.bold.white("Generates TypeScript definitions from annotated JavaScript files."),
                "",
                "  -o, --out       Saves to a file instead of writing to stdout.",
                "",
                "  -g, --global    Name of the global object in browser environments, if any.",
                "",
                "  -i, --import    Comma delimited list of imports. Local names will equal camelCase of the basename.",
                "",
                "  --no-comments   Does not output any JSDoc comments.",
                "",
                chalk.bold.gray("  Internal flags:"),
                "",
                "  -n, --name      Wraps everything in a module of the specified name.",
                "",
                "  -m, --main      Whether building the main library without any imports.",
                "",
                "usage: " + chalk.bold.green("pbts") + " [options] file1.js file2.js ..." + chalk.bold.gray("  (or)  ") + "other | " + chalk.bold.green("pbts") + " [options] -",
                ""
            ].join("\n"));
        return 1;
    }

    // Resolve glob expressions
    for (var i = 0; i < files.length;) {
        if (glob.hasMagic(files[i])) {
            var matches = glob.sync(files[i]);
            Array.prototype.splice.apply(files, [i, 1].concat(matches));
            i += matches.length;
        } else
            ++i;
    }

    var cleanup = [];

    // Read from stdin (to a temporary file)
    if (files.length === 1 && files[0] === "-") {
        var data = [];
        process.stdin.on("data", function(chunk) {
            data.push(chunk);
        });
        process.stdin.on("end", function() {
            files[0] = tmp.tmpNameSync() + ".js";
            fs.writeFileSync(files[0], Buffer.concat(data));
            cleanup.push(files[0]);
            callJsdoc();
        });

    // Load from disk
    } else {
        callJsdoc();
    }

    function callJsdoc() {

        // There is no proper API for jsdoc, so this executes the CLI and pipes the output
        var basedir = path.join(__dirname, ".");
        var moduleName = argv.name || "null";
        var nodePath = process.execPath;
        var cmd = "\"" + nodePath + "\" \"" + require.resolve("jsdoc/jsdoc.js") + "\" -c \"" + path.join(basedir, "lib", "tsd-jsdoc.json") + "\" -q \"module=" + encodeURIComponent(moduleName) + "&comments=" + Boolean(argv.comments) + "\" " + files.map(function(file) { return "\"" + file + "\""; }).join(" ");
        var child = child_process.exec(cmd, {
            cwd: process.cwd(),
            argv0: "node",
            stdio: "pipe",
            maxBuffer: 1 << 24 // 16mb
        });
        var out = [];
        var ended = false;
        var closed = false;
        child.stdout.on("data", function(data) {
            out.push(data);
        });
        child.stdout.on("end", function() {
            if (closed) finish();
            else ended = true;
        });
        child.stderr.pipe(process.stderr);
        child.on("close", function(code) {
            // clean up temporary files, no matter what
            try { cleanup.forEach(fs.unlinkSync); } catch(e) {/**/} cleanup = [];

            if (code) {
                out = out.join("").replace(/\s*JSDoc \d+\.\d+\.\d+ [^$]+/, "");
                process.stderr.write(out);
                var err = Error("code " + code);
                if (callback)
                    return callback(err);
                throw err;
            }

            if (ended) return finish();
            closed = true;
            return undefined;
        });

        function getImportName(importItem) {
            return path.basename(importItem, ".js").replace(/([-_~.+]\w)/g, function(match) {
                return match[1].toUpperCase();
            });
        }

        function finish() {
            var output = [];
            if (argv.main)
                output.push(
                    "// DO NOT EDIT! This is a generated file. Edit the JSDoc in src/*.js instead and run 'npm run types'.",
                    ""
                );
            if (argv.global)
                output.push(
                    "export as namespace " + argv.global + ";",
                    ""
                );

            if (!argv.main) {
                // Ensure we have a usable array of imports
                var importArray = typeof argv.import === "string" ? argv.import.split(",") : argv.import || [];

                // Build an object of imports and paths
                var imports = {
                    $protobuf: "protobufjs"
                };
                importArray.forEach(function(importItem) {
                    imports[getImportName(importItem)] = importItem;
                });

                // Write out the imports
                Object.keys(imports).forEach(function(key) {
                    output.push("import * as " + key + " from \"" + imports[key] + "\";");
                });
            }

            output = output.join("\n") + "\n" + out.join("");

            try {
                if (argv.out)
                    fs.writeFileSync(argv.out, output, { encoding: "utf8" });
                else if (!callback)
                    process.stdout.write(output, "utf8");
                return callback
                    ? callback(null, output)
                    : undefined;
            } catch (err) {
                if (callback)
                    return callback(err);
                throw err;
            }
        }
    }

    return undefined;
};
