const OfflineMessage = require("./OfflineMessage");
const MessageIdentifiers = require("./MessageIdentifiers");

class OpenConnectionRequest1 extends OfflineMessage {
    constructor(stream) {
        super(stream);
        this.initVars();
    }

    static getId() {
        return MessageIdentifiers.ID_OPEN_CONNECTION_REQUEST_1;
    }

    initVars() {
        this.protocolVersion = -1;
        this.mtuSize = -1;
    }

    decodePayload() {
        this.readMagic();
        this.protocolVersion = this.getStream().readByte();
        this.mtuSize = this.getBuffer().slice(this.getStream().getOffset()).length + 18;
    }
}

module.exports = OpenConnectionRequest1;