const DataPacket = require("./DataPacket");
const ProtocolInfo = require("../Info");
const fs = require('fs');

class StartGamePacket extends DataPacket {
    static getId() {
        return ProtocolInfo.START_GAME_PACKET;
    }

    _encodePayload() {
        // int64 = varLong
        // int32 = varInt

        this.writeVarLong(1);
        this.writeUnsignedVarLong(1);

        this.writeVarInt(0); // game mode

        // vector 3
        this.writeLFloat(0);
        this.writeLFloat(4);
        this.writeLFloat(0);

        this.writeLFloat(0);
        this.writeLFloat(0);

        this.writeVarInt(0);
        this.writeVarInt(0); // dimension
        this.writeVarInt(2); // generator
        this.writeVarInt(0);
        this.writeVarInt(1); // difficulty

        // world spawn vector 3
        this.writeVarInt(0);
        this.writeUnsignedVarInt(4);
        this.writeVarInt(0);

        this.writeByte(1); // achievement disabled

        this.writeVarInt(0); // day cycle / time
        this.writeVarInt(0); // edu edition offer
        this.writeByte(0); // edu features

        this.writeLFloat(0); // rain lvl
        this.writeLFloat(0); // lightning lvl

        this.writeByte(0); // confirmed platform locked
        this.writeByte(1); // multi player game
        this.writeByte(1); // broadcast to lan

        this.writeVarInt(0); // xbl broadcast mode
        this.writeVarInt(0); // platform broadcast mode

        this.writeByte(1); // commands enabled
        this.writeByte(0); // texture required

        this.writeUnsignedVarInt(0); // game rules length
        // this.writeGameRules(this.gameRules);

        this.writeByte(0); // bonus chest
        this.writeByte(0); // start with chest

        this.writeVarInt(1); // player perms

        this.writeLInt(0); // chunk tick range
        this.writeByte(0); // locked behavior
        this.writeByte(0); // locked texture
        this.writeByte(0); // from locked template
        this.writeByte(0); // msa gamer tags only
        this.writeByte(0); // from world template
        this.writeByte(0); // world template option locked
        this.writeByte(1); // only spawn v1 villagers

        this.writeString('1.14.0'); // vanilla version
        this.writeString(''); // random level uuid
        this.writeString('test'); // world name
        this.writeString(''); // template content identity

        this.writeByte(0); // is trial
        this.writeByte(0); // server auth movement
        this.writeLong(0); // level time

        this.writeVarInt(0); // enchantment seed

        // TODO: block states
        // let blocks = fs.readFileSync(__dirname + '/../../../resources/blocks.nbt');
        // let buf = Buffer.from(blocks, 'base64');
        // this.append(buf);

        this.writeVarInt(0); // item length
        this.writeString('');
    }
}

module.exports = StartGamePacket;