var gulp = require('gulp')
var _ = require('underscore')
var browserify = require('browserify')
var watchify = require('watchify')
var source = require('vinyl-source-stream')
var buffer = require('vinyl-buffer')
var gutil = require('gulp-util')
var del = require('del')
var mergeStream = require('merge-stream')

var dir = {
  dev: './src/',
  prod: './dist/'
}

gulp.task('build', ['clean'], function () {
  gulp.start('scripts', 'styles', 'data', 'html', 'cname')
})

gulp.task('watch', ['clean'], function () {
  gulp.start('scripts-watch', 'styles', 'data', 'html', 'cname')
  gulp.watch(dir.dev + 'styles/*css', ['styles'])
  gulp.watch(dir.dev + '*.html', ['html'])
})

gulp.task('scripts', function () {
  return mergeStream(
    scripts(dir.dev + 'scripts/vizwit-loader.js', 'vizwit-loader.js'),
    scripts(dir.dev + 'scripts/vizwit-embed.js', 'vizwit-embed.js'),
    scripts(dir.dev + 'scripts/vizwit-editor.js', 'vizwit-editor.js')
  )
})

gulp.task('scripts-watch', function () {
  return mergeStream(
    scripts(dir.dev + 'scripts/vizwit-loader.js', 'vizwit-loader.js', true),
    scripts(dir.dev + 'scripts/vizwit-embed.js', 'vizwit-embed.js', true),
    scripts(dir.dev + 'scripts/vizwit-editor.js', 'vizwit-editor.js', true)
  )
})

gulp.task('cname', function () {
  return gulp.src('CNAME')
    .pipe(gulp.dest(dir.prod))
})

gulp.task('html', function () {
  return gulp.src(dir.dev + '*.html')
    .pipe(gulp.dest(dir.prod))
})

gulp.task('styles', function () {
  return gulp.src(dir.dev + 'styles/*.css')
    .pipe(gulp.dest(dir.prod + 'styles/'))
})

gulp.task('data', function () {
  return gulp.src(dir.dev + 'data/*.json')
    .pipe(gulp.dest(dir.prod + 'data/'))
})

gulp.task('clean', function (cb) {
  return del(dir.prod, cb)
})

/**
* Build scripts and optionally watch for changes
*/
function scripts (src, dest, watch) {
  var bundleOpts = _.extend({}, watchify.args)
  if (watch) bundleOpts.debug = true

  var bundle = browserify(src, bundleOpts)

  if (watch) {
    bundle = watchify(bundle)

    bundle.on('update', function () { compileBundle(bundle, dest) }) // when a dependency changes, recompile
    bundle.on('log', gutil.log) // output build logs to terminal
  } else {
    bundle.transform({ global: true }, 'uglifyify')
  }

  return compileBundle(bundle, dest)
}

/**
* Compile a browserify bundle (used by multiple tasks)
*/
function compileBundle (bundle, dest) {
  return bundle.bundle()
    .on('error', gutil.log.bind(gutil, 'Browserify Error'))
    .pipe(source(dest))
    .pipe(buffer()) // buffer file contents (is this necessary?)
    .pipe(gulp.dest(dir.prod + 'scripts/'))
}
