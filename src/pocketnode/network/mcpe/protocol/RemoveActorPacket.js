const DataPacket = require("./DataPacket");
const ProtocolInfo = require("../Info");

class RemoveActorPacket extends DataPacket {

    constructor() {
        super();
        this.initVars();
    }

    getId() {
        return ProtocolInfo.REMOVE_ACTOR_PACKET;
    }

    initVars() {
        /** @type {number} */
        this.entityUniqueId = -1;
    }

    _decodePayload() {
        this.entityUniqueId = this.getEntityUniqueId();
    }

    _encodePayload() {
        this.writeEntityUniqueId(this.getEntityUniqueId());
    }

    handle(session) {
        return session.handleRemoveActor(this);
    }
}

module.exports = RemoveActorPacket;