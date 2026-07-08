"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForgeLinked = void 0;
const forgescript_1 = require("@tryforge/forgescript");
const lavalink_client_1 = require("lavalink-client");
const path_1 = __importDefault(require("path"));
const tiny_typed_emitter_1 = require("tiny-typed-emitter");
const ForgeLinkedCommandManager_js_1 = require("./structures/ForgeLinkedCommandManager.js");
const fs_1 = require("fs");

const dbPath = path_1.default.join(require.main?.path || process.cwd(), 'queueSnapshots.json');

function getDb() {
    if (!fs_1.existsSync(dbPath)) fs_1.writeFileSync(dbPath, JSON.stringify({}));
    try { return JSON.parse(fs_1.readFileSync(dbPath, 'utf8')); } catch { return {}; }
}

function saveDb(data) {
    fs_1.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

class ForgeLinked extends forgescript_1.ForgeExtension {
    options;
    name = 'ForgeLink';
    description = 'ForgeScript integration with lavalink-client';
    version = '2.2.0';
    client;
    lavalink;
    commands;
    emitter = new tiny_typed_emitter_1.TypedEmitter();
    _restoring = false;

    constructor(options) {
        super();
        this.options = options;
    }

    async _restorePlayers() {
        if (this._restoring) return;
        this._restoring = true;

        const db = getDb();
        const entries = Object.entries(db);
        if (!entries.length) {
            this._restoring = false;
            return;
        }

        const queueConfig = this.options.queue || this.options.queueOptions || {};
        const recoverAfterMs = queueConfig.recoverAfterMs ?? 0;
        const recoverStates = queueConfig.recoverStates ?? ['all'];

        await new Promise((res) => setTimeout(res, recoverAfterMs));

        forgescript_1.Logger.info(`[ForgeLinked] Checking for queue recoveries...`);
        const currentDb = getDb();
        let needsSave = false;

        for (const [guildId, snap] of Object.entries(currentDb)) {
            if (!snap.voiceChannelId) {
                delete currentDb[guildId];
                needsSave = true;
                continue;
            }

            const snapState = snap.state ?? 'playing';
            const shouldRecover = recoverStates.includes('all') ||
                (recoverStates.includes('player') && snapState === 'playing') ||
                (recoverStates.includes('pausedPlayers') && snapState === 'paused') ||
                (recoverStates.includes('uniqueTracks') && !!snap.current);

            if (!shouldRecover) {
                delete currentDb[guildId];
                needsSave = true;
                continue;
            }

            let player = this.lavalink.getPlayer(guildId);

            try {
                if (!player) {
                    player = this.lavalink.createPlayer({
                        guildId: guildId,
                        voiceChannelId: snap.voiceChannelId,
                        textChannelId: snap.textChannelId,
                        selfDeaf: true
                    });
                }

                if (snap.tracks?.length) {
                    const validTracks = snap.tracks.filter(t => t?.encoded);
                    if (validTracks.length) player.queue.add(validTracks);
                }

                await player.connect();

                if (snap.current?.encoded) {
                    await player.play({ track: snap.current });
                    if (snap.position > 0) {
                        await player.seek(snap.position);
                    }
                    if (snapState === 'paused') {
                        await player.pause(true);
                    }
                    forgescript_1.Logger.info(`[ForgeLinked] Restored for ${guildId}`);
                } else if (player.queue.tracks.length) {
                    await player.play();
                    forgescript_1.Logger.info(`[ForgeLinked] Restored queue for ${guildId}`);
                } else {
                    player.destroy();
                }

                delete currentDb[guildId];
                needsSave = true;

            } catch (e) {
                forgescript_1.Logger.error(`[ForgeLinked Error] Failed to restore ${guildId}: ${e.message}`);
                if (player) player.destroy();
                delete currentDb[guildId];
                needsSave = true;
            }
        }

        if (needsSave) saveDb(currentDb);
        this._restoring = false;
    }

    async init(client) {
        const start = Date.now();
        this.client = client;
        
        const queueConfig = this.options.queue || this.options.queueOptions || {};
        const keepQueue = queueConfig.keepQueue ?? false;

        this.lavalink = new lavalink_client_1.LavalinkManager({
            nodes: this.options.nodes,
            sendToShard: (guildId, payload) => {
                const guild = this.client.guilds.cache.get(guildId);
                if (guild) guild.shard.send(payload);
                return Promise.resolve();
            },
            autoSkip: this.options.autoSkip ?? true,
            autoSkipOnResolveError: this.options.autoSkipOnResolveError ?? true,
            emitNewSongsOnly: this.options.emitNewSongsOnly ?? true,
            playerUpdateInterval: 60000,
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
                ...(this.options.playerOptions?.onEmptyQueue !== undefined ? {
                onEmptyQueue: {
                    destroyAfterMs: this.options.playerOptions?.onEmptyQueue?.destroyAfterMs,
                    autoPlayFunction: this.options.autoPlayFunction,
                },
              } : {}),
            },
            queueOptions: {
                maxPreviousTracks: this.options.queueOptions?.maxPreviousTracks ?? 10,
            },
            linksAllowed: this.options.linksAllowed ?? true,
            linksBlacklist: this.options.linksBlacklist ?? [],
            linksWhitelist: this.options.linksWhitelist ?? [],
        });

        this.commands = new ForgeLinkedCommandManager_js_1.ForgeLinkedCommandManager(this.client);
        
        forgescript_1.EventManager.load('ForgeLinked', path_1.default.join(__dirname, 'events'));

        if (this.options.events?.length) {
            this.client.events.load('ForgeLinked', this.options.events);
        }

        client.on('raw', (packet) => {
            this.lavalink.sendRawData(packet).catch(() => null);
        });

        const nativesPath = path_1.default.join(__dirname, 'natives');
        if (fs_1.existsSync(nativesPath)) {
            const getFiles = (dir) => {
                let results = [];
                const list = fs_1.readdirSync(dir);
                list.forEach((file) => {
                    file = path_1.default.join(dir, file);
                    const stat = fs_1.statSync(file);
                    if (stat && stat.isDirectory()) results = results.concat(getFiles(file));
                    else if (file.endsWith('.js')) results.push(file);
                });
                return results;
            };

            const validFns = [];
            const files = getFiles(nativesPath);
            
            for (const file of files) {
                try {
                    const req = require(file).default;
                    if (req && req.name) {
                        req.path = file;
                        if (!req.data?.args?.length) req.data.unwrap = false;
                        validFns.push(req);
                    }
                } catch (e) {}
            }
            
            if (validFns.length > 0) {
                forgescript_1.FunctionManager.addMany(validFns);
            }
        }

        client.on('clientReady', async () => {
            await new Promise((res) => setTimeout(res, 3000));
            await this.lavalink.init({ id: client.user.id, username: client.user.username });
        });

        if (keepQueue) {
            forgescript_1.Logger.info('[ForgeLink] Queue persistence activated!');

            this.lavalink.nodeManager.on('connect', async (node) => {
                forgescript_1.Logger.info(`[ForgeLinked] Node ${node.options.id} connected, checking for restorations...`);
                const db = getDb();
                if (Object.keys(db).length > 0) {
                    await this._restorePlayers();
                }

                for (const player of this.lavalink.players.values()) {
                    if (player.voiceChannelId && !player.queue.current && !player.queue.tracks.length) {
                        try {
                            await player.connect();
                        } catch (e) {
                            forgescript_1.Logger.error(`[ForgeLinked] Failed to reconnect idle player for ${player.guildId}: ${e.message}`);
                        }
                    }
                }
            });

            setInterval(() => {
                if (!this.lavalink.players.size) return;
                const db = getDb();
                let needsSave = false;
                for (const player of this.lavalink.players.values()) {
                    if (player.queue.current && player.voiceChannelId) {
                        db[player.guildId] = {
                            guildId: player.guildId,
                            voiceChannelId: player.voiceChannelId,
                            textChannelId: player.textChannelId,
                            tracks: [...player.queue.tracks],
                            current: player.queue.current,
                            position: player.position || 0,
                            state: player.paused ? 'paused' : 'playing',
                            savedAt: Date.now()
                        };
                        needsSave = true;
                    }
                }
                if (needsSave) saveDb(db);
            }, 10000);

            this.lavalink.on('playerDestroy', (player) => {
                const recoverStates = queueConfig.recoverStates ?? ['all'];
                const currentState = player.paused ? 'paused' : 'playing';

                const shouldSnap = recoverStates.includes('all') ||
                    (recoverStates.includes('player') && currentState === 'playing') ||
                    (recoverStates.includes('pausedPlayers') && currentState === 'paused') ||
                    (recoverStates.includes('uniqueTracks') && !!player.queue.current);

                const db = getDb();

                if (!shouldSnap || !player.queue.current) {
                    delete db[player.guildId];
                    saveDb(db);
                    return;
                }

                db[player.guildId] = {
                    guildId: player.guildId,
                    voiceChannelId: player.voiceChannelId,
                    textChannelId: player.textChannelId,
                    tracks: [...player.queue.tracks],
                    current: player.queue.current ?? null,
                    position: player.position || 0,
                    savedAt: Date.now(),
                    state: currentState,
                };
                saveDb(db);
            });

            this.lavalink.on('queueEnd', (player) => {
                const db = getDb();
                delete db[player.guildId];
                saveDb(db);
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

        this.lavalink.nodeManager.on('error', (error) => {
            forgescript_1.Logger.error('Lavalink Error:', error);
        });

        console.debug(`ForgeLinked: Initialized in ${Date.now() - start}ms`);
    }

    getQueueSnapshot(guildId) { return getDb()[guildId] || null; }
    clearQueueSnapshot(guildId) {
        const db = getDb();
        delete db[guildId];
        saveDb(db);
    }
}
exports.ForgeLinked = ForgeLinked;
