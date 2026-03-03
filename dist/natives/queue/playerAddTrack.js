
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
            const lavalink = extension.lavalink;
            let player = lavalink.getPlayer(guildId.id);
            if (!player) return this.customError('Player not found for this guild.');

            if (!player.connected) {
                try { await player.connect(); }
                catch (connErr) { return this.customError(`Failed to connect to voice: ${connErr instanceof Error ? connErr.message : 'Unknown error'}`); }
            }

            const { sources, actualQuery } = parseMultiSource(query);

            let result, usedSource;

            if (sources.length >= 1) {
                const found = await searchWithFallback(player, sources, actualQuery, ctx.member);
                if (!found) return this.customError('No results found in any source.');
                result = found.result;
                usedSource = found.usedSource;
            } else {
                const src = query.split(':')[0] || null;
                if (!src) return this.customError('No search provider found.');
                result = await player.search({ query, source: src }, ctx.member).catch(() => null);
                usedSource = src;
            }

            if (!result || !result.tracks.length || result.loadType === 'empty') return this.customError('No results found for the provided query.');
            if (result.loadType === 'error') return this.customError('An error occurred while fetching the track.');

            if (result.loadType === 'playlist') {
                player.queue.add(result.tracks);
            } else {
                player.queue.add(result.tracks[0]);
            }

            if (!player.playing && !player.paused) {
                await player.play().catch((e) => this.customError(e.message));
            }

            const requester = result.tracks[0].requester;
            return this.successJSON({
                status: 'success',
                type: result.loadType,
                message: result.loadType === 'playlist'
                    ? `Queued ${result.tracks.length} tracks from ${result.playlist?.title}`
                    : `Queued ${result.tracks[0].info.title}`,
                playlistName: result.loadType === 'playlist' ? result.playlist?.title : null,
                playlistUri: result.loadType === 'playlist' ? result.playlist?.uri : null,
                trackCount: result.loadType === 'playlist' ? result.tracks.length : 1,
                trackTitle: result.loadType !== 'playlist' ? result.tracks[0].info.title : null,
                trackAuthor: result.loadType !== 'playlist' ? result.tracks[0].info.author : null,
                trackImage: result.tracks[0].info.artworkUrl,
                requester: requester?.id || 'Unknown',
                usedSource,
            });
        } catch (error) {
            return this.customError(`Internal Error: ${error.message ?? 'Unknown'}`);
        }
    },
});
