// TODO: Adding way to get ops, banneds-ips, banned-names and whitelist
const confFile = require('../../../server.json');
const defaultConfig = require('./misc/defaultConfig.json');
const superagent = require('superagent');

const useRemoteConf = confFile.remoteConfig.useRemoteConfig;
let confData;

let cachedConfig = {};

if(useRemoteConf) {
    let { body } = superagent
        .get(confFile.remoteConfig.remoteConfigURL);
    confData = body
} else {
    confData = confFile;
}

class Config {
    getElement(category) {
        if(!category) return;

        switch(category) {
            case "server":
                return confData.server;
            
            case "world":
                return confData.world;

            case "network":
                return confData.network;

            case "misc":
                return confData.misc;
            
            case "raw":
                return confData;

            default:
                return;
        }
    }
}
module.exports = Config;