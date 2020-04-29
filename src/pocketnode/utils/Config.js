// TODO: return defaultConfiguration if not found
const superagent = require("superagent");
const fs = require('fs');
const logger = require('../logger/Logger');

const bannedIpsPath = "../../../banned-ips.json";
const bannedNamesPath = "../../../banned-names.json";
const opsPath = "../../../ops.json";
const whitelistPath = "../../../whitelist.json";


const confFile = require("../../../server.json");
// const defaultConfig = require("./misc/defaultConfig.json");
const bannedIps = require(bannedIpsPath);
const bannedNames = require(bannedNamesPath);
const ops = require(opsPath);
const whitelist = require(whitelistPath);


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

function write(file, data){
    fs.writeFile(file, JSON.stringify(data), err =>{
        if(err) throw(err);
    });
}

class Config {
    /**
     * 
     * @param {string} category - Accepted values ops, bannedIps, bannedNames, whitlist and config
     * @param {string} mode - 
     * @param {*} content 
     */
    RWConf(category, mode, content) {
        mode = mode.toLocaleLowerCase();
        category = category.toLocaleLowerCase();

        if(!category) return;
        if(mode != 'r' | 'w') return;

        if(mode == 'r') {
            switch(category) {
                case "ops":
                    return ops;
                
                case "bannedIps":
                    return bannedIps;

                case "bannedNames":
                    return bannedNames;

                case "whitelist":
                    return bannedNames;
                
                case "config":
                    return confData;

                default:
                    return;
            }
        } else {
            if(!content) return;

            switch(category) {
                case "ops":
                    write(opsPath, content);
                    return;
                
                case "bannedIps":
                    write(bannedIpsPath, content);
                    return;

                case "bannedNames":
                    write(bannedNamesPath, content);
                    return;

                case "whitelist":
                    write(whitelistPath, content);
                    return;

                default:
                    return;
            }
        }
    }
}
module.exports = Config;