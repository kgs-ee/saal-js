module.exports = function(grunt) {
  
  grunt.initConfig({
    // clean: {
    //   tests: ['dist']
    // },
    // copy: {
    //   dist: {
    //     cwd: 'src/', expand: true, src: '**', dest: 'dist/'
    //   }
    // },
    uncss: {
    dist: {
      options: {
        ignore: [
        /ui-datepicker/,
        '.badge',
        '.event-banner svg',
        '.collapsed',
        '.collasing',
        '.navbar-toggle',
        '.collapse.in',
        /fancybox/,
        /popover/
        ],
        stylesheets  : ['../public/stylesheets/style.css', '../public/javascripts/fancybox2/source/jquery.fancybox.css'],
        ignoreSheets : [/fonts.googleapis/],
        urls         : [], //Overwritten in load_sitemap_and_uncss task
        compress:true
      },
      files: [
        { src: 'frontend sketch/*.html', dest: 'public/stylesheets/compiled.css'}
        ]
      },
    },
    // processhtml: {
    //   dist: {
    //     files: {
    //     'dist/index.html': ['src/index.html'],
    //     'dist/program.html': ['src/program.html'],
    //     'dist/single-event.html': ['src/single-event.html'],
    //     'dist/contact.html': ['src/contact.html'],
    //     'dist/about.html': ['src/about.html'],
    //     'dist/projects.html': ['src/projects.html'],
    //     'dist/residencies.html': ['src/residencies.html'],
    //     'dist/single-residency.html': ['src/single-residency.html'],
    //     'dist/tours.html': ['src/tours.html']
    //     }
    //   }
    // },
    cssmin: {
      dist: {
        files: [
          { src: 'public/stylesheets/compiled.css', dest: 'public/stylesheets/style.min.css' }
          ]
      }
    },
    uglify: {
      dist: {
        files: {
          'public/javascripts/scripts.min.js': [
          'public/javascripts/jquery/jquery-2.1.3.min.js',
          'public/javascripts/jquery/jquery-ui.custom.min.js',
          'public/javascripts/jquery/jquery.ui.datepicker-en-GB.js',
          'public/javascripts/jquery/jquery.ui.datepicker-et.js',
          'public/javascripts/bootstrap/bootstrap.js',
          'public/javascripts/jquery.shorten/jquery.shorten.js',
          'public/javascripts/fancybox2/source/jquery.fancybox.pack.js',
          'public/javascripts/gradientmaps/gradientmaps.min.js',
          'public/javascripts/scripts.js'
          ]
        }
      }
    }
  });
  
  // Load the plugins
  // grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-uncss');
  // grunt.loadNpmTasks('grunt-processhtml');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  
  // Default tasks.
  grunt.registerTask('default', [/*'copy',*/ 'uglify', 'uncss', 'cssmin', /*'processhtml'*/]);
};