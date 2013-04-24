/**
 * Router for hash navigation
 *
 * @class   OroApp.hashNavigation
 * @extends OroApp.Router
 */
OroApp.hashNavigation = OroApp.Router.extend({
    /**
     * Selector for all links that will be processed by hash navigation
     *
     * @property {String}
     * */
    selector: 'a:not([href^=#],[href^=javascript]),span[data-url]',

    /** @property {String} */
    baseUrl: '',

    /**
     * State data for grids
     *
     * @property
     */
    encodedStateData: '',

    /**
     * Url part
     *
     * @property
     */
    url: '',


    /** @property {OroApp.DatagridRouter} */
    gridRoute: '',

    /** @property */
    routes: {
        "url=*page(|g/*encodedStateData)": "defaultAction",
        "g/*encodedStateData": "gridChangeStateAction"
    },

    /**
     * Routing default action
     *
     * @param {String} page
     * @param {String} encodedStateData
     */
    defaultAction: function (page, encodedStateData) {
        this.encodedStateData = encodedStateData;
        this.url = page;
        this.loadPage(this.url);
    },

    gridChangeStateAction: function(encodedStateData) {
        this.encodedStateData = encodedStateData;
        //this.gridChangeState();
    },

    gridChangeState: function() {
        if (this.gridRoute) {
            this.gridRoute.changeState(this.encodedStateData);
        }
    },

    /**
     * Initialaize hash navigation
     *
     * @param options
     */
    initialize: function(options) {
        options = options || {};
        if (!options.baseUrl) {
            throw new TypeError("'baseUrl' is required");
        }

        this.baseUrl = options.baseUrl;

        this.init();

        OroApp.Router.prototype.initialize.apply(this, arguments);
    },

    /**
     * Set active menu class depending on url
     *
     * @param {String} url
     */
    setActiveMenu: function(url) {
        $('.application-menu a').parents('li').removeClass('active');
        var li = $('.application-menu a[href="' + url + '"]').parents('li');
        li.addClass('active');
        var tabId = li.parents('.tab-pane').attr('id');
        $('.application-menu a[href=#' + tabId + ']').tab('show');
        
    },

    /**
     * Ajax call for loading page content
     */
    loadPage: function () {
        if (this.url) {
            this.gridRoute = ''; //clearing grid router
            var pageUrl = this.baseUrl + this.url;
            $.ajax({
                url: pageUrl,

                headers: { 'x-oro-hash-navigation': true },

                error: function(XMLHttpRequest, textStatus, errorThrown) {
                    alert('Error Message: '+textStatus);
                    alert('HTTP Error: '+errorThrown);
                },

                success: _.bind(function(data)  {
                    this.handleResponse(data);
                    this.setActiveMenu(this.url);
                }, this)
            });
        }
    },

    /**
     *
     */
    init: function() {
        /**
         * Processing all links
         */
        this.processClicks(this.selector);
        /**
         * Processing all links in grid after grid load
         */
        OroApp.Events.bind(
            "grid_load:complete",
            function() {this.processClicks('.grid-container ' + this.selector)},
            this
        );
        /**
         * Checking for grid route
         */
        OroApp.Events.bind(
            "grid_route:loaded",
            function(route) {this.gridRoute = route; this.gridChangeState();},
            this
        );
        /**
         * Processing links in 3 dots menu after item is added (e.g. favourites)
         */
        OroApp.Events.bind(
            "navigaion_item:added",
            function(item) {
                this.processClicks(item.find(this.selector));
            },
            this
        );
    },

    /**
     * Handling ajax response data. Updating content area with new content, processing title and js
     *
     * @param {String} data
     */
    handleResponse: function(data)
    {
        /**
         * todo: check the bug in firefox with page freezing and remove
         */
        document.getElementById('container').innerHTML = '';
        $('#container').html($(data).filter('#content').html());
        var js = '';
        $(data).filter('#head').find('script:not([src])').each(function() {
            js = js + this.outerHTML;
        })
        $('#container').append(js);
        var title = $(data).filter('#head').find('title').html();
        $('title').html(title);
        $('.top-action-box .btn').filter('.minimize-button, .favorite-button').data('title', title);

        this.processClicks('#container ' + this.selector);
        this.updateMenuTabs(data);
        this.triggerCompleteEvent();
    },

    /**
     * Update History and Most Viewed menu tabs
     *
     * @param data
     */
    updateMenuTabs: function(data) {
        $('#history-content').html($(data).filter('#history-content').html());
        $('#most-viewed-content').html($(data).filter('#most-viewed-content').html());
        /**
         * Processing links for history and most viewed tabs
         */
        this.processClicks('#history-content ' + this.selector + ', #most-viewed-content ' + this.selector);
    },

    /**
     * Trigger hash navigation complete event
     */
    triggerCompleteEvent: function() {
        /**
         * Backbone event. Fired when hash navigation ajax request is complete
         * @event hash_navigation_request:complete
         */
        OroApp.Events.trigger("hash_navigation_request:complete", this);
    },

    /**
     * Processing all links in selector and setting necessary click handler
     * links with "no-hash" class are not processed
     *
     * @param {String} selector
     */
    processClicks: function(selector) {
        $(selector).not('.no-hash').on('click', _.bind(function(e) {
            if (e.shiftKey || e.ctrlKey || e.metaKey || e.which == 2) {
                return true;
            }
            var target = e.currentTarget;
            e.preventDefault();
            var link = '';
            if ($(target).is('a')) {
                link = $(target).attr('href');
                if ($(target).hasClass('back')) {
                    this.back();
                }
            } else if ($(target).is('span')) {
                link = $(target).attr('data-url');
            }
            link = link.replace(this.baseUrl, '').replace(/^(#\!?|\.)/, '');
            if (link) {
                window.location.hash = '#url=' + link;
            }
            return false;
        }, this));
    },

    /**
     * Returns real url part from the hash
     * @return {String}
     */
    getHashUrl: function() {
        var url = this.url;
        if (!url) {
            /**
             * Get real url part from the url without grid state
             */
            url = Backbone.history.fragment.split('|g/')[0].replace('url=', '');
            if (!url) {
                url = window.location.pathname + window.location.search;
            }
        }
        return url;
    },

    /**
     * Processing back clicks. If we have back attribute in url, use it, otherwise using browser back
     */
    back: function() {
        var url = new Url(this.getHashUrl());
        if (url.query.back) {
            window.location = url.query.back;
        } else {
            window.history.back();
        }
    }
});