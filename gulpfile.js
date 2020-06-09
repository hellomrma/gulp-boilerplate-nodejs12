(() => {
	'use strict';
	const
		// directory locations
		dir = {
			src : 'src/',
			dist: 'dist/'
		},

		// modules
		{
			src,
			dest,
			watch,
			series,
			parallel
		} = require('gulp'),
		del           = require('del'),
		newer         = require('gulp-newer'),
		size          = require('gulp-size'),
		concat        = require('gulp-concat'),
		imagemin      = require('gulp-imagemin'),
		sass          = require('gulp-sass'),
		sourcemaps    = require('gulp-sourcemaps'),
		postcss       = require('gulp-postcss'),
		concatcss     = require('gulp-concat-css'),
		rename        = require('gulp-rename'),
		whitespace    = require('gulp-whitespace'),
		uglify        = require('gulp-uglify'),
		browsersync   = require('browser-sync').create(),
		spritesmith   = require('gulp.spritesmith-multi'),
		ejs           = require('gulp-ejs'),
		fs            = require('fs'),
		inquirer      = require('inquirer'),
		util          = require('util'),
		path          = require('path'),
		cheerio       = require('cheerio'),
		htmlhint      = require('gulp-htmlhint'),
		fileinclude   = require('gulp-file-include'),
		sassInlineSvg = require('gulp-sass-inline-svg'),
		svgMin        = require('gulp-svgmin'),
		base64Inline  = require('gulp-base64-inline'),
		merge         = require('merge-stream');


	// Swipe Dist Folder
	function swipeDist() {
		return del([dir.dist]);
	}

	exports.swipeDist = swipeDist;

	// Clone files in root
	function cloneRoot() {
		return src([dir.src + '*.*', '!src/*.html'])
			.pipe(dest(dir.dist));
	}

	exports.cloneRoot = cloneRoot;

	// Javascript
	const jsSetting = {
		src           : dir.src + 'js/**/*.js',
		dist          : dir.dist + 'js/',
		srcApps       : dir.src + 'js/apps/*.js',
		minifyFileName: 'project-name.min.js'
	};

	// Setting Project
	function setting(done) {
		const questions = [{
				type   : 'input',
				name   : 'project_name',
				message: '프로젝트 명:'
			},
			{
				type   : 'input',
				name   : 'author',
				message: '담당자 (여러명일 경우 콤마(,)로 구분):'
			},
			{
				type   : 'input',
				name   : 'organization',
				message: '담당 조직명:'
			}
		];
		inquirer.prompt(questions).then(function (answers) {
			const answerData = JSON.stringify(answers);
			fs.writeFile('templates/projectInfo.json', answerData, function (err) {
				if (err) throw err;
				console.log('프로젝트 정보 입력이 완료 되었습니다.');
			});
			done();
		});
	}

	exports.setting = setting;

	// Swipe JS Dist Folder
	function swipeJS() {
		return del([jsSetting.dist]);
	}

	function cloneJS() {
		return src(jsSetting.src)
			.pipe(newer(jsSetting.dist))
			.pipe(whitespace({
				spacesToTabs  : 4,
				removeTrailing: true
			}))
			.pipe(dest(jsSetting.dist))
	}

	function minifyJS() {
		return src(jsSetting.srcApps)
			.pipe(concat(jsSetting.minifyFileName))
			.pipe(uglify())
			.pipe(dest(jsSetting.dist))
			.pipe(browsersync.reload({
				stream: true
			}))
	}

	exports.js = series(swipeJS, cloneJS, minifyJS)

	// Font
	const fontsSetting = {
		src : dir.src + 'font/**/*',
		dist: dir.dist + 'font/'
	};

	// Swipe Font Dist Folder
	function swipeFont() {
		return del([fontsSetting.dist]);
	}

	function cloneFontFolder() {
		return src(fontsSetting.src)
			.pipe(newer(fontsSetting.dist))
			.pipe(dest(fontsSetting.dist));
	}

	exports.font = series(swipeFont, cloneFontFolder);

	// Images
	const imgSetting = {
		src    : dir.src + 'img/**/*',
		dist   : dir.dist + 'img/',
		svg    : dir.src + 'img/svg/*.svg',
		minOpts: {
			optimizationLevel: 5
		}
	};

	// Swipe Image Dist Folder
	function swipeImage() {
		return del([imgSetting.dist]);
	}

	function generateImages() {
		return src(imgSetting.src)
			.pipe(newer(imgSetting.dist))
			.pipe(imagemin(imgSetting.minOpts))
			.pipe(size({
				showFiles: false
			}))
			.pipe(dest(imgSetting.dist))
	}

	function inlineSVG() {
		return src(imgSetting.svg)
			.pipe(newer(imgSetting.dist))
			.pipe(svgMin())
			.pipe(sassInlineSvg({
				destDir: 'src/css/scss/svg'
			}));
	}

	exports.image = series(swipeImage, generateImages, inlineSVG);

	// HTML
	const htmlSetting = {
		src   : dir.src + '**/*.html',
		dist  : dir.dist + 'views',
		except: dir.src + 'views/include/*.html'
	};

	// Swipe HTML Dist Folder
	function swipeHTML() {
		return del([htmlSetting.dist]);
	}

	function setHTML() {
		return src([htmlSetting.src, '!' + htmlSetting.except])
			.pipe(newer(htmlSetting.dist))
			.pipe(fileinclude({
				prefix  : '@@',
				basepath: '@file'
			}))
			.pipe(htmlhint('templates/htmlhint.json'))
			.pipe(htmlhint.reporter())
			.pipe(whitespace({
				spacesToTabs  : 4,
				removeTrailing: true
			}))
			.pipe(dest(dir.dist))
	}

	function generateHTML(done) {
		let dPath       = "dist/views",
		    projectObj  = {},
		    docFiles    = [],
		    normalFiles = [],
		    categories  = [],
			projectObjStr,
			projectObjJson;

		let projectJson               = fs.readFileSync('templates/projectInfo.json', 'utf-8'),
		    projectInfo               = {};
		    projectInfo.projectName   = JSON.parse(projectJson).project_name;
		    projectInfo.projectAuthor = JSON.parse(projectJson).author;
		    projectInfo.projectOrg    = JSON.parse(projectJson).organization;

		fs.readdir(dPath, function (err, files) {
			if (err) {
				throw err;
			}
			files.map(function (file) {
				return path.join(dPath, file);
			}).filter(function (file) {
				return fs.statSync(file).isFile();
			}).forEach(function (file) {
				let dfileData,
					fileInnerText,
					wholeTitle,
					splitTitle,
					nfileData,
					pageStatus,
					splitStatus;

				let stats = fs.statSync(file);

				let extname  = path.extname(file),
				    basename = path.basename(file);
				if (extname == '.html') {
					// Document Pages
					if (basename.match(/@/)) {
						dfileData = {};

						    fileInnerText = fs.readFileSync(file, 'utf8');
						let $             = cheerio.load(fileInnerText);
						    wholeTitle    = ($('meta[name="list"]').length !== 0) ? $('meta[name="list"]').attr('content') : $('title').text();
						    splitTitle    = wholeTitle.split(' : ');

						if ($('body').data('pagestatus')) {
							pageStatus                = $('body').data('pagestatus');
							splitStatus               = pageStatus.split(' : ');
							dfileData.splitStatus     = splitStatus[0];
							dfileData.splitStatusDate = splitStatus[1];
						}

						dfileData.title        = splitTitle[0];
						dfileData.name         = path.basename(file);
						dfileData.category     = String(dfileData.name).substring(0, 2);
						dfileData.categoryText = splitTitle[1];
						dfileData.listTitle    = wholeTitle;
						dfileData.mdate        = new Date(util.inspect(stats.mtime));
						docFiles.push(dfileData);
						if (!categories.includes(dfileData.category)) {
							categories.push(dfileData.category);
						}
						if ($('meta[name="list"]').length !== 0) {
							$('meta[name="list"]').remove();
							fs.writeFileSync(file, $.html({
								decodeEntities: false
							}), function (err) {
								if (err) throw err;
							});
						}
					} else {
						// Normal Pages
						nfileData = {};

						    fileInnerText = fs.readFileSync(file, 'utf8');
						let $             = cheerio.load(fileInnerText);
						    wholeTitle    = ($('meta[name="list"]').length !== 0) ? $('meta[name="list"]').attr('content') : $('title').text();
						    splitTitle    = wholeTitle.split(' : ');

						if ($('body').data('pagestatus')) {
							pageStatus                = $('body').data('pagestatus');
							splitStatus               = pageStatus.split(' : ');
							nfileData.splitStatus     = splitStatus[0];
							nfileData.splitStatusDate = splitStatus[1];
						}

						nfileData.title        = splitTitle[0];
						nfileData.name         = path.basename(file);
						nfileData.category     = String(nfileData.name).substring(0, 2);
						nfileData.categoryText = splitTitle[1];
						nfileData.listTitle    = wholeTitle;
						nfileData.mdate        = new Date(util.inspect(stats.mtime));
						normalFiles.push(nfileData);
						if (!categories.includes(nfileData.category)) {
							categories.push(nfileData.category);
						}
						if ($('meta[name="list"]').length !== 0) {
							$('meta[name="list"]').remove();
							fs.writeFileSync(file, $.html({
								decodeEntities: false
							}), function (err) {
								if (err) throw err;
							});
						}
					}
				}
			});

			projectObj = {
				project: projectInfo,
				dfiles : docFiles,
				nfiles : normalFiles
			};

			projectObjStr  = JSON.stringify(projectObj);
			projectObjJson = JSON.parse(projectObjStr);

			src("templates/@index.html")
				.pipe(ejs(projectObjJson))
				.pipe(dest("dist/"))
				.pipe(browsersync.reload({
					stream: true
				}))
			done();
		});
	}

	exports.html = series(swipeHTML, setHTML, generateHTML);

	// CSS
	const cssSetting = {
		src   : dir.src + 'css/scss/**/*.*',
		dist    : dir.dist + 'css/',
		libs    : dir.src + 'css/libs/**/*',
		sprites : dir.src + 'css/scss/sprites/*.*',
		sassOpts: {
			sourceMap      : true,
			outputStyle    : 'nested',
			errLogToConsole: true
		},
		postCSSdefault: [
			require('autoprefixer')
		],
		postCSSminify: [
			require('cssnano')({
				preset: 'default',
			}),
		],
	};

	// Swipe CSS Dist Folder
	function swipeCSS() {
		return del([cssSetting.dist]);
	}

	function concatLibsCSS() {
		return src(cssSetting.libs)
			.pipe(concatcss('libs.css'))
			.pipe(dest(cssSetting.dist))
	}

	function generateSprite() {
		var opts = {
			spritesmith: function (options, sprite, icons) {
				options.imgPath = `../img/sprites/${options.imgName}`;
				options.cssName = `_${sprite}.scss`;
				options.cssTemplate = `./src/css/sprites-data/spritesmith-mixins.handlebars`
				options.cssSpritesheetName = sprite;
				options.padding = 4;
				options.algorithm = 'binary-tree';
				return options;
			}
		};
		var spriteData = src('./src/img/sprites/**/*.png').pipe(spritesmith(opts)).on('error', function (err) {
			console.log(err);
		});
	
		var imgStream = spriteData.img.pipe(dest('./dist/img/sprites'));
		var cssStream = spriteData.css.pipe(dest('./src/css/sprites-data'));
	
		return merge(imgStream, cssStream);
	}

	function compileSCSS() {
		return src([cssSetting.src, '!' + cssSetting.sprites])
			.pipe(sourcemaps.init())
			.pipe(sass(cssSetting.sassOpts).on('error', sass.logError))
			.pipe(postcss(cssSetting.postCSSdefault))
			.pipe(sourcemaps.write())
			.pipe(size({
				showFiles: true
			}))
			.pipe(dest(cssSetting.dist))
			.pipe(browsersync.reload({
				stream: true
			}))
	}

	function minifyCSS() {
		return src(dir.dist + 'css/*.css')
			.pipe(postcss(cssSetting.postCSSminify))
			.pipe(rename({
				suffix: '.min'
			}))
			.pipe(dest(cssSetting.dist))
	}

	exports.css = series(swipeCSS, concatLibsCSS, generateSprite, compileSCSS, minifyCSS)

	// Server
	const browserSyncSetting = {
		server: {
			baseDir: 'dist/',
			index  : 'index.html'
		},
		port: 3030,
		open: true
	};

	// Browser-Sync
	function launchServer(done) {
		if (browsersync) browsersync.init(browserSyncSetting);
		done();
	}

	// Watch
	function watchingResources(done) {
		watch(jsSetting.src, exports.js);
		watch(fontsSetting.src, exports.font);
		watch(imgSetting.src, exports.image);
		watch(htmlSetting.src, exports.html);
		watch(cssSetting.src, exports.css);
		done();
	}

	exports.build = series(swipeDist, cloneRoot, exports.font, exports.js, exports.image, exports.css, exports.html);

	// Default
	exports.default = series(exports.build, watchingResources, launchServer);
})();