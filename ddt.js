
/* Copyright 2013, deviantART, Inc.
 * Licensed under 3-Clause BSD.
 * Refer to the LICENCES.txt file for details.
 * For latest version, see https://github.com/deviantART/ddt
 */
(function(window) {
    if (!window.console) {
        return; // DDT will not be useful in this browser
    }

    // if you change any of these values, make sure to update all the ddt.php files
    var COOKIE_NAME = 'ddt_watch'
        ,COOKIE_SETTINGS = ' ;path=/ ;domain=.' + window.location.host.split('.').slice(-2).join('.')
        ,COOKIE_DOMAINS = [] // add your DDT domains
        ,DOMAIN_REGEX = new RegExp('^(https?:)?\\/\\/([^.]+\\.)?(' + COOKIE_DOMAINS.join('|').replace('.', '\\.') + ')\\b', 'i')
        ,IN_IFRAME = window.parent !== window
        ,watched = {}; // list of packages being watched

    // this cookie is completely unsigned, the only protection it has is the
    // very limited set of characters that will be accepted by watch/unwatch.
    var cookie = {
        get: function() {
            var regex  = new RegExp('(?:^|; )' + encodeURIComponent(COOKIE_NAME) + '=([^;]+)'),
                result = regex.exec(document.cookie);
            return result ? String(decodeURIComponent(result[1])).split(',') : [];
        }
        ,set: function() {
            var watched_list = [];
            for (var name in watched) {
                watched_list.push(name);
            }
            var m, channels = watched_list.join(',');
            for (var i = 0; i < COOKIE_DOMAINS.length; i++) {
                m = new Image();
                m.src = '//' + COOKIE_DOMAINS[i] + '/ddt/?channels=' + channels;
            }
            cookie.sync(++window.ddt.version);
        }
        ,del: function() {
            var expires = new Date();
            expires.setTime(expires.getTime() - 86400000); // expire 24 hours ago (in ms)
            document.cookie = encodeURIComponent(COOKIE_NAME) + '=; expires=' + expires.toUTCString() + COOKIE_SETTINGS;
            cookie.sync(++window.ddt.version);
        }
        ,sync: function() {} // noop is replaced when jQuery loads and postMessage is available
    };

    if (window.postMessage) {
        // DDT may load before JQuery, so we continue to poll until it becomes available
        var waiting = setInterval(function() {
            if (!window.jQuery) {
                return; // keep waiting
            }
            clearInterval(waiting);
            // replace cookie.sync noop with real function
            cookie.sync = function(version) {
                var msg = JSON.stringify({ddt: true, version: version, channels: watched})
                    ,origin = '*'
                    ,$frames = $('iframe[src]');

                $frames.filter(function() {
                    // only include frames that are part of DDT domains
                    // and ignore the frame that was sent from
                    return (DOMAIN_REGEX.test(this.src) && this.contentWindow.ddt && this.contentWindow.ddt.version !== version);
                });

                if ($frames.length) {
                    ddt.log('ddt', 'syncing channels down', $frames.length, 'frames found');
                    $frames.each(function() {
                        this.contentWindow.postMessage(msg, origin);
                    });
                }

                if (IN_IFRAME && window.parent.ddt.version !== version) {
                    ddt.log('ddt', 'syncing channels up');
                    window.parent.postMessage(msg, origin);
                }
            };

            // add postMessage receive hook
            $(window).on('message.ddt', function(event) {
                var msg = event.originalEvent;
                if (!msg || !msg.data || !msg.origin || !DOMAIN_REGEX.test(msg.origin)) {
                    return; // not a valid postMessage
                }

                var data;
                try {
                    data = JSON.parse(msg.data);
                } catch (x) {}
                if (!data || !data.ddt || !data.version || window.ddt.version === data.version) {
                    return; // not a DDT postMessage, or already in sync
                }

                window.ddt.version = data.version; // update version
                watched = data.channels; // overwrite watched list
                ddt.log('ddt', 'updated watch list to', 'v' + data.version, 'in', window.name, ddt.watching());
                cookie.sync(data.version); // continue passing the message
            });
        }, 100);
    }

    // generator for proxying to console methods
    var proxy = function(type) {
        if (!(type in console)) {
            console.warn('[ddt] cannot proxy this method, it is not defined in console', type);
        }
        return function(name, message, extra) {
            if (name.toLowerCase() in watched) {
                var params = Array.prototype.slice.call(arguments, 1);
                // reformat the message to include the package name
                params[0] = '[' + name + '] ' + message;
                console[type].apply(console, params);
            }
        }
    };

    window.ddt = {
        // counter to keep track of the "version" of the channels list
        // used to keep consistentcy between all frames using postMessage
        version: 0

        // set up the ddt -> console proxy methods.
        ,log: proxy('log')
        ,info: proxy('info')
        ,warn: proxy('warn')
        ,error: proxy('error')

        ,trace: function(name, message, extra) {
            if (ddt.watching(name)) {
                ddt.log.apply(ddt, arguments);
                console.trace();
            }
        }
        ,watch: function(name, _bulk) {
            if (!name) {
                return false;
            } else if (name instanceof Array) {
                for (var p in name) {
                    window.ddt.watch(name[p], true);
                }
                cookie.set();
            } else {
                if (!/^[a-zA-Z]+$/.test(name)) {
                    console.warn('[ddt] attempted to watch invalid package', name);
                    return false;
                }
                watched[name.toLowerCase()] = true;
                if (!_bulk) {
                    cookie.set();
                }
            }
            return true;
        }
        ,unwatch: function(name, _bulk) {
            if (!name) {
                console.warn('[ddt] need a package name');
                return false;
            } else if (name instanceof Array) {
                for (var p in name) {
                    window.ddt.unwatch(name[p], true);
                }
                cookie.set();
            } else {
                if (!/^[a-zA-Z]+$/.test(name)) {
                    console.warn('[ddt] attempted to watch invalid package', name);
                    return false;
                }
                name = name.toLowerCase();
                if (name in watched) {
                    delete watched[name];
                }
                if (!_bulk) {
                    cookie.set();
                }
            }
            return true;
        }
        ,watching: function(name) {
            if (name) {
                return name.toLowerCase() in watched;
            }
            var w = [];
            for (var p in watched) {
                w.push(p);
            }
            return w;
        }
    };

    var saved = cookie.get();
    if (saved) {
        if (saved instanceof Array && saved.length) {
            // this will always refresh the cookie
            window.ddt.watch(saved);
            if (!IN_IFRAME) {
                console.log('[ddt] watching', window.ddt.watching());
            }
        } else {
            cookie.del();
        }
    }

})(window);
