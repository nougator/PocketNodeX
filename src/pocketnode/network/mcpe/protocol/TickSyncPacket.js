const DataPacket = require("./DataPacket");
const ProtocolInfo = require("../Info");

const Vector3 = require("../../../math/Vector3");

class TickSyncPacket extends DataPacket {
    static getId() {
        return ProtocolInfo.TICK_SYNC_PACKET;
    }

    /** @type {number} */
    clientSendTime;
    /** @type {number} */
    serverReceiveTime;

    _decodePayload() {
        this.clientSendTime = this.readLLong();
        this.serverReceiveTime = this.readLLong();
    }

    _encodePayload() {
        this.writeLLong(this.clientSendTime);
        this.writeLLong(this.serverReceiveTime);
    }

    handle(session) {
        return session.handleTickSync(this);
    }
}

module.exports = TickSyncPacket;