const confFile = require('../../../server.json'); // (cf stand for ConfigFile)
const defaultConfig = require('./misc/defaultConfig.json');
const superagent = require('superagent');

const useRemoteConf = cf.remoteConfig.useRemoteConfig;
const confData;

const cachedConfig = {};

if(useRemoteConf) {
    let { body } = superagent
        .get(confFile.remoteConfig.remoteConfigURL);
    confData = body
} else {
    confData = confFile;
}

class Config {
    getElements(category) {
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