"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const helpers_1 = require("../util/helpers");

exports.default = new forgescript_1.NativeFunction({
    name: '$playerPlayTrack', version: '2.2.0', description: 'Search and immediately play or queue a track with queue control',
    brackets: true, unwrap: true,
    args: [
        { name: 'guildId', description: 'Guild ID', type: forgescript_1.ArgType.Guild, required: true, rest: false },
        { name: 'query', description: 'Query or URL', type: forgescript_1.ArgType.String, required: true, rest: false },
        { name: 'replaceCurrent', description: 'Replace currently playing track', type: forgescript_1.ArgType.Boolean, required: false, rest: false },
        { name: 'keepQueue', description: 'Keep existing queue when replacing', type: forgescript_1.ArgType.Boolean, required: false, rest: false },
    ],
    output: forgescript_1.ArgType.Json,
    async execute(ctx, [guildId, query, replaceCurrent, keepQueue]) {
        const lavalink = helpers_1.getLavalink(ctx);
        if (!lavalink) return this.customError('ForgeLinked is not initialized');
        const player = lavalink.getPlayer(guildId.id);
        if (!player) return this.customError('Player not found for this guild');
        if (!player.connected) await player.connect().catch((e) => this.customError(e.message));
        
        const result = await player.search({ query, source: 'ytsearch' }, ctx.member).catch(() => null);
        if (!result || !result.tracks.length || result.loadType === 'empty') return this.customError('No results found');
        if (result.loadType === 'error') return this.customError('Lavalink returned an error');
        
        const shouldReplace = replaceCurrent ?? false;
        const shouldKeepQueue = keepQueue ?? true;
        const isPlaylist = result.loadType === 'playlist';
        const tracks = isPlaylist ? result.tracks : [result.tracks[0]];
        
        if (shouldReplace && player.queue.current) {
            if (!shouldKeepQueue) {
                player.queue.tracks.splice(0);
            }
            player.queue.tracks.unshift(...tracks);
            await player.skip(0, false);
            
            if (Array.isArray(player.queue.previous)) {
                player.queue.previous.splice(0, 1);
            } else if (player.queue.previous) {
                player.queue.previous = [];
            }
        } else {
            player.queue.add(tracks.length === 1 ? tracks[0] : tracks);
            if (!player.playing && !player.paused) await player.play().catch((e) => this.customError(e.message));
        }
        
        return this.successJSON({
            status: 'success', type: result.loadType,
            replaced: shouldReplace && !!player.queue.current,
            queueKept: shouldKeepQueue,
            trackCount: tracks.length,
            trackTitle: !isPlaylist ? tracks[0].info.title : null,
            trackAuthor: !isPlaylist ? tracks[0].info.author : null,
            trackImage: tracks[0].info.artworkUrl ?? null,
            playlistName: isPlaylist ? (result.playlist?.title ?? null) : null,
            playlistUri: isPlaylist ? (result.playlist?.uri ?? null) : null,
            requester: tracks[0].requester?.id ?? 'Unknown',
        });
    },
});
