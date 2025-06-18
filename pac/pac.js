var PROXY = "SOCKS5 $host$:10809; SOCKS $host$:10809; DIRECT;";

var white = [
    // "store.steampowered.com",
    "*.vrchat.com",
    "*.vrchat.cloud"
];


var domains = [
    "community.akamai.steamstatic.com",
    "githubusercontent.com",
    "stackoverflow.com",
    "cloudfront.net",
    "akamaihd.net",
    "dmm.co.jp",
    "*.facebook.com",
    "*.beatsaver.com",  
    "license.tuanjie.cn",
    "githubcopilot.com",
    $domains$
];



function FindProxyForURL(url, host) {
    for (var i = white.length - 1; i >= 0; i--) {
        if (dnsDomainIs(host, white[i])) {
            return "DIRECT";
        }
    }
    for (var i = domains.length - 1; i >= 0; i--) {
        if (dnsDomainIs(host, domains[i])) {
            return PROXY;
        }
    }
    return "DIRECT";
}