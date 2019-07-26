const DataPacket = require("./DataPacket");
const MinecraftInfo = require("../Info");

class SetDefaultGameTypePacket extends DataPacket {
    static getId() {
        return MinecraftInfo.SET_DEFAULT_GAME_TYPE_PACKET;
    }

    initVars(){
        this.gamemode = -1;
    }

    constructor(){
        super();
        this.initVars();
    }

    _decodePayload() {
        this.gamemode = this.readVarInt();
    }

    _encodePayload() {
        this.writeUnsignedVarInt(this.gamemode);
    }

    handle(session){
        return session.handleSetDefaultGameType(this);
    }
}

module.exports = SetDefaultGameTypePacket;