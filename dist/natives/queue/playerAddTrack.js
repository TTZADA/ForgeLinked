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

function parseMultiSource(query) {
    const parts = query.split(':');
    const sources = [];
    let i = 0;
    while (i < parts.length && KNOWN_SOURCES.has(parts[i])) {
        sources.push(parts[i]);
        i++;
    }
    const actualQuery = parts.slice(i).join(':').trim();
    return { sources, actualQuery };
}

function normalize(str) {
    return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function wordOverlap(a, b) {
    const wordsA = new Set(normalize(a).split(/\s+/).filter(Boolean));
    const wordsB = new Set(normalize(b).split(/\s+/).filter(Boolean));
    let shared = 0;
    for (const w of wordsA) {
        if (wordsB.has(w)) shared++;
    }
    const minLen = Math.min(wordsA.size, wordsB.size);
    return minLen === 0 ? 0 : shared / minLen;
}

function isGoodMatch(track, actualQuery) {
    const combined = `${track.info.title} ${track.info.author}`;
    return wordOverlap(combined, actualQuery) >= 0.4;
}

function pickBestTrack(tracks, actualQuery) {
    let best = null;
    let bestScore = -1;
    for (const track of tracks) {
        const combined = `${track.info.title} ${track.info.author}`;
        const score = wordOverlap(combined, actualQuery);
        if (score > bestScore) {
            bestScore = score;
            best = track;
        }
    }
    return bestScore >= 0.4 ? best : null;
}

async function searchWithFallback(player, sources, actualQuery, requester) {
    for (const src of sources) {
        try {
            const result = await player.search(
                { query: `${src}:${actualQuery}`, source: SOURCE_MAP[src] ?? src },
                requester
            ).catch(() => null);

            if (!result || !result.tracks.length || result.loadType === 'empty' || result.loadType === 'error') continue;

            if (result.loadType === 'playlist') return { result, usedSource: src };

            const best = pickBestTrack(result.tracks, actualQuery);
            if (!best) {
                result.tracks = [result.tracks[0]];
                return { result, usedSource: src };
            }

            result.tracks = [best];
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
            const player = lavalink.getPlayer(guildId.id);
            if (!player) return this.customError('Player not found for this guild.');

            if (!player.connected) {
                try { await player.connect(); }
                catch (connErr) { return this.customError(`Failed to connect to voice: ${connErr instanceof Error ? connErr.message : 'Unknown error'}`); }
            }

            const { sources, actualQuery } = parseMultiSource(query);

            let result, usedSource;

            if (sources.length >= 1) {
                if (!actualQuery) return this.customError('Query is empty after parsing sources.');
                const found = await searchWithFallback(player, sources, actualQuery, ctx.member);
                if (!found) return this.customError('No results found in any source.');
                result = found.result;
                usedSource = found.usedSource;
            } else {
                result = await player.search({ query, source: query.split(':')[0] }, ctx.member).catch(() => null);
                usedSource = query.split(':')[0];
                if (!result || !result.tracks.length || result.loadType === 'empty') return this.customError('No results found for the provided query.');
                if (result.loadType === 'error') return this.customError('An error occurred while fetching the track.');
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
