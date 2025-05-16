/* eslint-disable indent, no-process-exit */
/**
 * Helper methods for running JSDoc on the command line.
 *
 * A few critical notes for anyone who works on this module:
 *
 * + The module should really export an instance of `cli`, and `props` should be properties of a
 * `cli` instance.
 *
 * @private
 */
module.exports = (() => {
    const app = require('jsdoc/app');
    const env = require('jsdoc/env');
    const logger = require('jsdoc/util/logger');
    const stripBom = require('jsdoc/util/stripbom');
    const stripJsonComments = require('strip-json-comments');
    const Promise = require('bluebird');

    const props = {
        docs: [],
        packageJson: null,
        shouldExitWithError: false,
        tmpdir: null
    };

    const FATAL_ERROR_MESSAGE = 'Exiting JSDoc because an error occurred. See the previous log ' +
        'messages for details.';
    const cli = {};

    // TODO: docs
    cli.setVersionInfo = () => {
        const fs = require('fs');
        const path = require('path');

        // allow this to throw--something is really wrong if we can't read our own package file
        const info = JSON.parse( stripBom.strip(fs.readFileSync(path.join(env.dirname, 'package.json'),
            'utf8')) );

        env.version = {
            number: info.version,
            revision: new Date( parseInt(info.revision, 10) ).toUTCString()
        };

        return cli;
    };

    // TODO: docs
    cli.loadConfig = () => {
        const _ = require('underscore');
        const args = require('jsdoc/opts/args');
        const Config = require('jsdoc/config');
        let config;
        const fs = require('jsdoc/fs');
        const path = require('jsdoc/path');

        let confPath;
        let isFile;

        const defaultOpts = {
            destination: './out/',
            encoding: 'utf8'
        };

        try {
            env.opts = args.parse(env.args);
        }
        catch (e) {
            console.error(`${e.message}\n`);
            cli.printHelp().then(() => {
                cli.exit(1);
            });
        }

        confPath = env.opts.configure || path.join(env.dirname, 'conf.json');
        try {
            isFile = fs.statSync(confPath).isFile();
        }
        catch (e) {
            isFile = false;
        }

        if ( !isFile && !env.opts.configure ) {
            confPath = path.join(env.dirname, 'conf.json.EXAMPLE');
        }

        try {
            switch ( path.extname(confPath) ) {
                case '.js':
                    config = require( path.resolve(confPath) ) || {};
                    break;
                case '.json':
                case '.EXAMPLE':
                default:
                    config = fs.readFileSync(confPath, 'utf8');
                    break;
            }
            env.conf = new Config(config).get();
        }
        catch (e) {
            cli.exit(1, `Cannot parse the config file ${confPath}: ${e}\n${FATAL_ERROR_MESSAGE}`);
        }

        // look for options on the command line, in the config file, and in the defaults, in that order
        env.opts = _.defaults(env.opts, env.conf.opts, defaultOpts);

        return cli;
    };

    // TODO: docs
    cli.configureLogger = () => {
        function recoverableError() {
            props.shouldExitWithError = true;
        }

        function fatalError() {
            cli.exit(1);
        }

        if (env.opts.debug) {
            logger.setLevel(logger.LEVELS.DEBUG);
        }
        else if (env.opts.verbose) {
            logger.setLevel(logger.LEVELS.INFO);
        }

        if (env.opts.pedantic) {
            logger.once('logger:warn', recoverableError);
            logger.once('logger:error', fatalError);
        }
        else {
            logger.once('logger:error', recoverableError);
        }

        logger.once('logger:fatal', fatalError);

        return cli;
    };

    // TODO: docs
    cli.logStart = () => {
        logger.debug( cli.getVersion() );

        logger.debug('Environment info: %j', {
            env: {
                conf: env.conf,
                opts: env.opts
            }
        });
    };

    // TODO: docs
    cli.logFinish = () => {
        let delta;
        let deltaSeconds;

        if (env.run.finish && env.run.start) {
            delta = env.run.finish.getTime() - env.run.start.getTime();
        }

        if (delta !== undefined) {
            deltaSeconds = (delta / 1000).toFixed(2);
            logger.info('Finished running in %s seconds.', deltaSeconds);
        }
    };

    // TODO: docs
    cli.runCommand = cb => {
        let cmd;

        const opts = env.opts;

        if (opts.help) {
            cmd = cli.printHelp;
        }
        else if (opts.test) {
            cmd = cli.runTests;
        }
        else if (opts.version) {
            cmd = cli.printVersion;
        }
        else {
            cmd = cli.main;
        }

        cmd().then(errorCode => {
            if (!errorCode && props.shouldExitWithError) {
                errorCode = 1;
            }
            cb(errorCode);
        });
    };

    // TODO: docs
    cli.printHelp = () => {
        cli.printVersion();
        console.log( `\n${require('jsdoc/opts/args').help()}\n` );
        console.log('Visit https://jsdoc.app/ for more information.');

        return Promise.resolve(0);
    };

    // TODO: docs
    cli.runTests = () => {
        const path = require('jsdoc/path');

        const runner = Promise.promisify(require( path.join(env.dirname, 'test/runner') ));

        console.log('Running tests...');

        return runner();
    };

    // TODO: docs
    cli.getVersion = () => `JSDoc ${env.version.number} (${env.version.revision})`;

    // TODO: docs
    cli.printVersion = () => {
        console.log( cli.getVersion() );

        return Promise.resolve(0);
    };

    // TODO: docs
    cli.main = () => {
        cli.scanFiles();

        if (env.sourceFiles.length === 0) {
            console.log('There are no input files to process.');

            return Promise.resolve(0);
        } else {
            return cli.createParser()
                .parseFiles()
                .processParseResults()
                .then(() => {
                    env.run.finish = new Date();

                    return 0;
                });
        }
    };

    function readPackageJson(filepath) {
        const fs = require('jsdoc/fs');

        try {
            return stripJsonComments( fs.readFileSync(filepath, 'utf8') );
        }
        catch (e) {
            logger.error('Unable to read the package file "%s"', filepath);

            return null;
        }
    }

    function buildSourceList() {
        const Readme = require('jsdoc/readme');

        let packageJson;
        let readmeHtml;
        let sourceFile;
        let sourceFiles = env.opts._ ? env.opts._.slice(0) : [];

        if (env.conf.source && env.conf.source.include) {
            sourceFiles = sourceFiles.concat(env.conf.source.include);
        }

        // load the user-specified package/README files, if any
        if (env.opts.package) {
            packageJson = readPackageJson(env.opts.package);
        }
        if (env.opts.readme) {
            readmeHtml = new Readme(env.opts.readme).html;
        }

        // source files named `package.json` or `README.md` get special treatment, unless the user
        // explicitly specified a package and/or README file
        for (let i = 0, l = sourceFiles.length; i < l; i++) {
            sourceFile = sourceFiles[i];

            if ( !env.opts.package && /\bpackage\.json$/i.test(sourceFile) ) {
                packageJson = readPackageJson(sourceFile);
                sourceFiles.splice(i--, 1);
            }

            if ( !env.opts.readme && /(\bREADME|\.md)$/i.test(sourceFile) ) {
                readmeHtml = new Readme(sourceFile).html;
                sourceFiles.splice(i--, 1);
            }
        }

        props.packageJson = packageJson;
        env.opts.readme = readmeHtml;

        return sourceFiles;
    }

    // TODO: docs
    cli.scanFiles = () => {
        const Filter = require('jsdoc/src/filter').Filter;

        let filter;

        env.opts._ = buildSourceList();

        // are there any files to scan and parse?
        if (env.conf.source && env.opts._.length) {
            filter = new Filter(env.conf.source);

            env.sourceFiles = app.jsdoc.scanner.scan(env.opts._,
                (env.opts.recurse ? env.conf.recurseDepth : undefined), filter);
        }

        return cli;
    };

    function resolvePluginPaths(paths) {
        const path = require('jsdoc/path');

        const pluginPaths = [];

        paths.forEach(plugin => {
            const basename = path.basename(plugin);
            const dirname = path.dirname(plugin);
            const pluginPath = path.getResourcePath(dirname, basename);

            if (!pluginPath) {
                logger.error('Unable to find the plugin "%s"', plugin);

                return;
            }

            pluginPaths.push( pluginPath );
        });

        return pluginPaths;
    }

    cli.createParser = () => {
        const handlers = require('jsdoc/src/handlers');
        const parser = require('jsdoc/src/parser');
        const plugins = require('jsdoc/plugins');

        app.jsdoc.parser = parser.createParser(env.conf.parser);

        if (env.conf.plugins) {
            env.conf.plugins = resolvePluginPaths(env.conf.plugins);
            plugins.installPlugins(env.conf.plugins, app.jsdoc.parser);
        }

        handlers.attachTo(app.jsdoc.parser);

        return cli;
    };

    cli.parseFiles = () => {
        const augment = require('jsdoc/augment');
        const borrow = require('jsdoc/borrow');
        const Package = require('jsdoc/package').Package;

        let docs;
        let packageDocs;

        props.docs = docs = app.jsdoc.parser.parse(env.sourceFiles, env.opts.encoding);

        // If there is no package.json, just create an empty package
        packageDocs = new Package(props.packageJson);
        packageDocs.files = env.sourceFiles || [];
        docs.push(packageDocs);

        logger.debug('Adding inherited symbols, mixins, and interface implementations...');
        augment.augmentAll(docs);
        logger.debug('Adding borrowed doclets...');
        borrow.resolveBorrows(docs);
        logger.debug('Post-processing complete.');

        app.jsdoc.parser.fireProcessingComplete(docs);

        return cli;
    };

    cli.processParseResults = () => {
        if (env.opts.explain) {
            cli.dumpParseResults();

            return Promise.resolve();
        }
        else {
            cli.resolveTutorials();

            return cli.generateDocs();
        }
    };

    cli.dumpParseResults = () => {
        console.log(require('jsdoc/util/dumper').dump(props.docs));

        return cli;
    };

    cli.resolveTutorials = () => {
        const resolver = require('jsdoc/tutorial/resolver');

        if (env.opts.tutorials) {
            resolver.load(env.opts.tutorials);
            resolver.resolve();
        }

        return cli;
    };

    cli.generateDocs = () => {
        const path = require('jsdoc/path');
        const resolver = require('jsdoc/tutorial/resolver');
        const taffy = require('taffydb').taffy;

        let template;

        env.opts.template = (() => {
            const publish = env.opts.template || 'templates/default';
            const templatePath = path.getResourcePath(publish);

            // if we didn't find the template, keep the user-specified value so the error message is
            // useful
            return templatePath || env.opts.template;
        })();

        try {
            template = require(`${env.opts.template}/publish`);
        }
        catch (e) {
            logger.fatal(`Unable to load template: ${e.message}` || e);
        }

        // templates should include a publish.js file that exports a "publish" function
        if (template.publish && typeof template.publish === 'function') {
            let publishPromise;

            logger.info('Generating output files...');
            publishPromise = template.publish(
                taffy(props.docs),
                env.opts,
                resolver.root
            );

            return Promise.resolve(publishPromise);
        }
        else {
            logger.fatal(`${env.opts.template} does not export a "publish" function. Global "publish" functions are no longer supported.`);
        }

        return Promise.resolve();
    };

    // TODO: docs
    cli.exit = (exitCode, message) => {
        if (exitCode > 0 && message) {
            console.error(message);
        }
        process.on('exit', () => { process.exit(exitCode); });
    };

    return cli;
})();
