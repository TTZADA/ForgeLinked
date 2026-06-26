"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const index_js_1 = require("../../index.js");
exports.default = new forgescript_1.NativeFunction({
    name: '$playerAddTrack',
    description: 'Add a track to a player',
    version: '1.0.0',
    brackets: true,
    unwrap: true,
    args: [
        {
            name: 'guildId',
            description: 'The guild id to add the track to',
            type: forgescript_1.ArgType.Guild,
            required: true,
            rest: false,
        },
        {
            name: 'query',
            description: 'The query to search for, optionally prefixed with source (e.g. ytsearch:my song)',
            type: forgescript_1.ArgType.String,
            required: true,
            rest: false,
        },
    ],
    output: forgescript_1.ArgType.Json,
    async execute(ctx, [guildId, query]) {
        try {
            const extension = ctx.client.getExtension(index_js_1.ForgeLinked, true);
            if (!extension)
                return this.customError('ForgeLinked extension not found');

            const lavalink = extension.lavalink;
            const player = lavalink.getPlayer(guildId.id);
            if (!player)
                return this.customError('Player not found for this guild.');

            if (!player.connected) {
                try {
                    await player.connect();
                } catch (connErr) {
                    return this.customError(`Failed to connect to voice: ${connErr instanceof Error ? connErr.message : 'Unknown error'}`);
                }
            }

            const colonIndex = query.indexOf(':');
            const searchQuery = colonIndex !== -1
                ? { query: query.slice(colonIndex + 1), source: query.slice(0, colonIndex) }
                : { query };

            const result = await player
                .search(searchQuery, ctx.member)
                .catch(() => null);

            if (!result || !result.tracks.length || result.loadType === 'empty') {
                return this.customError('No results found for the provided query.');
            }

            if (result.loadType === 'error') {
                return this.customError('An error occurred while fetching the track.');
            }

            if (result.loadType === 'playlist') {
                player.queue.add(result.tracks);
            } else {
                player.queue.add(result.tracks[0]);
            }

            if (!player.playing && !player.paused) {
                try {
                    await player.play();
                } catch (playErr) {
                    return this.customError(`Failed to start playback: ${playErr instanceof Error ? playErr.message : String(playErr)}`);
                }
            }

            const firstTrack = result.tracks[0];
            const rawDurationMs = firstTrack.info.duration ?? 0;
            const isStream = firstTrack.info.isStream ?? false;
            const playlistDurationMs = result.loadType === 'playlist'
                ? result.tracks.reduce((acc, t) => acc + (t.info.duration ?? 0), 0)
                : rawDurationMs;

            return this.successJSON({
                status: 'success',
                type: result.loadType,
                message: result.loadType === 'playlist'
                    ? `Queued ${result.tracks.length} tracks from ${result.playlist?.title}`
                    : `Queued ${firstTrack.info.title}`,
                playlistName: result.loadType === 'playlist' ? result.playlist?.title : null,
                playlistUri: result.loadType === 'playlist' ? result.playlist?.uri : null,
                trackCount: result.loadType === 'playlist' ? result.tracks.length : 1,
                trackTitle: result.loadType !== 'playlist' ? firstTrack.info.title : null,
                trackAuthor: result.loadType !== 'playlist' ? firstTrack.info.author : null,
                trackUri: result.loadType !== 'playlist' ? firstTrack.info.uri : null,
                trackImage: firstTrack.info.artworkUrl,
                trackDuration: isStream ? null : rawDurationMs,
                trackDurationFormatted: isStream ? 'LIVE' : formatDuration(rawDurationMs),
                playlistDuration: result.loadType === 'playlist' ? playlistDurationMs : null,
                playlistDurationFormatted: result.loadType === 'playlist' ? formatDuration(playlistDurationMs) : null,
                isStream,
                requester: firstTrack.requester?.id || 'Unknown',
            });
        } catch (error) {
            return this.customError(`Internal Error: ${error.message ?? 'Unknown'}`);
        }
    },
});

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
