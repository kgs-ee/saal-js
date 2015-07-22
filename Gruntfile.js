module.exports = function(grunt) {
  
  grunt.initConfig({
    clean: {
      tests: ['dist']
    },
    copy: {
      dist: {
        cwd: 'src/', expand: true, src: '**', dest: 'dist/'
      }
    },
    uncss: {
    dist: {
      options: {
        ignore: [
        /ui-datepicker/,
        '.badge',
        'svg',
        'td[title="Available"]',
        '.collapsed',
        '.collasing',
        '.navbar-toggle',
        '.collapse.in',
        /fancybox/
        ],
        stylesheets  : ['/stylesheets/style.css', 'javascripts/fancybox2/source/jquery.fancybox.css'],
        ignoreSheets : [/fonts.googleapis/],
        urls         : [], //Overwritten in load_sitemap_and_uncss task
        compress:true
      },
      files: [
        { src: 'src/*.html', dest: 'dist/stylesheets/compiled.css'}
        ]
      },
    },
    processhtml: {
      dist: {
        files: {
        'dist/index.html': ['src/index.html'],
        'dist/program.html': ['src/program.html'],
        'dist/single-event.html': ['src/single-event.html'],
        'dist/contact.html': ['src/contact.html'],
        'dist/about.html': ['src/about.html'],
        'dist/projects.html': ['src/projects.html'],
        'dist/residencies.html': ['src/residencies.html'],
        'dist/single-residency.html': ['src/single-residency.html'],
        'dist/tours.html': ['src/tours.html']
        }
      }
    },
    cssmin: {
      dist: {
        files: [
          { src: 'dist/stylesheets/compiled.css', dest: 'dist/stylesheets/style.min.css' }
          ]
      }
    },
    uglify: {
      dist: {
        files: {
          'dist/javascripts/compiled.min.js': [
          'src/javascripts/jquery/jquery-2.1.3.min.js',
          'src/javascripts/jquery/jquery-ui.min.js',
          'src/javascripts/jquery/jquery-ui-i18n.min.js',
          'src/javascripts/bootstrap/bootstrap.js',
          'src/javascripts/jquery.shorten/jquery.shorten.js',
          'src/javascripts/fancybox2/source/jquery.fancybox.pack.js',
          'src/javascripts/gradientmaps/gradientmaps.min.js',
          'src/javascripts/scripts.js'
          ]
        }
      }
    }
  });
  
  // Load the plugins
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-uncss');
  grunt.loadNpmTasks('grunt-processhtml');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  
  // Default tasks.
  grunt.registerTask('default', ['copy', 'uglify', 'uncss', 'cssmin', 'processhtml']);
};