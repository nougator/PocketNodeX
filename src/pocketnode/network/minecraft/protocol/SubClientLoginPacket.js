const DataPacket = require("./DataPacket");
const MinecraftInfo = require("../Info");

class SubClientLoginPacket extends DataPacket {
    static getId() {
        return MinecraftInfo.SUB_CLIENT_LOGIN_PACKET;
    }

    initVars(){
        this.connectionRequestData = "";
    }

    constructor(){
        super();
        this.initVars();
    }

    _decodePayload() {
        this.connectionRequestData = this.readString();
    }

    _encodePayload() {
        this.writeString(this.connectionRequestData);
    }

    handle(session) {
        return session.handleSubClientLogin(this);
    }
}
module.exports = SubClientLoginPacket;