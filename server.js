var http = require('http');
var httpProxy = require('http-proxy');
var NodeCache = require('node-cache');
var request = require('request');
var replace = require('stream-replace');
var _ = require('lodash');
var concat = require('concat-stream');

// convenience vars for config values
var sourceUrl = process.env.PROXY_BASE; // config.relay_source.base_url_plain;
var targetUrl = process.env.TARGET_BASE; // config.base_url_plain;
var cacheFreq = process.env.LIFETIME_SECS; // config.cache.lifetime;
var noCache   = process.env.DO_NOT_CACHE;
// pattern to match URL requests that should have their response text
// subject to URL string substitution
var urlTrans  = process.env.URL_TRANSLATE;
var port = process.env.PORT || 8080;

var proxy = httpProxy.createProxy({ target: sourceUrl });
var cache = new NodeCache({ checkperiod: cacheFreq, useClones: false });

setInterval(function() {
  console.log('CACHE STATS: ', cache.getStats());
}, 60000);

// regex used to rewrite URLs in proxied content from original base_url_plain
// to proxy base_url_plain, facilitating ts file downloads through proxy
var replace_re = new RegExp(sourceUrl, 'ig');
var nocache_re = new RegExp(noCache, 'i');
var tr_url_re  = new RegExp(urlTrans, 'i');

srv = http.createServer(function(req, res) {
  console.log('REQ: ', req.url);

  /*  if (req.url.indexOf('m3u8') != -1) {
      // do not cache the radio.m3u8 file, which changes often
      //XXX eventually just respect the minimal Cache-Control max-age?
      http.get(sourceUrl + req.url, function(proxy_res) {
        _.each(proxy_res.headers, function(value, key) {
          res.setHeader(key, value);
        });

        proxy_res.pipe(replace(replace_re, config.base_url_plain))
        .pipe(res);
      }).on('error', function(e) {
        // uncached & error reaching proxy's upstream source
        console.log('Error reaching upstream', e);
        res.writeHead(502, 'Bad Gateway', {
          'Content-Type': 'text/plain',
        });
        res.end();
      });
    } else { */
  cache.get(req.url, function(err, value) {
      if (err) {
        console.log('Error with cache, just proxying: ', err);
        proxy.web(req, res);
        return;
      }

      if (value == undefined) {

        http.get(sourceUrl  + req.url, function(proxy_res) {
          var proxy_res_tr = proxy_res;
          var url_sub = req.url.match(tr_url_re)

          _.each(proxy_res.headers, function(value, key) {
	      if(!(url_sub && key.match(/content-length/i))) {
		  res.setHeader(key, value);
	      }
          });

	  if(url_sub) {
          // url substitution
            proxy_res_tr = proxy_res.pipe(replace(replace_re, targetUrl));
          }

          proxy_res_tr.pipe(concat(function(data) {
            // cache proxy result
            if (!req.url.match(nocache_re)) {
              cache.set(req.url, { headers: proxy_res.headers, body: data }, cacheFreq,
                    function(err, success) {
                      if (!err && success) {
                        console.log('Cached ', req.url);
                      } else {
                        console.log('Error caching ' + req.url, err);
                      }
                    });
            }

            try {
              res.write(data);

            } catch (x) {
              console.error('Error with ' + req.url);
            }

            res.end();
          }));

        }).on('error', function(e) {
          // uncached & error reaching proxy's upstream source
          console.log('Error reaching upstream', e);
          res.writeHead(502, 'Bad Gateway', {
            'Content-Type': 'text/plain',
          });
          res.end();
        });

//              proxy.web(req,res);
      } else {
        console.log('Serving cache for ' + req.url);
        _.each(value.headers, function(value, key) {
          res.setHeader(key, value);
        });

        try {
          res.write(value.body);
        } catch (x) {
          console.error('Error sending ' + req.url);
        }

        res.end();
      }
    });

  //  }
}).listen(port);

console.log('Started up. Listening on port ' + port);
