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
          /\w\.in/,
          ".fade",
          ".collapse",
          ".collapsing",
          '.collapsed',
          // /(#|\.)navbar(\-[a-zA-Z]+)?/,
          // /(#|\.)dropdown(\-[a-zA-Z]+)?/,
          /(#|\.)(open)/,
          // ".modal",
          // ".modal.fade.in",
          // ".modal-dialog",
          // ".modal-document",
          // ".modal-scrollbar-measure",
          // ".modal-backdrop.fade",
          // ".modal-backdrop.in",
          // ".modal.fade.modal-dialog",
          // ".modal.in.modal-dialog",
          // ".modal-open",
          // ".modal-backdrop"
          /carousel-inner/,
          "table",
          // /datepicker/,
          "#datepicker",
          ".ui-datepicker",
          ".ui-datepicker-calendar",
          ".ui-datepicker-title",
          ".ui-datepicker-prev",
          ".ui-datepicker-next",
          ".ui-datepicker-prev span",
          ".ui-datepicker-next span",
          ".ui-datepicker-prev:before",
          ".ui-datepicker-next:before",
          ".ui-datepicker-calendar>thead>tr>th",
          ".ui-datepicker-calendar>thead>tr>td",
          ".ui-datepicker-calendar>tbody>tr>th",
          ".ui-datepicker-calendar>tbody>tr>td",
          ".ui-datepicker-calendar>tfoot>tr>th",
          ".ui-datepicker-calendar>tfoot>tr>td",
          ".ui-datepicker-calendar>thead>tr>th",
          ".ui-datepicker-calendar>thead:first-child>tr:first-child>th",
          ".ui-datepicker-calendar>thead:first-child>tr:first-child>td",
          ".ui-datepicker-calendar>tbody+tbody",
          ".ui-datepicker-calendar.ui-datepicker-calendar",
          ".ui-datepicker>.ui-datepicker-calendar",
          ".ui-datepicker>.ui-datepicker-calendar>thead>tr>th",
          ".ui-datepicker>.ui-datepicker-calendar>thead>tr>td",
          ".ui-datepicker>.ui-datepicker-calendar>tbody>tr>th",
          ".ui-datepicker>.ui-datepicker-calendar>tbody>tr>td",
          ".ui-datepicker>.ui-datepicker-calendar>tfoot>tr>th",
          ".ui-datepicker>.ui-datepicker-calendar>tfoot>tr>td",
          ".highlight a",
          '.event-banner svg',
          '.navbar-toggle',
          /fancybox/,
          // /popover/,
          ".popover",
          ".popover.bottom",
          ".popover li",
          ".popover li a",
          ".popover li a:hover",
          ".popover li:last-child",
          ".popover-content ul.list-unstyled",
          ".popover>.arrow",
          ".popover>.arrow:after",
          ".popover.bottom>.arrow",
          ".popover.bottom>.arrow:after",
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
          '.resident'
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
          'public/javascripts/bootstrap/carousel.js',
          'public/javascripts/bootstrap/collapse.js',
          'public/javascripts/bootstrap/dropdown.js',
          'public/javascripts/bootstrap/tooltip.js',
          'public/javascripts/bootstrap/popover.js',
          'public/javascripts/bootstrap/transition.js',
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