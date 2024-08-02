/* istanbul ignore file */

const gulp = require('gulp');
const glob = require('glob');
const Server = require('karma').Server;
const merge = require('merge-stream');
const path = require('path');
const tlds = require('./tlds');

// Gulp plugins
const babel = require('gulp-babel');
const clean = require('gulp-clean');
const concat = require('gulp-concat');
const eslint = require('gulp-eslint');
const mocha = require('gulp-mocha');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
// NOTE: DO NOT Upgrade gulp-uglify, it breaks IE8 and the options don't seem to be working
const uglify = require('gulp-uglify');
const wrap = require('gulp-wrap');

const rollup = require('./tasks/rollup');
const quickEs3 = require('./tasks/quick-es3');

// All properties that are part of the public/plugin APIs
const unmangleableProps = require('./tasks/uglify').unmangleableProps;

var paths = {
	src: 'src/**/*.js',
	srcCore: 'src/linkify.js',
	lib: ['lib/**/*.js'],
	libTest: ['lib/*.js', 'lib/linkify/**/*.js'],
	libCore: [
		'lib/linkify/core/*.js',
		'lib/linkify/utils/*.js',
		'lib/linkify.js'
	],
	amd: 'build/amd/**/*.js',
	test: 'test/index.js',
	spec: 'test/spec/**.js',
	qunit: 'test/qunit/**.js',
	polyfill: 'polyfill.js'
};

var tldsReplaceStr = `'${tlds.join('|')}'.split('|')`;

/**
	ES6 ~> babel (with CJS Node Modules)
	This populates the `lib` folder, allows usage with Node.js
*/
gulp.task('lib', () =>
	gulp.src(paths.src)
	.pipe(replace('__TLDS__', tldsReplaceStr))
	.pipe(babel())
	.pipe(gulp.dest('lib'))
);

/**
	ES6 to babel AMD modules
*/
gulp.task('amd', () =>
	gulp.src(paths.src)
	.pipe(replace('__TLDS__', tldsReplaceStr))
	.pipe(babel({
		plugins: [
			'add-module-exports',
			'transform-es2015-modules-amd'
		],
		moduleIds: true
		// moduleRoot: 'linkifyjs'
	}))
	.pipe(quickEs3())
	.pipe(gulp.dest('build/amd')) // Required for building plugins separately
);

/**
	Build core linkify.js
*/
gulp.task('build-core', () =>
	gulp.src(paths.srcCore, {read: false})
	.pipe(rollup({
		bundle: {
			format: 'iife',
			moduleName: 'linkify'
		}
	}))
	.pipe(babel())
	.pipe(replace('__TLDS__', tldsReplaceStr))
	.pipe(replace('undefined.', 'self.'))
	.pipe(wrap({src: 'templates/linkify.js'}))
	.pipe(gulp.dest('build'))
);

/**
	ES6 to babel AMD modules
	Must run interfaces first because a more optimized core linkify payload will
	overwrite the AMD-generated one
*/
gulp.task('build-amd-core', () =>
	gulp.src(paths.srcCore)
	.pipe(rollup({
		bundle: {
			format: 'amd',
			moduleId: 'linkify',
			moduleName: 'linkify'
		}
	}))
	.pipe(babel())
	.pipe(replace('__TLDS__', tldsReplaceStr))
	.pipe(quickEs3())
	.pipe(concat('linkify.amd.js'))
	.pipe(gulp.dest('build'))
);

/**
	Build root linkify interfaces (files located at the root src folder other
	than linkify.js).
*/
gulp.task('build-interfaces', gulp.series('amd', () => {

	// Core linkify functionality as plugins
	let interfaces = [
		'string',
		'element',
		['linkify-element.js', 'jquery'], // jQuery interface requires both element and jquery
		[
			'simple-html-tokenizer/*.js',
			'simple-html-tokenizer.js',
			'html'
		],
		'react'
	];

	// Globals browser interface
	let streams = [];

	interfaces.forEach((intrface) => {

		let files = {js: [], amd: []};

		if (intrface instanceof Array) {
			// Interface has other intrface dependencies within this package
			intrface.forEach((i, idx) => {
				if (idx === intrface.length - 1) { return; } // ignore last index
				files.amd.push('build/amd/' + i);
			});

			// The last dependency is the name of the intrface
			intrface = intrface.pop();
		}

		files.js.push(`src/linkify-${intrface}.js`);
		files.amd.push(`build/amd/linkify-${intrface}.js`);

		let moduleName = `linkify${intrface.substring(0, 1).toUpperCase()}${intrface.substring(1)}`;

		// Browser intrface
		let stream = gulp.src(files.js)
		.pipe(rollup({
			rollup: {
				external: ['jquery', 'react', './linkify.js', `${__dirname}/src/linkify.js`]
			},
			bundle: {
				format: 'iife',
				moduleName: moduleName,
				globals: {
					'jquery': '$',
					'react': 'React',
					'./linkify.js': 'linkify',
					[`${__dirname}/src/linkify.js`]: 'linkify',
				}
			}
		}))
		.pipe(wrap({src: `templates/linkify-${intrface}.js`}))
		.pipe(babel())
		.pipe(gulp.dest('build'));

		streams.push(stream);

		// AMD intrface
		stream = gulp.src(files.amd)
		.pipe(concat(`linkify-${intrface}.amd.js`))
		.pipe(wrap({src: `templates/linkify-${intrface}.amd.js`}))
		.pipe(quickEs3())
		.pipe(gulp.dest('build'));

		streams.push(stream);
	});

	return merge.apply(this, streams);
}));


gulp.task('build-plugins', gulp.series('amd', () => {

	let streams = [];

	// Get the filenames of all available plugins
	let plugins = glob.sync('*.js', {
		cwd: path.join(__dirname, 'src', 'linkify', 'plugins')
	}).map((plugin) => plugin.replace(/\.js$/, ''));

	// Browser plugins
	plugins.forEach((plugin) => {

		// Global plugins
		var stream = gulp.src(`src/linkify/plugins/${plugin}.js`)
		.pipe(rollup({
			rollup: {
				external: ['./linkify', './linkify.js', `${__dirname}/src/linkify.js`]
			},
			bundle: {
				format: 'iife',
				moduleName: 'plugin',
				globals: {
					'./linkify': 'linkify',
					'./linkify.js': 'linkify',
					[`${__dirname}/src/linkify.js`]: 'linkify'
				}
			}
		}))
		.pipe(wrap({src: `templates/linkify/plugins/${plugin}.js`}))
		.pipe(babel())
		.pipe(concat(`linkify-plugin-${plugin}.js`))
		.pipe(gulp.dest('build'));
		streams.push(stream);

		// AMD plugins
		stream = gulp.src(`build/amd/linkify/plugins/${plugin}.js`)
		.pipe(wrap({src: `templates/linkify/plugins/${plugin}.amd.js`}))
		.pipe(concat(`linkify-plugin-${plugin}.amd.js`))
		.pipe(quickEs3())
		.pipe(gulp.dest('build'));
		streams.push(stream);

	});

	return merge.apply(this, streams);
}));

gulp.task('build-polyfill', () =>
	gulp.src(paths.polyfill)
	.pipe(concat('linkify-polyfill.js'))
	.pipe(gulp.dest('build'))
);

// Build steps
gulp.task('build', gulp.series(
	'lib',
	'build-core',
	'build-amd-core',
	'build-interfaces',
	'build-plugins',
	'build-polyfill'
));

// Copy React into vendor directory for use in tests
// This is required because React's location may vary between versions
gulp.task('vendor', () =>
	gulp.src([
		'node_modules/react/dist/react.min.js',
		'node_modules/react-dom/dist/react-dom.min.js',
		'node_modules/react/umd/react.production.min.js',
		'node_modules/react-dom/umd/react-dom.production.min.js'
	], { allowEmpty: true })
	.pipe(rename(path => path.basename = path.basename.replace(/\.production/, '')))
	.pipe(gulp.dest('vendor'))
);

/**
	Lint using eslint
*/
gulp.task('eslint', () =>
	gulp.src([
		'gulpfile.js',
		paths.src,
		paths.test,
		paths.spec,
		paths.qunit,
		'!src/simple-html-tokenizer/**'
	])
	.pipe(eslint())
	.pipe(eslint.format())
	.pipe(eslint.failAfterError())
);

/**
	Run mocha tests
*/
gulp.task('mocha', gulp.series('build', () =>
	gulp.src(paths.test).pipe(mocha())
));

gulp.task('karma', gulp.series('vendor', (callback) => {
	let server = new Server({
		configFile: __dirname + '/test/dev.conf.js',
		singleRun: true
	}, callback);
	return server.start();
}));

gulp.task('karma-chrome', gulp.series('vendor', (callback) => {
	let server = new Server({
		configFile: __dirname + '/test/chrome.conf.js',
	}, callback);
	return server.start();
}));

gulp.task('karma-firefox', gulp.series('vendor', (callback) => {
	let server = new Server({
		configFile: __dirname + '/test/firefox.conf.js',
	}, callback);
	return server.start();
}));

gulp.task('karma-ci', gulp.series('vendor', (callback) => {
	let server = new Server({
		configFile: __dirname + '/test/ci.conf.js',
		singleRun: true
	}, callback);
	return server.start();
}));

gulp.task('karma-amd', gulp.series('vendor', (callback) => {
	let server = new Server({
		configFile: __dirname + '/test/dev.amd.conf.js',
		singleRun: true
	}, callback);
	return server.start();
}));

gulp.task('karma-amd-chrome', gulp.series('vendor', (callback) => {
	let server = new Server({
		configFile: __dirname + '/test/chrome.amd.conf.js',
	}, callback);
	return server.start();
}));

gulp.task('karma-amd-firefox', gulp.series('vendor', (callback) => {
	let server = new Server({
		configFile: __dirname + '/test/firefox.amd.conf.js',
	}, callback);
	return server.start();
}));

gulp.task('karma-amd-ci', gulp.series('vendor', (callback) => {
	let server = new Server({
		configFile: __dirname + '/test/ci.amd.conf.js',
		singleRun: true
	}, callback);
	return server.start();
}));

// Build a file that can be used for easy headless benchmarking
gulp.task('build-benchmark', gulp.series('build', () =>
	gulp.src('build/dist/jquery.linkify.js')
	.pipe(concat('linkify-benchmark.js'))
	.pipe(wrap({src: 'templates/linkify-benchmark.js'}))
	.pipe(uglify())
	.pipe(gulp.dest('build/benchmark'))
));

// NOTE: DO NOT Upgrade gulp-uglify, it breaks IE8 and the options don't seem to be working
gulp.task('uglify', gulp.series('build', () => {
	let options = {
		mangleProperties: {
			regex: new RegExp(`^(?!(${unmangleableProps.join('|')})).*$`)
		}
	};

	return gulp.src('build/*.js')
	.pipe(gulp.dest('dist')) // non-minified copy
	.pipe(rename((path) => path.extname = '.min.js'))
	.pipe(uglify(options))
	.pipe(gulp.dest('dist'));
}));

gulp.task('dist', gulp.series('uglify'));
gulp.task('test', gulp.series('eslint', 'mocha', 'dist', 'karma', 'karma-amd'));
gulp.task('test-ci', gulp.series('dist', 'karma-ci', 'karma-amd-ci'));

gulp.task('clean', () =>
	gulp.src([
		'_sass',
		'build',
		'coverage',
		'dist',
		'js',
		'lib',
		'vendor'
	], {read: false}).pipe(clean())
);

/**
	Build JS and begin watching for changes
*/
gulp.task('default', gulp.series('eslint', 'lib', () =>
	gulp.watch(paths.src, ['eslint', 'lib'])
));
