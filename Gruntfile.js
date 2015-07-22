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
          ignore : [
          /expanded/,
          /js/,
          /wp-/,
          /admin-bar/,
          '.collapse.in',
          '.collapsing',
          '.navbar-nav',
          '.nav>li',
          '.nav>li>a',
          '.navbar-default .navbar-nav>li',
          '.navbar-default .navbar-nav>li>a',
          '.navbar-default .navbar-nav>li>a:focus',
          '.navbar-default .navbar-nav>li>a:active',
          '.dropdown-menu>li>a',
          '.dropdown-menu>li>a:focus',
          '.dropdown-menu>li>a:active'
          ],
          stylesheets  : ['dist/stylesheets/style.css'],
          ignoreSheets : [/fonts.googleapis/],
          urls         : [], //Overwritten in load_sitemap_and_uncss task
          compress:true
        }
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
          'src/javascripts/bootstrap/collapse.js',
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