const DataPacket = require("./DataPacket");
const ProtocolInfo = require("../Info");

const BinaryStream = require("../NetworkBinaryStream");

const Logger = require("../../../logger/Logger");

const Utils = require("../../../utils/Utils");
const Isset = require("../../../utils/methods/Isset");

class LoginPacket extends DataPacket {

    /** @type {string} */
    username = '';
    protocol;
    constructor() {
        super();
        this.initVars();
    }

    static getId() {
        return ProtocolInfo.LOGIN_PACKET;
    }

    initVars() {
        this.username = "";
        this.protocol = 0;
        this.clientUUID = "";
        this.clientId = 0;
        this.xuid = "";
        this.identityPublicKey = "";
        this.serverAddress = "";
        this.locale = "";

        this.chainData = [];
        this.clientDataJwt = "";
        this.clientData = [];

        this.skipVerification = false;
    }

    canBeSentBeforeLogin() {
        return true;
    }

    mayHaveUnreadBytes() {
        return this.protocol !== null && this.protocol !== ProtocolInfo.PROTOCOL;
    }

    _decodePayload() {

        this.protocol = this.readInt();

        try {
            this.decodeConnectionRequest();
        } catch (e) {

            if (this.protocol === ProtocolInfo.PROTOCOL) {
                //throw e;
                console.log("LoginPacket => same protocol: [CLIENT: => " + this.protocol + " / SERVER => " + ProtocolInfo.PROTOCOL + " ]");
            }

            console.log(this.constructor.name + " was thrown while decoding connection request in login (protocol version " + (this.protocol));
        }

    }

    decodeConnectionRequest() {
        let buffer = new BinaryStream(this.read(this.readUnsignedVarInt()));
        this.chainData = JSON.parse(buffer.read(buffer.readLInt()).toString());

        let hasExtraData = false;
        this.chainData["chain"].forEach(chain => {
            let webtoken = Utils.decodeJWT(chain);

            if (Isset(webtoken["extraData"])) {

                if (hasExtraData) {
                    // error to handle
                    console.log("Found 'extraData' multiple times in key chain");
                }

                hasExtraData = true;

                if (Isset(webtoken["extraData"]["displayName"])) {
                    this.username = webtoken["extraData"]["displayName"];
                }
                if (Isset(webtoken["extraData"]["identity"])) {
                    this.clientUUID = webtoken["extraData"]["identity"];
                }
                if (Isset(webtoken["extraData"]["XUID"])) {
                    this.xuid = webtoken["extraData"]["XUID"];
                }
            }

            if (Isset(webtoken["identityPublicKey"])) {
                this.identityPublicKey = webtoken["identityPublicKey"];
            }

        });

        this.clientDataJwt = buffer.read(buffer.readLInt()).toString();
        this.clientData = Utils.decodeJWT(this.clientDataJwt);

        this.clientId = this.clientData["ClientRandomId"] || null;
        this.serverAddress = this.clientData["ServerAddress"] || null;

        this.locale = this.clientData["LanguageCode"] || null;
    }

    _encodePayload() {
        //TODO
    }

    handle(session) {
        return session.handleLogin(this);
    }
}

module.exports = LoginPacket;