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

function parseMultiSource(query) {
    const KNOWN = new Set(Object.keys(SOURCE_MAP));
    const parts = query.split(':');
    const sources = [];
    for (let i = 0; i < parts.length; i++) {
        if (KNOWN.has(parts[i])) {
            sources.push(parts[i]);
        } else {
            return { sources, actualQuery: parts.slice(i).join(':') };
        }
    }
    return { sources, actualQuery: '' };
}

function normalize(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function isGoodMatch(track, actualQuery) {
    const q = normalize(actualQuery);
    const title = normalize(track.info.title);
    const author = normalize(track.info.author);
    return title.includes(q) || q.includes(title) || author.includes(q);
}

async function searchWithFallback(player, sources, actualQuery, requester) {
    for (const src of sources) {
        try {
            const result = await player.search(
                { query: `${src}:${actualQuery}`, source: SOURCE_MAP[src] ?? src },
                requester
            ).catch(() => null);

            if (!result || !result.tracks.length || result.loadType === 'empty' || result.loadType === 'error') continue;

            const goodTracks = result.tracks.filter(t => isGoodMatch(t, actualQuery));
            if (!goodTracks.length) continue;

            result.tracks = goodTracks;
            return { result, usedSource: src };
        } catch (_) {}
    }
    return null;
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

        const { sources, actualQuery } = parseMultiSource(query);

        let result, usedSource;

        if (sources.length >= 1) {
            const found = await searchWithFallback(player, sources, actualQuery, requester?.id ?? ctx.member?.id);
            if (!found) return this.customError('No results found in any source!');
            result = found.result;
            usedSource = found.usedSource;
        } else {
            const info = await player.node.fetchInfo();
            const supported = info.sourceManagers || [];
            let finalQuery = query;
            if (source) {
                if (!supported.includes(source)) return this.customError(`Source '${source}' not supported`);
                finalQuery = `${source.replace('youtubemusic', 'ytmsearch')}:${query}`;
            }
            result = await player.search(finalQuery, { requester: requester?.id ?? ctx.member?.id });
            usedSource = source;
        }

        if (!result.tracks.length) return this.customError('No results found!');
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
