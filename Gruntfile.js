module.exports = function(grunt) {

  grunt.initConfig({

    uncss: {
    dist: {
      options: {
        ignore: [
            /\w\.in/,
            ".fade",
            ".collapse",
            ".collapsing",
            '.collapsed',
            /nav/,
            /(#|\.)navbar(\-[a-zA-Z]+)?/,
            /(#|\.)dropdown(\-[a-zA-Z]+)?/,
            /(#|\.)(open)/,
            /carousel-inner/,
            "table",
            /datepicker/,
            /highlight/,
            /select-cat/,
            /main-nav/,
            '.event-banner svg',
            '.navbar-toggle',
            /fancybox/,
            /popover/,
            /site-search/,
            /pager/,
            ".archive",
            ".archive.top",
            ".archive.bottom",
            /mailchimp-sign-up/,
            '.icon-search',
            '.h4',
            '.today',
            /legend/,
            '.main-text p',
            '.team',
            '.member',
            '.address',
            '.intranet',
            '.resident',
            '.img-circle',
            '.lang',
            /icon-checkmark/,
            '.artist',
            '.producer',
            '.town',
            '.artist:after',
            '.producer:after',
            '.subtitle',
            '.front-banner',
            /event-categories/,
            '.front-page-margin',
            '.page-margin',
            '.tickets',
            '.projects-group img',
            '.co-production',
            '.co-production img',
            /disabled/,
            '.banner',
            /article/,
            '.single-image',
            '.comments',
            '.source',
            '.video-sound',
            '.video-sound iframe',
            '.video-sound iframe:last-child',
            '.related-perfomance',
            '.btn.btn-primary.free.disabled'

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
          'public/javascripts/bootstrap/carousel.js',
          'public/javascripts/bootstrap/collapse.js',
          'public/javascripts/bootstrap/dropdown.js',
          'public/javascripts/bootstrap/tooltip.js',
          'public/javascripts/bootstrap/popover.js',
          'public/javascripts/bootstrap/transition.js',
          'public/javascripts/fancybox2/source/jquery.fancybox.pack.js',
          'public/javascripts/gradientmaps/gradientmaps.js',
          'public/javascripts/scripts.js'
          ]
        }
      }
    }
  });

  // Load the plugins
  grunt.loadNpmTasks('grunt-uncss');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  // Default tasks.
  grunt.registerTask('default', ['uglify', 'uncss', 'cssmin']);
};
