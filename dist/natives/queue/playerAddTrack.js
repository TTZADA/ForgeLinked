"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const index_js_1 = require("../../index.js");

const SOURCE_MAP = {
    spsearch: 'spotify',
    dzsearch: 'deezer',
    scsearch: 'soundcloud',
    ytsearch: 'youtube',
    ytmsearch: 'youtubemusic',
    yt: 'youtube',
    ytm: 'youtubemusic',
    sp: 'spotify',
    dz: 'deezer',
    sc: 'soundcloud',
};

const KNOWN_SOURCES = new Set(Object.keys(SOURCE_MAP));

function parseQuery(query) {
    const parts = query.split(':');
    const sources = [];
    let i = 0;
    while (i < parts.length && KNOWN_SOURCES.has(parts[i])) {
        sources.push(parts[i]);
        i++;
    }
    return { sources, actualQuery: parts.slice(i).join(':').trim() };
}

exports.default = new forgescript_1.NativeFunction({
    name: '$playerAddTrack',
    description: 'Add a track to a player',
    version: '1.0.0',
    brackets: true,
    unwrap: true,
    args: [
        { name: 'guildId', description: 'The guild id', type: forgescript_1.ArgType.Guild, required: true, rest: false },
        { name: 'query', description: 'The query', type: forgescript_1.ArgType.String, required: true, rest: false },
    ],
    output: forgescript_1.ArgType.Json,
    async execute(ctx, [guildId, query]) {
        try {
            const extension = ctx.client.getExtension(index_js_1.ForgeLinked, true);
            if (!extension) return this.customError('ForgeLinked extension not found');

            const player = extension.lavalink.getPlayer(guildId.id);
            if (!player) return this.customError('Player not found for this guild.');

            if (!player.connected) {
                try { await player.connect(); }
                catch (e) { return this.customError(`Failed to connect to voice: ${e instanceof Error ? e.message : 'Unknown error'}`); }
            }

            const { sources, actualQuery } = parseQuery(query);
            const searchTargets = sources.length
                ? sources.map(src => ({ prefix: src, query: `${src}:${actualQuery}`, source: SOURCE_MAP[src] }))
                : [{ prefix: null, query, source: query.split(':')[0] }];

            let result = null;
            let usedSource = null;

            for (const target of searchTargets) {
                const res = await player.search({ query: target.query, source: target.source }, ctx.member).catch(() => null);
                if (res && res.tracks.length && res.loadType !== 'empty' && res.loadType !== 'error') {
                    result = res;
                    usedSource = target.prefix ?? target.source;
                    break;
                }
            }

            if (!result) return this.customError('No results found for the provided query.');

            if (result.loadType === 'playlist') {
                player.queue.add(result.tracks);
            } else {
                player.queue.add(result.tracks[0]);
            }

            if (!player.playing && !player.paused) {
                await player.play().catch((e) => this.customError(e.message));
            }

            const track = result.tracks[0];
            return this.successJSON({
                status: 'success',
                type: result.loadType,
                message: result.loadType === 'playlist'
                    ? `Queued ${result.tracks.length} tracks from ${result.playlist?.title}`
                    : `Queued ${track.info.title}`,
                playlistName: result.loadType === 'playlist' ? result.playlist?.title : null,
                playlistUri: result.loadType === 'playlist' ? result.playlist?.uri : null,
                trackCount: result.loadType === 'playlist' ? result.tracks.length : 1,
                trackTitle: result.loadType !== 'playlist' ? track.info.title : null,
                trackAuthor: result.loadType !== 'playlist' ? track.info.author : null,
                trackImage: track.info.artworkUrl,
                requester: track.requester?.id || 'Unknown',
                usedSource,
            });
        } catch (error) {
            return this.customError(`Internal Error: ${error.message ?? 'Unknown'}`);
        }
    },
});
