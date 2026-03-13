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
    name: '$playerSearchTrack',
    description: 'Search for a track',
    version: '1.0.0',
    brackets: true,
    unwrap: true,
    args: [
        { name: 'guildId', description: 'The guild id', type: forgescript_1.ArgType.Guild, required: true, rest: false },
        { name: 'query', description: 'The query', type: forgescript_1.ArgType.String, required: true, rest: false },
        { name: 'source', description: 'The source', type: forgescript_1.ArgType.String, required: false, rest: false },
        { name: 'requester', description: 'The requester', type: forgescript_1.ArgType.Member, required: false, rest: false },
        { name: 'limit', description: 'The limit', type: forgescript_1.ArgType.Number, required: false, rest: false },
    ],
    output: forgescript_1.ArgType.Json,
    async execute(ctx, [guildId, query, source, requester, limit]) {
        const linked = ctx.client.getExtension(index_js_1.ForgeLinked, true).lavalink;
        if (!linked) return this.customError('ForgeLinked is not initialized');
        const player = linked.getPlayer(guildId.id);
        if (!player) return this.customError('Player not found');

        const { sources, actualQuery } = parseQuery(query);
        const searchTargets = sources.length
            ? sources.map(src => ({ prefix: src, query: `${src}:${actualQuery}`, source: SOURCE_MAP[src] }))
            : [{ prefix: source ?? null, query, source: source ?? query.split(':')[0] }];

        let result = null;
        let usedSource = null;

        for (const target of searchTargets) {
            const res = await player.search(
                { query: target.query, source: target.source },
                requester ?? ctx.member
            ).catch(() => null);
            if (res && res.tracks.length && res.loadType !== 'empty' && res.loadType !== 'error') {
                result = res;
                usedSource = target.prefix ?? target.source;
                break;
            }
        }

        if (!result || !result.tracks.length) return this.customError('No results found!');

        let tracks = result.tracks;
        if (limit) tracks = tracks.slice(0, limit);

        return this.successJSON({
            status: 'success',
            source: usedSource,
            type: result.loadType,
            message: result.loadType === 'playlist'
                ? `Found ${tracks.length} tracks from ${result.playlist?.name}`
                : `Found ${tracks.length} tracks matching the query.`,
            playlistName: result.loadType === 'playlist' ? result.playlist?.name : null,
            playlistUri: result.loadType === 'playlist' ? result.playlist?.uri : null,
            requester: result.tracks[0].requester,
            trackCount: tracks.length,
            tracks: tracks.map((track) => ({
                title: track.info.title,
                author: track.info.author,
                duration: track.info.duration,
                url: track.info.uri,
                thumbnail: track.info.artworkUrl,
                source: usedSource,
            })),
        });
    },
});
