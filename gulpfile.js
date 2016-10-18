var gulp = require('gulp'),
	webpack = require('webpack'),
	path = require('path'),
	glob = require('glob'),
	clean = require('gulp-clean'),
	imagemin = require('gulp-imagemin'),
	cssmin = require('gulp-minify-css'),
	zip = require('gulp-zip'),
	less = require('gulp-less'),//处理less文件
	runSequence = require('gulp-run-sequence'),//控制task执行顺序
	spriter = require('gulp-css-spriter'),//生成雪碧图
	notify = require('gulp-notify'),//提示出现了错误
    plumber = require('gulp-plumber'),//编译less出错是不终止watch事件
	ExtractTextPlugin = require("extract-text-webpack-plugin"),
	HtmlWebpackPlugin = require('html-webpack-plugin'),
	CommonsChunkPlugin = webpack.optimize.CommonsChunkPlugin;

//源目录路径
var srcDir = path.resolve(process.cwd(), 'src');

//环境配置信息
var config = require('./fileConfig');

/****************************wepback配置*********************************/
var webpackConfig = {};

/*
 	获取入口文件js
 * */
var entries = (function () {

    var jsDir = path.resolve(srcDir, 'js');
    var entryFiles = glob.sync(jsDir + '/view/*.js');
    var map = {};

    entryFiles.forEach(function (filePath) {
        var filename = filePath.substring(filePath.lastIndexOf('\/') + 1, filePath.lastIndexOf('.'));
        map[filename] = filePath;
    });

    return map;
})();

//入口js
webpackConfig.entry = entries;

/*
 	自动生成入口配置
 	入口js必须和入口模板名相同
 * */
var entryPlugins = function ( output ) {

    var entryHtml = glob.sync(srcDir + '/html/*.html');
    var r = [];

    entryHtml.forEach(function (filePath) {

        var filename = filePath.substring(filePath.lastIndexOf('\/') + 1, filePath.lastIndexOf('.'));

        var conf = {};

        if (filename in entries) {

            conf.filename = output+filename + '.html';

            // 模板源位置
            conf.template = filePath;

            // 设置 js 入口
            conf.chunks = ['common.js', filename];

            // script 插入位置
            conf.inject = 'body';

            r.push(new HtmlWebpackPlugin(conf));
        }
    });

    return r;
};


/*
 	webpack插件
 * */
//dev
webpackConfig.plugins = [
	//提取公共js
	new CommonsChunkPlugin('common.js'),
	//抽离css(link引入)
	new ExtractTextPlugin('../css/[name].css'),
	/*new webpack.ProvidePlugin({
        $: "jquery",
        jQuery: "jquery",
        jquery: "jquery",
        "window.jQuery": "jquery"
    })*/
];

//release
webpackConfig.r_plugins = [
	//提取公共js
	new CommonsChunkPlugin('common.js'),
	//抽离css(link引入)
	new ExtractTextPlugin('../css/[name].[chunkhash:8].css'),
	//压缩js
	new webpack.optimize.UglifyJsPlugin({
        compress:{
            warnings:true
        }
    })
	/*new webpack.ProvidePlugin({
        $: "jquery",
        jQuery: "jquery",
        jquery: "jquery",
        "window.jQuery": "jquery"
    })*/
];

//dev 清除生成文件
gulp.task('dev-clean',function() {
	gulp.src(config.dev.output)
		.pipe(clean( {force: true} ))
});
//release 清除生成文件
gulp.task('release-clean',function() {
	gulp.src(config.release.output)
		.pipe(clean( {force: true} ))
});

//图片压缩
gulp.task('dev-imagemin', function(){
    gulp.src( srcDir + '/images/**/*')
        .pipe(imagemin())
        .pipe(gulp.dest( config.dev.output + '/images' ));
});
gulp.task('imagemin', function(){
    gulp.src( srcDir + '/images/**/*')
        .pipe(imagemin())
        .pipe(gulp.dest( config.release.output + '/images' ));
});

//less任务
gulp.task('less',function() {
	gulp.src(srcDir + '/less/**/*.less')
		.pipe(plumber({errorHandler: notify.onError('Error: <%= error.message %>')}))
        .pipe(less()) //该任务调用的模块
//      .pipe(spriter({
//          // 生成的spriter的位置
//          'spriteSheet': 'src/images/sprite.png',
//          // 生成样式文件图片引用地址的路径
//          // 如下将生产：backgound:url(/images/sprite.png)
//          'pathToSpriteSheetFromCSS': '/images/sprite.png'
//      }))
        .pipe(gulp.dest(srcDir + '/css')); //将会在src/css下生成.css

    gulp.src( srcDir +'/css/*.css')
        .pipe(gulp.dest( config.dev.output +'css' ));

});
//css压缩
gulp.task('cssmin', function () {
    gulp.src( config.release.output +'css/*.css')
        .pipe(cssmin({
            advanced: false,//类型：Boolean 默认：true [是否开启高级优化（合并选择器等）]
            compatibility: 'ie7',//保留ie7及以下兼容写法 类型：String 默认：''or'*' [启用兼容模式； 'ie7'：IE7兼容模式，'ie8'：IE8兼容模式，'*'：IE9+兼容模式]
            keepBreaks: false//类型：Boolean 默认：false [是否保留换行]
        }))
        .pipe(gulp.dest( config.release.output +'css' ));
});

//启动监听事件
gulp.task('watch',function() {
//	gulp.watch( srcDir + '/html/**/*' ,['dev-webpack']);
//	gulp.watch( srcDir + '/js/**/*' ,['dev-webpack']);

	gulp.watch( srcDir + '/less/*.less',['less']);
	gulp.watch( srcDir + '/images/*',['dev-imagemin'] );
});


//dev webpack
gulp.task('dev-webpack',function() {
	//插件添加入口配置
	webpackConfig.plugins = webpackConfig.plugins.concat(entryPlugins( config.dev.output ));

	webpack({
        entry:webpackConfig.entry,
        output: {
            path: config.dev.output + '/js/',
            filename:'[name].js',
          	publicPath:config.dev.publicPath
        },
        resolve:{
            //配置别名，在项目中可缩减引用路径
            /*alias:{
                jquery:srcDir+'/js/plugin/jquery.js'
            }*/
        },
        module: {
            //加载器配置
            loaders: [
                {test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader','css-loader!autoprefixer-loader')},
                //{test: /\.less$/,loader: "style!css!less"},
                { test: /\.(jpg|png|gif)$/, loader: "url-loader?limit=10240000" },
                { test: /\.tpl$/, loader: "ejs-loader?variable=data" }
            ]
        },
        plugins:webpackConfig.plugins,
        watch:true
    },function(err, stats) {
		//  if(err) throw new gutil.PluginError("webpack", err);
        //  gutil.log("[webpack]", stats.toString({
        //      // output options
        //  }));
        // callback();
    })
});

//release webpack
gulp.task('release-webpack',function() {
	//插件添加入口配置
	webpackConfig.r_plugins = webpackConfig.r_plugins.concat(entryPlugins( config.release.output ));

	webpack({
        entry:webpackConfig.entry,
        output: {
            path: config.release.output + '/js/',
            filename:'[name].[chunkhash:8].js',
          	publicPath:config.release.publicPath
        },
        resolve:{
            //配置别名，在项目中可缩减引用路径
            /*alias:{
                jquery:srcDir+'/js/plugin/jquery.js'
            }*/
        },
        module: {
            //加载器配置
            loaders: [
                {test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader','css-loader!autoprefixer-loader')},
                //{test: /\.less$/,loader: "style!css!less"},
                { test: /\.(jpg|png|gif)$/, loader: "url-loader?limit=10240000" },
                { test: /\.tpl$/, loader: "ejs-loader?variable=data" }
            ]
        },
        plugins:webpackConfig.r_plugins,
        //watch:true
    },function(err, stats) {
		//  if(err) throw new gutil.PluginError("webpack", err);
        //  gutil.log("[webpack]", stats.toString({
        //      // output options
        //  }));
        // callback();
    })
});

//文件打包
gulp.task('filezip', function () {
    gulp.src(config.release.output+'/**')
        .pipe(zip('invitation.zip'))
       .pipe(gulp.dest( '' ));
});


/*
 	定义开发环境执行任务
 * */
gulp.task('dev',function( callback ) {
	runSequence('watch','dev-webpack',callback)
});

/*
 	定义发布线上环境任务
 * */
gulp.task('clean',function( callback ){
    runSequence( ['release-clean'],callback )
});
gulp.task('webpack',function( callback ){
    runSequence(['release-webpack'],callback )
});
gulp.task('min',function( callback ){
    runSequence( 'cssmin', callback )
});