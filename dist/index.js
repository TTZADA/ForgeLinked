"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForgeLinked = void 0;
const forgescript_1 = require("@tryforge/forgescript");
const path_1 = require("path");
const tiny_typed_emitter_1 = require("tiny-typed-emitter");
const ForgeLinkedCommandManager_1 = require("./structures/ForgeLinkedCommandManager");
const fs_1 = require("fs");

const snapshotsPath = path_1.join(__dirname, 'queueSnapshots.json');

function getDb() {
    if (!fs_1.existsSync(snapshotsPath)) {
        fs_1.writeFileSync(snapshotsPath, JSON.stringify({}));
    }
    return JSON.parse(fs_1.readFileSync(snapshotsPath, 'utf8'));
}

function saveDb(data) {
    fs_1.writeFileSync(snapshotsPath, JSON.stringify(data, null, 2));
}

class ForgeLinked extends forgescript_1.ForgeExtension {
    constructor(options) {
        super();
        this.options = options;
        this.name = 'ForgeLink';
        this.description = 'ForgeScript integration with lavalink-client';
        this.version = '2.2.0';
        this.emitter = new tiny_typed_emitter_1.TypedEmitter();
    }
    async init(client) {
        const { LavalinkManager } = require('lavalink-client');
        this.client = client;
        const keepQueue = this.options.queue?.keepQueue ?? false;
        const recoverAfterMs = this.options.queue?.recoverAfterMs ?? 0;
        const recoverStates = this.options.queue?.recoverStates ?? ['all'];
        this.lavalink = new LavalinkManager({
            nodes: this.options.nodes,
            sendToShard: (guildId, payload) => {
                const guild = this.client.guilds.cache.get(guildId);
                if (guild) guild.shard.send(payload);
                return Promise.resolve();
            },
            autoSkip: this.options.autoSkip ?? true,
            autoSkipOnResolveError: this.options.autoSkipOnResolveError ?? true,
            emitNewSongsOnly: this.options.emitNewSongsOnly ?? true,
            playerOptions: {
                applyVolumeAsFilter: this.options.playerOptions?.applyVolumeAsFilter ?? false,
                clientBasedPositionUpdateInterval: this.options.playerOptions?.clientBasedPositionUpdateInterval ?? 50,
                defaultSearchPlatform: this.options.playerOptions?.defaultSearchPlatform ?? 'ytsearch',
                volumeDecrementer: this.options.playerOptions?.volumeDecrementer ?? 0.75,
                useUnresolvedData: this.options.playerOptions?.useUnresolvedData ?? true,
                requesterTransformer: this.options.requesterTransformer,
                onDisconnect: {
                    autoReconnect: this.options.playerOptions?.onDisconnect?.autoReconnect ?? true,
                    destroyPlayer: this.options.playerOptions?.onDisconnect?.destroyPlayer ?? false,
                },
                onEmptyQueue: {
                    destroyAfterMs: this.options.playerOptions?.onEmptyQueue?.destroyAfterMs ?? 30000,
                    autoPlayFunction: this.options.autoPlayFunction,
                },
            },
            queueOptions: { maxPreviousTracks: this.options.queueOptions?.maxPreviousTracks ?? 10 },
            linksAllowed: this.options.linksAllowed ?? true,
            linksBlacklist: this.options.linksBlacklist ?? [],
            linksWhitelist: this.options.linksWhitelist ?? [],
        });
        this.commands = new ForgeLinkedCommandManager_1.ForgeLinkedCommandManager(this.client);
        forgescript_1.EventManager.load('ForgeLinked', path_1.join(__dirname, 'events'));
        if (this.options.events?.length) {
            this.client.events.load('ForgeLinked', this.options.events);
        }
        client.on('raw', (packet) => { this.lavalink.sendRawData(packet).catch(() => null); });
        this.load(path_1.join(__dirname, 'natives'));
        client.on('clientReady', async () => {
            await new Promise((res) => setTimeout(res, 3000));
            this.lavalink.init({ id: client.user.id, username: client.user.username });
        });
        if (keepQueue) {
            this.lavalink.on('playerDestroy', (player) => {
                const shouldSnap = recoverStates.includes('all') ||
                    (recoverStates.includes('player') && player.playing) ||
                    (recoverStates.includes('pausedPlayers') && player.paused) ||
                    (recoverStates.includes('uniqueTracks') && !!player.queue.current);
                if (!shouldSnap) return;
                const snap = {
                    guildId: player.guildId,
                    tracks: [...player.queue.tracks],
                    current: player.queue.current ?? null,
                    savedAt: Date.now(),
                    state: player.paused ? 'paused' : 'playing',
                };
                const db = getDb();
                db[player.guildId] = snap;
                saveDb(db);
                if (recoverAfterMs > 0) {
                    setTimeout(() => {
                        const currentDb = getDb();
                        delete currentDb[player.guildId];
                        saveDb(currentDb);
                    }, recoverAfterMs);
                }
            });
            this.lavalink.on('playerCreate', async (player) => {
                const snapshot = this.getQueueSnapshot(player.guildId);
                if (snapshot && !player.queue.current) {
                    if (snapshot.current) {
                        player.queue.current = snapshot.current;
                    }
                    if (snapshot.tracks && snapshot.tracks.length > 0) {
                        player.queue.add(snapshot.tracks);
                    }
                    try {
                        if (!player.connected) await player.connect();
                        if (snapshot.state === 'playing') {
                            await player.play();
                        }
                        this.clearQueueSnapshot(player.guildId);
                    } catch (err) {}
                }
            });
        }
        if (this.options.events?.length) {
            for (const linkedEvent of this.options.events) {
                const lavalinkEvent = linkedEvent.startsWith('linked')
                    ? linkedEvent.charAt(6).toLowerCase() + linkedEvent.slice(7)
                    : linkedEvent;
                this.lavalink.on(lavalinkEvent, (...args) => {
                    this.emitter.emit(linkedEvent, ...args);
                });
            }
        }
    }
    getQueueSnapshot(guildId) {
        const db = getDb();
        return db[guildId] || null;
    }
    clearQueueSnapshot(guildId) {
        const db = getDb();
        delete db[guildId];
        saveDb(db);
    }
}
exports.ForgeLinked = ForgeLinked;
