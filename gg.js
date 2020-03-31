const Packet = require("../protocol/Packet");

const RakNet = require("../RakNet");
const BinaryStream = require("../../binarystream/BinaryStream");

const Datagram = require("../protocol/Datagram");
const EncapsulatedPacket = require("../protocol/EncapsulatedPacket");
const ConnectionRequest = require("../protocol/ConnectionRequest");
const ConnectionRequestAccepted = require("../protocol/ConnectionRequestAccepted");
const NewIncomingConnection = require("../protocol/NewIncomingConnection");
const ConnectedPing = require("../protocol/ConnectedPing");
const ConnectedPong = require("../protocol/ConnectedPong");
const DisconnectionNotification = require("../protocol/DisconnectionNotification");
const InternetAddress = require('../utils/InternetAddress');

const PacketReliability = require("../protocol/PacketReliability");

const ACK = require("../protocol/ACK");
const NACK = require("../protocol/NACK");

const RecoveryQueue = require("../server/queues/RecoveryQueue");
const ACKQueue = require("../server/queues/ACKQueue");
const NACKQueue = require("../server/queues/NACKQueue");
const SplitQueue = require("../server/queues/SplitQueue");
const PacketBatchHolder = require("../server/queues/PacketBatchHolder");

const MessageIdentifiers = require("../protocol/MessageIdentifiers");

class Session {

    static STATE_CONNECTING = 0;
    static STATE_CONNECTED = 1;
    static STATE_DISCONNECTING = 2;
    static STATE_DISCONNECTED = 3;

    static MIN_MTU_SIZE = 400;

    static MAX_SPLIT_SIZE = 128;
    static MAX_SPLIT_COUNT = 4;

    static CHANNEL_COUNT = 32;

    static WINDOW_SIZE;

    /** @type {number} */
    _messageIndex = 0;

    /** @type {number[]} */
    _sendOrderedIndex = [];
    /** @type {number[]} */
    _sendSequencedIndex = [];
    /** @type {number[]} */
    _receiveOrderedIndex = [];
    /** @type {number[]} */
    _receiveSequencedHighestIndex = [];
    /** @type {EncapsulatedPacket[][]} */
    _receiveOrderedPackets = [];

    _sessionManager;

    /** @type {InternetAddress} */
    _address;

    /** @type {number} */
    _state = Session.STATE_CONNECTING;
    /** @type {number} */
    _mtuSize;
    /** @type {number} */
    _id;
    /** @type {number} */
    _splitID;

    /** @type {number} */
    _sendSeqNumber = 0;

    /** @type {number} */
    _lastUpdate;
    /** @type {number} */
    _disconnectionTime;

    /** @type {boolean} */
    _isTemporal = true;

    /** @type {Datagram[]} */
    _packetToSend = [];
    /** @type {boolean} */
    _isActive = false;

    /** @type {ACKQueue} */
    _ACKQueue = new ACKQueue();
    /** @type {NACKQueue} */
    _NACKQueue = new NACKQueue();

    /** @type {RecoveryQueue} */
    _recoveryQueue = new RecoveryQueue();

    /** @type {number[][]} */
    _splitPackets = [];

    /** @type {number[][]} */
    _needACK = [];

    /** @type {Datagram} */
    _sendQueue;

    /** @type {number} */
    _windowStart;
    /** @type {number} */
    _windowEnd;
    /** @type {number} */
    _highestSeqNumber = -1;

    /** @type {number} */
    _reliableWindowStart;
    /** @type {number} */
    _reliableWindowEnd;
    /** @type {boolean[][]} */
    _reliableWindow = [];

    /** @type {number} */
    _lastPingTime = -1;
    /** @type {number} */
    _lastPingMeasure = 1;

    /** @type {PacketBatchHolder} */
    _packetBatches = new PacketBatchHolder();

    /**
     * @param sessionManager
     * @param address {InternetAddress}
     * @param clientId {number}
     * @param mtuSize {number}
     */
    constructor(sessionManager, address, clientId, mtuSize) {
        if (mtuSize < Session.MIN_MTU_SIZE) {
            throw new Error(`MTU size must be at least ${Session.MIN_MTU_SIZE}, got ${mtuSize}`);
        }
        this._sessionManager = sessionManager;
        this._address = address;
        this._id = clientId;
        this._sendQueue = new Datagram();

        this._lastUpdate = Date.now();
        this._windowStart = 0;
        this._windowEnd = Session.WINDOW_SIZE;

        this._reliableWindowStart = 0;
        this._reliableWindowEnd = Session.WINDOW_SIZE;

        this._sendOrderedIndex.fill(0, 0, Session.CHANNEL_COUNT);
        this._sendSequencedIndex.fill(0, 0, Session.CHANNEL_COUNT);

        this._receiveOrderedIndex.fill(0, 0, Session.CHANNEL_COUNT);
        this._receiveSequencedHighestIndex.fill(0, 0, Session.CHANNEL_COUNT);

        this._receiveOrderedPackets.fill([], 0, Session.CHANNEL_COUNT);

        this._mtuSize = mtuSize;

        /* this.initVars();
        this.sessionManager = sessionManager;

        this.address = address;
        this.port = port;
        this.clientId = clientId;
        this.mtuSize = mtuSize;

        this.setSendQueue();

        this.lastUpdate = Date.now(); */
    }

    // initVars() {
    //     this.sessionManager = {};
    //
    //     this.address = "";
    //     this.port = -1;
    //     this.state = Session.STATE_CONNECTING;
    //     this.mtuSize = -1;
    //     this.clientId = -1;
    //
    //     this.lastSequenceNumber = -1;
    //     this.currentSequenceNumber = 0;
    //
    //     this.messageIndex = 0;
    //     this.channelIndex = [];
    //
    //     this.splitId = 0;
    //
    //     this.lastUpdate = 0;
    //     this.disconnectionTime = -1;
    //
    //     this.isActive = false;
    //
    //     this.packetsToSend = [];
    //
    //     this._sendQueue = {};
    //     this.recoveryQueue = new RecoveryQueue();
    //     this.ACKQueue = new ACKQueue();
    //     this.NACKQueue = new NACKQueue();
    //     this.splitQueue = new SplitQueue();
    //     this.packetBatches = new PacketBatchHolder();
    //
    //     this.lastPingMeasure = 1;
    // }

    // setSendQueue() {
    //     this._sendQueue = new Datagram();
    //     this._sendQueue.needsBAndAs = true;
    // }

    // getAddress() {
    //     return this.address;
    // }
    //
    // getPort() {
    //     return this.port;
    // }

    /**
     * @return {InternetAddress}
     */
    getAddress() {
        return this._address.getIp();
    }

    /**
     * @return {number}
     */
    getID() {
        return this._id;
    }

    /**
     * @return {number}
     */
    getState() {
        return this._state;
    }

    /**
     * @return {boolean}
     */
    isTemporal() {
        return this._isTemporal;
    }

    /**
     * @return {boolean}
     */
    isConnected() {
        return this._state !== Session.STATE_DISCONNECTING && this._state !== Session.STATE_DISCONNECTED;
    }

    // getClientId() {
    //     return this.clientId;
    // }
    //
    // isConnecting() {
    //     return this.state === Session.STATE_CONNECTING;
    // }
    //
    // isConnected() {
    //     return this.state !== Session.STATE_DISCONNECTING && this.state !== Session.STATE_DISCONNECTED;
    // }

    // setConnected() {
    //     this.state = Session.STATE_CONNECTED;
    //     this.lastUpdate = Date.now();
    //     this.sessionManager.getLogger().debug(this + " is now connected.");
    // }

    update(time) {
        // if (!this._isActive && (this._lastUpdate + 10) < time) {
        //     this.disconnect('timeout');
        //
        //     return;
        // }
        //
        // if (this.state === Session.STATE_DISCONNECTING && (
        //     this._ACKQueue.length === 0 && this._NACKQueue.length === 0 && this._packetToSend.length === 0 && this._recoveryQueue === 0 ||
        //     this._disconnectionTime + 10 < time)
        // ){
        //     this.close();
        //     return;
        // }
        //
        // this._isActive = true;
        //
        // let diff = this._highestSeqNumber - this._windowStart + 1;
        // if (diff > 0) {
        //     this._windowStart += diff;
        //     this._windowEnd += diff;
        // }
        //
        // if (this._ACKQueue.length > 0) {
        //     let pk = new ACK();
        //     pk.packets = this._ACKQueue;
        //     this.sendPacket(pk);
        //     this._ACKQueue = [];
        // }
        //
        // if (this._NACKQueue.length > 0) {
        //     let pk = new ACK();
        //     pk.packets = this._NACKQueue;
        //     this.sendPacket(pk);
        //     this._NACKQueue = [];
        // }
        //
        // if (this._packetToSend.length > 0) {
        //     let limit = 16;
        //     for (let [k, pk] of Object.entries(this._packetToSend)) {
        //         this.sendDatagram(pk);
        //         let index = this._packetToSend.indexOf(k);
        //         if (index !== -1) this._packetToSend.splice(index, 1);
        //
        //         if (limit-- <= 0) {
        //             break;
        //         }
        //     }
        //
        //     if (this._packetToSend.length > Session.WINDOW_SIZE) {
        //         this._packetToSend = [];
        //     }
        // }
        //
        // if (this._needACK.length > 0) {
        //     for (let [identifierACK, indexes] of Object.entries(this._needACK)) {
        //         if (indexes.length === 0) {
        //             let index = this._needACK.indexOf(identifierACK);
        //             if (index !== -1) this._needACK.splice(index, 1);
        //
        //             // this._sessionManager.notifyACK
        //             // TODO: send ACK
        //         }
        //     }
        // }
        //
        // for (let [seq, pk] of Object.entries(this._recoveryQueue)) {
        //     if (pk.sendTime < (Date.now() - 8)) {
        //         this._packetToSend.push(pk);
        //         let index = this._recoveryQueue.indexOf(seq);
        //         if (index !== -1) this._recoveryQueue.splice(index, 1);
        //     }else{
        //         break;
        //     }
        // }
        //
        // if (this._lastPingTime + 5 < time) {
        //     this.sendPing();
        //     this._lastPingTime = time;
        // }
        //
        // this.sendQueue();

        if (!this._isActive && (this._lastUpdate + 10000) < time) {
            this.disconnect("timeout");

            return;
        }

        if (this._state === Session.STATE_DISCONNECTING && (
            (this._ACKQueue.isEmpty() && this._NACKQueue.isEmpty() && this._packetToSend.length === 0 && this._recoveryQueue.isEmpty()) ||
            this._disconnectionTime + 10 < time)
        ) {
            this.close();
            return;
        }

        this.isActive = false;

        if (!this._ACKQueue.isEmpty()) {
            let pk = new ACK();
            pk.packets = this._ACKQueue.getAll();
            this.sendPacket(pk);
            this._ACKQueue.clear();
        }

        if (!this._NACKQueue.isEmpty()) {
            let pk = new NACK();
            pk.packets = this._NACKQueue.getAll();
            this.sendPacket(pk);
            this._NACKQueue.clear();
        }

        if (this._packetToSend.length > 0) {
            let limit = 16;
            for (let pk in this._packetToSend) {
                if (this._packetToSend.hasOwnProperty(pk)) {
                    this.sendDatagram(this._packetToSend[pk]);
                    let index = this._packetToSend.indexOf(pk);
                    if (index !== -1) this._packetToSend.splice(index, 1);

                    if (--limit <= 0) {
                        break;
                    }
                }
            }
        }

        if (this._lastPingTime + 5000 < time) {
            this.sendPing();
            this._lastPingTime = time;
        }

        this.sendQueue();
    }

    close() {
        if (this.state !== Session.STATE_DISCONNECTED) {
            this.state = Session.STATE_DISCONNECTED;

            this.queueConnectedPacket(new DisconnectionNotification(), PacketReliability.RELIABLE_ORDERED, 0, RakNet.PRIORITY_IMMEDIATE);

            this._sessionManager.getLogger().debug(`Closed session for ${this.toString()}`);
            this._sessionManager.removeSessionInternal(this);
            this._sessionManager = null;
        }
    }

    disconnect(reason = "unknown") {
        this._sessionManager.removeSession(this, reason);
    }

    handlePacket(packet) {
        this._isActive = true;
        this._lastUpdate = Date.now();

        if (packet instanceof Datagram) {
            packet.decode();

            if (packet.sequenceNumber < this._windowStart || packet.sequenceNumber > this._windowEnd || this._ACKQueue.has(packet.sequenceNumber)) {
                console.log(`Received duplicate or out-of-window packet from ${this.getAddress()} (sequence number ${packet.sequenceNumber}, window ${this._windowStart} - ${this._windowEnd})`);
                return;
            }

            this._NACKQueue.remove(packet.sequenceNumber);

            this._ACKQueue.set(packet.sequenceNumber, packet.sequenceNumber);
            // this._ACKQueue[packet.sequenceNumber] = packet.sequenceNumber;
            if (this._highestSeqNumber < packet.sequenceNumber) {
                this._highestSeqNumber = packet.sequenceNumber;
            }

            if (packet.sequenceNumber === this._windowStart) {
                for (; this._ACKQueue.has(this._windowStart); this._windowStart++) {
                    this._windowEnd++;
                }
            }else if (packet.sequenceNumber > this._windowStart) {
                for (let i = this._windowStart; i < packet.sequenceNumber; i++) {
                    if (this._ACKQueue.has(i)) {
                        this._ACKQueue.set(i, i);
                    }
                }
            }else{
                assert(false, "received packet before window start");  // TODO: import here assert
            }

            packet.packets.forEach(pk => {
                this.handleEncapsulatedPacket(pk);
            });
        }else{
            if (packet in ACK) {
                packet.decode();
                packet.packets.forEach(seq => {
                    if (typeof this._recoveryQueue[seq] !== 'undefined') {
                        this._recoveryQueue[seq].packets.forEach(pk => {
                            if (pk instanceof EncapsulatedPacket && pk.needACK && pk.messageIndex !== null) {
                                let index = this._needACK[pk.identifierACK].indexOf(pk.messageIndex);
                                if (index !== -1) this._needACK[pk.identifierACK].splice(index, 1);

                            }
                        });
                        let index = this._recoveryQueue.indexOf(seq);
                        if (index !== -1) this._recoveryQueue.splice(index, 1);
                    }
                });
            }else if (packet instanceof NACK) {
                packet.decode();
                packet.packets.forEach(seq => {
                    if (typeof this._recoveryQueue[seq] !== 'undefined') {
                        this._packetToSend.push(this._recoveryQueue[seq]);
                        let index = this._recoveryQueue.indexOf(seq);
                        if (index !== -1) this._recoveryQueue.splice(index, 1);
                    }
                });
            }
        }



        // this.isActive = true;
        // this.lastUpdate = Date.now();
        //
        // if (packet instanceof Datagram || packet instanceof ACK || packet instanceof NACK) {
        //     //this.sessionManager.getLogger().debug("Got " + protocol.constructor.name + "(" + protocol.stream.buffer.toString("hex") + ") from " + this);
        // }
        //
        // if (packet instanceof Datagram) {
        //     packet.decode();
        //
        //     let diff = packet.sequenceNumber - this.lastSequenceNumber;
        //
        //     if (!this.NACKQueue.isEmpty()) {
        //         this.NACKQueue.remove(packet.sequenceNumber);
        //         if (diff !== 1) {
        //             for (let i = this.lastSequenceNumber + 1; i < packet.sequenceNumber; i++) {
        //                 this.NACKQueue.add(i);
        //             }
        //         }
        //     }
        //
        //     this.ACKQueue.add(packet.sequenceNumber);
        //
        //     if (diff >= 1) {
        //         this.lastSequenceNumber = packet.sequenceNumber;
        //     }
        //
        //     packet.packets.forEach(pk => this.handleEncapsulatedPacket(pk));
        // } else {
        //     if (packet instanceof ACK) {
        //         packet.decode();
        //         this.recoveryQueue.recover(packet.packets).forEach(datagram => {
        //             this.recoveryQueue.remove(datagram.sequenceNumber);
        //         });
        //     } else if (packet instanceof NACK) {
        //         packet.decode();
        //         this.recoveryQueue.recover(packet.packets).forEach(datagram => {
        //             this.packetsToSend.push(datagram);
        //             this.recoveryQueue.remove(datagram.sequenceNumber);
        //         });
        //     }
        // }
    }

    /**
     * @param packet {EncapsulatedPacket}
     */
    handleSplit(packet) {
        if (
            packet.splitCount >= Session.MAX_SPLIT_SIZE || packet.splitCount < 0 ||
            packet.splitIndex >= packet.splitCount || packet.splitIndex < 0
        ){
            console.log(`Invalid split packet part from ${this.getAddress()}, too many parts or invalid split index (part index $packet->splitIndex, part count ${packet.splitCount})`);
            return null;
        }

        if (typeof this._splitPackets[packet.splitId] === 'undefined') {
            if (this._splitPackets.length > Session.MAX_SPLIT_COUNT) {
                console.log(`Ignored split packet part from ${this.getAddress()} because reached concurrent split packet limit of ${Session.MAX_SPLIT_COUNT}`);
                return null;
            }
            this._splitPackets[packet.splitId] = [];
            this._splitPackets[packet.splitId].fill(null, 0, packet.splitCount);
        }else if (this._splitPackets[packet.splitId].length !== packet.splitCount) {
            console.log(`Wrong split count ${packet.splitCount} for split packet ${packet.splitId} from ${this.getAddress()}, expected ${this._splitPackets[packet.splitId].length}`);
            return null;
        }

        this._splitPackets[packet.splitId][packet.splitIndex] = packet;

        for (let [splitIndex, part] of Object.entries(this._splitPackets[packet.splitId])) {
            if (part === null) {
                return null;
            }
        }

        let pk = new EncapsulatedPacket();
        pk.reliability = packet.reliability;
        pk.messageIndex = packet.messageIndex;
        pk.sequenceIndex = packet.sequenceIndex;
        pk.orderIndex = packet.orderIndex;
        pk.orderChannel = packet.orderChannel;

        for (let i = 0; i < packet.splitCount; i++) {
            let pack = this._splitPackets[packet.splitId][i];
            if (pack instanceof EncapsulatedPacket) {
                pk.getStream().append(pack.stream.buffer);
            }
        }

        pk.length = pk.getStream().length;
        let index = this._splitPackets.indexOf(packet.splitId);
        if (index !== -1) this._splitPackets.splice(index, 1);

        return pk;
    }

    handleEncapsulatedPacketRoute(packet) {
        if (this._sessionManager === null) {
            return;
        }

        let id = packet.getBuffer()[0];
        if (!(id === 3)) console.log(id);
        if (id < 0x86) { // ID_USER_PACKET_ENUM
            // if (this._state === Session.STATE_CONNECTING) {
            let dpk, pk;
            switch (id) {
                case ConnectionRequest.getId():
                    // this._sessionManager.getLogger().debug("Got ConnectionRequest from " + this._address.getIp());
                    console.log("Got ConnectionRequest from " + this._address.getIp());
                    dpk = new ConnectionRequest(packet.getStream());
                    dpk.decode();

                    this.clientId = dpk.clientId;

                    pk = new ConnectionRequestAccepted();
                    pk.address = this._address.getIp();
                    pk.port = this._address.getPort();
                    pk.sendPingTime = dpk.sendPingTime;
                    pk.sendPongTime = this._sessionManager.getTimeSinceStart();
                    this.queueConnectedPacket(pk, PacketReliability.UNRELIABLE, 0, RakNet.PRIORITY_IMMEDIATE);
                    break;

                case NewIncomingConnection.getId():
                    // this._sessionManager.getLogger().debug("Got NewIncomingConnection from " + this);
                    console.log("Got NewIncomingConnection from " + this);

                    dpk = new NewIncomingConnection(packet.getStream());
                    dpk.decode();

                    if (true || dpk.port === this._sessionManager.getPort()) {//todo: if port checking
                        // this.setConnected();
                        this._state = Session.STATE_CONNECTED;
                        this._lastUpdate = Date.now();

                        this._sessionManager.openSession(this);

                        this.sendPing();
                    }
                    break;

                case ConnectedPing.getId():
                    dpk = new ConnectedPing(packet.getStream());
                    dpk.decode();

                    pk = new ConnectedPong();
                    pk.sendPingTime = dpk.sendPingTime;
                    pk.sendPongTime = this._sessionManager.getTimeSinceStart();
                    this.queueConnectedPacket(pk, PacketReliability.UNRELIABLE, 0);
                    break;

                case ConnectedPong.getId():
                    dpk = new ConnectedPong(packet.getStream());
                    dpk.decode();

                    this.handlePong(dpk.sendPingTime, dpk.sendPongTime);
                    break;

                case DisconnectionNotification.getId():
                    this.disconnect("client disconnect"); //supposed to send ack
                    break;

                case MessageIdentifiers.MINECRAFT_HEADER:
                    this._packetBatches.add(packet);
                    this._sessionManager.getLogger().debug("Got a Minecraft packet");
                    break;

                default:
                    this._packetBatches.add(packet);
                    this._sessionManager.getLogger().debug("Got unknown packet: ", id);
                    break;
            }
            // }
        }
    }

    handleEncapsulatedPacket(packet) {
        // if (packet.stream.buffer[0] === 0xfe) this._packetBatches.add(packet); // todo
        if (packet.messageIndex !== null) {
            if (packet.messageIndex  < this._reliableWindowStart || packet.messageIndex > this._reliableWindowEnd || typeof this._reliableWindow[packet.messageIndex] !== 'undefined') {
                return;
            }

            this._reliableWindow[packet.messageIndex] = true;

            if (packet.messageIndex === this._reliableWindowStart) {
                for (; typeof this._reliableWindow[this._reliableWindowStart] !== 'undefined'; this._reliableWindowStart++) {
                    let index = this._reliableWindow.indexOf(this._reliableWindowStart);
                    if (index !== -1) this._reliableWindow.splice(index, 1);

                    this._reliableWindowEnd++;
                }
            }
        }

        if (packet.hasSplit && (packet = this.handleSplit(packet)) === null) {
            return;
        }

        if (packet.isSequencedOrOrdered() && (packet.orderChannel < 0 || packet.orderChannel >= Session.CHANNEL_COUNT)) {
            console.log(`Invalid packet from ${this.getAddress()}, bad order channel (${packet.orderChannel})`);
            return;
        }

        if (packet.isSequenced()) {
            if (packet.sequenceIndex < this._receiveSequencedHighestIndex[packet.orderChannel] || packet.orderIndex < this._receiveOrderedIndex[packet.orderChannel]) {
                // too old sequenced packet, discard it
                return;
            }

            this._receiveSequencedHighestIndex[packet.orderChannel] = packet.sequenceIndex + 1;
            this.handleEncapsulatedPacketRoute(packet);
        }else if (packet.isOrdered()) {
            if (packet.orderIndex === this._receiveOrderedIndex[packet.orderChannel]) {
                this._receiveSequencedHighestIndex[packet.orderIndex] = 0;
                this._receiveOrderedIndex[packet.orderChannel] = packet.orderIndex + 1;

                this.handleEncapsulatedPacketRoute(packet);
                let i;
                for (i = this._receiveOrderedIndex[packet.orderChannel]; typeof this._receiveOrderedIndex[packet.orderChannel][i] !== 'undefined'; i++) {
                    this.handleEncapsulatedPacketRoute(this._receiveOrderedPackets[packet.orderChannel][i]);
                    let index = this._receiveOrderedPackets[packet.orderChannel].indexOf(i);
                    if (index !== -1) this._receiveOrderedPackets[packet.orderChannel].splice(index, 1);

                }

                this._receiveOrderedIndex[packet.orderChannel] = i;
            }else if (packet.orderIndex > this._receiveOrderedIndex[packet.orderChannel]) {
                this._receiveOrderedPackets[packet.orderChannel][packet.orderIndex] = packet;
            }else{
                // duplicate / already received packet
            }
        }else{
            // not ordered or sequenced
            this.handleEncapsulatedPacketRoute(packet);
        }

        // if (!(packet instanceof EncapsulatedPacket)) {
        //     throw new TypeError("Expecting EncapsulatedPacket, got " + (packet.constructor.name ? packet.constructor.name : packet));
        // }
        //
        // //this.sessionManager.getLogger().debug("Handling EncapsulatedPacket("+protocol.getBuffer().toString("hex")+")["+protocol.getBuffer().length+"] from "+this);
        //
        // if (packet.hasSplit) {
        //     if (this.isConnected()) {
        //         this.handleSplitPacket(packet);
        //     }
        //     return;
        // }
        //
        // let id = packet.getBuffer()[0];
        // let dpk, pk;
        // switch (id) {
        //     case ConnectionRequest.getId():
        //         this.sessionManager.getLogger().debug("Got ConnectionRequest from " + this);
        //         dpk = new ConnectionRequest(packet.getStream());
        //         dpk.decode();
        //
        //         this.clientId = dpk.clientId;
        //
        //         pk = new ConnectionRequestAccepted();
        //         pk.address = this.getAddress();
        //         pk.port = this.getPort();
        //         pk.sendPingTime = dpk.sendPingTime;
        //         pk.sendPongTime = this.sessionManager.getTimeSinceStart();
        //         this.queueConnectedPacket(pk, PacketReliability.UNRELIABLE, 0, RakNet.PRIORITY_IMMEDIATE);
        //         break;
        //
        //     case NewIncomingConnection.getId():
        //         this.sessionManager.getLogger().debug("Got NewIncomingConnection from " + this);
        //
        //         dpk = new NewIncomingConnection(packet.getStream());
        //         dpk.decode();
        //
        //         if (true || dpk.port === this.sessionManager.getPort()) {//todo: if port checking
        //             this.setConnected();
        //
        //             this.sessionManager.openSession(this);
        //
        //             this.sendPing();
        //         }
        //         break;
        //
        //     case ConnectedPing.getId():
        //         dpk = new ConnectedPing(packet.getStream());
        //         dpk.decode();
        //
        //         pk = new ConnectedPong();
        //         pk.sendPingTime = dpk.sendPingTime;
        //         pk.sendPongTime = this.sessionManager.getTimeSinceStart();
        //         this.queueConnectedPacket(pk, PacketReliability.UNRELIABLE, 0);
        //         break;
        //
        //     case ConnectedPong.getId():
        //         dpk = new ConnectedPong(packet.getStream());
        //         dpk.decode();
        //
        //
        //         this.handlePong(dpk.sendPingTime, dpk.sendPongTime);
        //         break;
        //
        //     case DisconnectionNotification.getId():
        //         this.disconnect("client disconnect"); //supposed to send ack
        //         break;
        //
        //     case MessageIdentifiers.MINECRAFT_HEADER:
        //         this.packetBatches.add(packet);
        //         this.sessionManager.getLogger().debug("Got a Minecraft packet");
        //         break;
        //
        //     default:
        //         this.packetBatches.add(packet);
        //         this.sessionManager.getLogger().debug("Got unknown packet: ", id);
        //         break;
        // }
    }

    handlePong(ping, pong) {
        this._lastPingMeasure = this._sessionManager.getTimeSinceStart() - ping;
    }

    // handleSplitPacket(packet) {
    //     if (!(packet instanceof EncapsulatedPacket)) {
    //         throw new TypeError("Expecting EncapsulatedPacket, got " + (packet.constructor.name ? packet.constructor.name : packet));
    //     }
    //
    //     if (packet.splitCount >= this.MAX_SPLIT_SIZE || packet.splitIndex >= this.MAX_SPLIT_SIZE || packet.splitIndex < 0) {
    //         return;
    //     }
    //
    //     if (this.splitQueue.size >= this.MAX_SPLIT_COUNT) {
    //         return;
    //     }
    //     this.splitQueue.add(packet);
    //
    //     if (this.splitQueue.getSplitSize(packet.splitId) === packet.splitCount) {
    //         let pk = new EncapsulatedPacket();
    //         let stream = new BinaryStream();
    //         let packets = this.splitQueue.getSplits(packet.splitId);
    //         for (let [splitIndex, packet] of packets) {
    //             stream.append(packet.getBuffer());
    //         }
    //         this.splitQueue.remove(packet.splitId);
    //
    //         pk.stream = stream.flip();
    //         pk.length = stream.offset;
    //
    //         this.handleEncapsulatedPacket(pk);
    //     }
    // }

    sendPacket(pk) {
        if (pk instanceof Packet) {
            this._sessionManager.sendPacket(pk, this._address.getIp(), this._address.getPort());
            return true;
        }
        return false;
    }

    sendDatagram(datagram) {
        if (datagram.sequenceNumber !== null) {
            let index = this._recoveryQueue.indexOf(datagram.sequenceNumber);
            if (index !== -1) this._recoveryQueue.splice(index, 1);

        }
        datagram.sequenceNumber = this._sendSeqNumber++;
        datagram.sendTime = Date.now();
        this._recoveryQueue[datagram.sequenceNumber] = datagram;

        // if (!(datagram instanceof Datagram)) {
        //     throw new TypeError("Expecting Datagram, got " + (datagram.constructor.name ? datagram.constructor.name : datagram));
        // }

        // if (datagram.sequenceNumber !== null) {
        //     this.recoveryQueue.remove(datagram.sequenceNumber);
        // }
        // datagram.sequenceNumber = this.currentSequenceNumber++;
        // datagram.sendTime = Date.now();
        // this.recoveryQueue.addRecoveryFor(datagram);
        this.sendPacket(datagram);
    }

    sendPing(reliability = PacketReliability.UNRELIABLE) {
        let pk = new ConnectedPing();
        pk.sendPingTime = this._sessionManager.getTimeSinceStart();
        this.queueConnectedPacket(pk, reliability, 0, RakNet.PRIORITY_IMMEDIATE);
    }

    queueConnectedPacket(packet, reliability, orderChannel, flags = RakNet.PRIORITY_NORMAL) {
        packet.encode();

        let pk = new EncapsulatedPacket();
        pk.reliability = reliability;
        pk.orderChannel = orderChannel;
        pk.stream = new BinaryStream(packet.getBuffer());

        //this.sessionManager.getLogger().debug("Queuing "+packet.constructor.name+"("+packet.getBuffer().toString("hex")+")");

        this.addEncapsulatedToQueue(pk, flags);
    }

    queueConnectedPacketFromServer(packet, needACK, immediate) {
        //console.log(immediate) if immediate it doesnt seem to do anything (client doesnt recieve i think / OR it doesnt do anything with it)
        return this.queueConnectedPacket(packet, (needACK === true ? RakNet.FLAG_NEED_ACK : 0) | (immediate === true ? RakNet.PRIORITY_IMMEDIATE : RakNet.PRIORITY_NORMAL));
    }

    addEncapsulatedToQueue(packet, flags) {
        if ((packet.needACK = (flags & RakNet.FLAG_NEED_ACK) > 0) === true) {
            this._needACK[packet.identifierACK] = [];
        }

        if (packet.isOrdered()) {
            packet.orderIndex = this._sendOrderedIndex[packet.orderChannel]++;
        }else if (packet.isSequenced()) {
            packet.orderIndex = this._sendOrderedIndex[packet.orderChannel];
            packet.sequenceIndex = this._sendSequencedIndex[packet.orderChannel]++;
        }

        let maxSize = this._mtuSize - 60;
        if (packet.getBuffer().length > maxSize) {
            let buffers = str_split(packet.getBuffer(), maxSize);
            let bufferCount = packet.getBuffer().length;

            let splitID = this._splitID++ % 65536;
            for (let [count, buffer] of Object.entries(buffers)) {
                let pk = new EncapsulatedPacket();
                pk.splitId = splitID;
                pk.hasSplit = true;
                pk.splitCount = bufferCount;
                pk.reliability = packet.reliability;
                pk.splitIndex = count;
                pk.getStream().append(buffer);

                if (pk.isReliable()) {
                    pk.messageIndex = this._messageIndex++;
                }

                pk.sequenceIndex = packet.sequenceIndex;
                pk.orderChannel = packet.orderChannel;
                pk.orderIndex = packet.orderIndex;

                this.addToQueue(pk, flags | RakNet.PRIORITY_IMMEDIATE);
            }
        }else{
            if (packet.isReliable()) {
                packet.messageIndex = this._messageIndex++;
            }
            this.addToQueue(packet, flags);
        }


        // if (!(packet instanceof EncapsulatedPacket)) {
        //     throw new TypeError("Expecting EncapsulatedPacket, got " + (packet.constructor.name ? packet.constructor.name : packet));
        // }
        //
        // if (packet.isReliable()) {
        //     packet.messageIndex = this.messageIndex++;
        // }
        //
        // if (packet.isSequenced()) {
        //     packet.orderIndex = this.channelIndex[packet.orderChannel]++;
        // }
        //
        // let maxSize = this.mtuSize - 60;
        //
        // if (packet.getBuffer().length > maxSize) {
        //     let splitId = ++this.splitId % 65536;
        //     let splitIndex = 0;
        //     let splitCount = Math.ceil(packet.getBuffer().length / maxSize);
        //     while (!packet.getStream().feof()) {
        //         let stream = packet.getBuffer().slice(packet.getStream().offset, packet.getStream().offset += maxSize);
        //         let pk = new EncapsulatedPacket();
        //         pk.splitId = splitId;
        //         pk.hasSplit = true;
        //         pk.splitCount = splitCount;
        //         pk.reliability = packet.reliability;
        //         pk.splitIndex = splitIndex;
        //         pk.stream = stream;
        //
        //         if (splitIndex > 0) {
        //             pk.messageIndex = this.messageIndex++;
        //         } else {
        //             pk.messageIndex = packet.messageIndex;
        //         }
        //
        //         pk.orderChannel = packet.orderChannel;
        //         pk.orderIndex = packet.orderIndex;
        //
        //         this.addToQueue(pk, flags | RakNet.PRIORITY_IMMEDIATE);
        //         splitIndex++;
        //     }
        // } else {
        //     this.addToQueue(packet, flags);
        // }
    }

    /**
     * @param pk {EncapsulatedPacket}
     * @param flags
     */
    addToQueue(pk, flags = RakNet.PRIORITY_NORMAL) {
        let priority = flags & 0x07;
        if (pk.needACK && pk.messageIndex !== null) {
            this._needACK[pk.identifierACK][pk.messageIndex] = pk.messageIndex;
        }

        let length = this._sendQueue.getLength();
        if (length + pk.getLength() > this._mtuSize - 36) {
            this.sendQueue();
        }

        // Object.assign or pk?

        if (pk.needACK) {
            this._sendQueue.packets.push(pk);
            pk.needACK = false;
        }else{
            this._sendQueue.packets.push(pk.toBinary());
        }

        if (priority === RakNet.PRIORITY_IMMEDIATE) {
            this.sendQueue();
        }

        // let priority = flags & 0x07;
        //
        // let length = this._sendQueue.getLength();
        // if ((length + pk.getLength()) > (this.mtuSize - 36)) {
        //     this.sendQueue();
        // }
        //
        // if (pk.needACK) {
        //     this._sendQueue.packets.push(Object.assign(new EncapsulatedPacket(), pk));
        //     pk.needACK = false;
        // } else {
        //     this._sendQueue.packets.push(pk.toBinary());
        // }
        //
        // if (priority === RakNet.PRIORITY_IMMEDIATE) {
        //     this.sendQueue();
        // }
    }

    sendQueue() {
        if (this._sendQueue.packets.length > 0) {
            this.sendDatagram(this._sendQueue);
            this._sendQueue = new Datagram();
        }
    }

    toStringAddress() {
        return this._address.getIp() + ":" + this._address.getPort();
    }
}

module.exports = Session;