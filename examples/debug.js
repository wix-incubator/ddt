(function(ddt) {

var  watching = document.querySelectorAll('p.ddt-watching span')
    ,monkeyPatch = function (that, method, func) {
        var orig = that[method];
        return function() {
            var  ret = orig.apply(that, arguments)
                ,channels = ddt.watching().join(', ')
                ,i;
            console.log('ddt.' + method + ' has been called in', String(window.name || window.location), 'at', (new Date().getTime()));
            for (i = 0; i < watching.length; i++) {
                watching[i].textContent = channels;
            }
            return ret;
        };
    };

// patch methods that modify channels
ddt.watch = monkeyPatch(ddt, 'watch');
ddt.reset = monkeyPatch(ddt, 'reset');
ddt.unwatch = monkeyPatch(ddt, 'unwatch');

// trigger refresh
ddt.watch();

})(window.ddt);
