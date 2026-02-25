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

const crossfadeState = new Map();

class ForgeLinked extends forgescript_1.ForgeExtension {
    options;
    name = 'ForgeLink';
    description = 'ForgeScript integration with lavalink-client';
    version = '2.3.0';
    client;
    lavalink;
    commands;
    emitter = new tiny_typed_emitter_1.TypedEmitter();

    constructor(options) {
        super();
        this.options = options;
    }

    setPlayerVolume(player, vol) {
    try {
        const volume = Math.max(0, Math.min(100, vol));
        if (player.setVolume && typeof player.setVolume === 'function') {
            player.setVolume(volume);
        } else {
            player.volume = volume;
        }
    } catch (e) {
        console.error("[ForgeLink] Error setting volume in player:", e.message);
    }
}


    getPlayerVolume(player) {
        return typeof player.volume === 'number' ? player.volume : 80;
    }

    tickCrossfade(guildId) {
    const state = crossfadeState.get(guildId);
    if (!state) return;

    const player = this.lavalink.getPlayer(guildId);
    if (!player || !player.playing) return;

    const now = Date.now();

    if (state.fadeInActive) {
        const elapsed = now - state.fadeInStartTime;
        const progress = Math.min(elapsed / state.fadeInDuration, 1);
        const newVol = Math.round(state.originalVolume * progress);
        
        this.setPlayerVolume(player, newVol);
        
        if (progress >= 1) {
            state.fadeInActive = false;
            this.setPlayerVolume(player, state.originalVolume);
        }
        return;
    }

    const track = player.queue?.current;
    if (!track) return;
    
    const duration = track.info?.duration;
    const endMs = this.options.crossfadeTracks?.endMs ?? 2000;
    if (!duration || duration <= endMs) return;

    const remaining = duration - (player.position || 0);

    if (!state.fadeOutActive && remaining <= endMs) {
        state.fadeOutActive = true;
        state.fadeOutStartTime = now;
        state.fadeOutDuration = endMs;
        state.originalVolume = this.getPlayerVolume(player);
    }

    if (state.fadeOutActive) {
        const elapsed = now - state.fadeOutStartTime;
        const progress = Math.min(elapsed / state.fadeOutDuration, 1);
        const newVol = Math.round(state.originalVolume * (1 - progress));
        this.setPlayerVolume(player, Math.max(0, newVol));
    }
}

    async init(client) {
        const start = Date.now();
        this.client = client;

        const queueConfig = this.options.queue || this.options.queueOptions || {};
        const keepQueue = queueConfig.keepQueue ?? false;
        const recoverAfterMs = queueConfig.recoverAfterMs ?? 0;
        const recoverStates = queueConfig.recoverStates ?? ['all'];
        const hasCrossfade = !!this.options.crossfadeTracks;

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
            this.lavalink.init({ id: client.user.id, username: client.user.username });

            if (keepQueue) {
                setTimeout(() => {
                    forgescript_1.Logger.info('[ForgeLink] Checking for queue recoveries...');
                    const db = getDb();
                    let needsSave = false;

                    for (const [guildId, snap] of Object.entries(db)) {
                        let player = this.lavalink.getPlayer(guildId);

                        if (!player && snap.voiceChannelId) {
                            try {
                                player = this.lavalink.createPlayer({
                                    guildId,
                                    voiceChannelId: snap.voiceChannelId,
                                    textChannelId: snap.textChannelId,
                                    selfDeaf: true,
                                });

                                if (snap.current) player.queue.current = snap.current;
                                if (snap.tracks?.length) player.queue.add(snap.tracks);

                                player.connect().then(async () => {
                                    if (snap.state === 'playing') {
                                        await player.play().catch(() => {});
                                        if (snap.position > 0) await player.seek(snap.position).catch(() => {});
                                        forgescript_1.Logger.info(`[ForgeLink] Music restored for guild: ${guildId}`);
                                    }
                                }).catch(() => {});

                                delete db[guildId];
                                needsSave = true;
                            } catch (e) {
                                forgescript_1.Logger.error(`[ForgeLink] Failed to restore guild queue ${guildId}: ${e.message}`);
                            }
                        }
                    }

                    if (needsSave) saveDb(db);
                }, 4000);
            }
        });

        if (keepQueue) {
            forgescript_1.Logger.info('[ForgeLink] Queue persistence activated!');

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
                            savedAt: Date.now(),
                        };
                        needsSave = true;
                    }
                }

                if (needsSave) saveDb(db);
            }, 10000);

            this.lavalink.on('playerDestroy', (player) => {
                const shouldSnap = recoverStates.includes('all') ||
                    (recoverStates.includes('player') && player.playing) ||
                    (recoverStates.includes('pausedPlayers') && player.paused) ||
                    (recoverStates.includes('uniqueTracks') && !!player.queue.current);

                const db = getDb();

                if (!shouldSnap) {
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
                    state: player.paused ? 'paused' : 'playing',
                };

                saveDb(db);
            });
        }

        if (hasCrossfade) {
            const cfg = this.options.crossfadeTracks;
            const startMs = cfg.startMs ?? 2000;

          this.lavalink.on('trackStart', (player) => {
            const guildId = player?.guildId;
            if (!guildId) return;
            const realPlayer = this.lavalink.getPlayer(guildId);
            if (!realPlayer) return;

         const lastState = crossfadeState.get(guildId);
       let targetVol = this.getPlayerVolume(realPlayer);
    
      if (targetVol <= 0 && lastState && lastState.originalVolume > 0) {
          targetVol = lastState.originalVolume;
      } else if (targetVol <= 0) {
         targetVol = 80;
      }

      const startMs = this.options.crossfadeTracks?.startMs ?? 2000;

    crossfadeState.set(guildId, {
        fadeOutActive: false,
        fadeOutStartTime: 0,
        fadeOutDuration: 0,
        originalVolume: targetVol, 
        fadeInActive: startMs > 0,
        fadeInStartTime: Date.now(),
        fadeInDuration: startMs,
    });

    if (startMs > 0) this.setPlayerVolume(realPlayer, 0);
});

            this.lavalink.on('trackEnd', (player) => {
                const guildId = typeof player === 'string' ? player : player?.guildId;
                if (!guildId) return;
                const state = crossfadeState.get(guildId);
                if (!state) return;
                state.fadeOutActive = false;
                state.fadeInActive = false;
                const realPlayer = this.lavalink.getPlayer(guildId);
                if (realPlayer && state.originalVolume > 0) {
                    this.setPlayerVolume(realPlayer, state.originalVolume);
                }
            });

            this.lavalink.on('playerUpdate', (player) => {
                const guildId = typeof player === 'string' ? player : player?.guildId;
                if (!guildId) return;
                const realPlayer = this.lavalink.getPlayer(guildId);
                if (!realPlayer || !realPlayer.playing || realPlayer.paused) return;
                this.tickCrossfade(guildId);
            });

            this.lavalink.on('playerDestroy', (player) => {
                const guildId = typeof player === 'string' ? player : player?.guildId;
                if (guildId) crossfadeState.delete(guildId);
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

        console.debug(`ForgeLink: Initialized in ${Date.now() - start}ms`);
    }

    getQueueSnapshot(guildId) { return getDb()[guildId] || null; }

    clearQueueSnapshot(guildId) {
        const db = getDb();
        delete db[guildId];
        saveDb(db);
    }
}

exports.ForgeLinked = ForgeLinked;
