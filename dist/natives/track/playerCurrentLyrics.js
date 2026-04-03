"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const index_js_1 = require("../../index.js");

const lyricsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCacheKey(guildId, encodedTrack) {
    return `${guildId}::${encodedTrack}`;
}

function getCachedLyrics(guildId, encodedTrack) {
    const key = getCacheKey(guildId, encodedTrack);
    const entry = lyricsCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > CACHE_TTL) {
        lyricsCache.delete(key);
        return null;
    }
    return entry.data;
}

function setCachedLyrics(guildId, encodedTrack, data) {
    const key = getCacheKey(guildId, encodedTrack);
    lyricsCache.set(key, { data, fetchedAt: Date.now() });
}

exports.default = new forgescript_1.NativeFunction({
    name: '$playerCurrentLyrics',
    description: 'Get synced lyrics from Nodelink. Returns lastLine, currentLine or nextLine based on player position.',
    version: '1.0.0',
    brackets: true,
    unwrap: true,
    args: [
        {
            name: 'guildId',
            description: 'The guild id to get lyrics for',
            type: forgescript_1.ArgType.Guild,
            required: false,
            rest: false,
        },
        {
            name: 'type',
            description: 'What to return: currentLine | lastLine | nextLine | synced',
            type: forgescript_1.ArgType.String,
            required: false,
            rest: false,
        },
    ],
    output: forgescript_1.ArgType.String,
    async execute(ctx, [guildId, type]) {
        const linked = ctx.client.getExtension(index_js_1.ForgeLinked, true).lavalink;
        if (!linked) return this.customError('ForgeLinked is not initialized');
        if (!guildId) guildId = ctx.guild;
        if (!guildId) return this.customError('Unable to find any guild. Ensure this command was ran inside of a guild and not dms or a group chat');

        const player = linked.getPlayer(guildId.id);
        if (!player) return this.customError('Player not found');

        try {
            const encodedTrack = player.queue.current?.encoded;
            if (!encodedTrack) return this.customError('No track currently playing.');

            let data = getCachedLyrics(guildId.id, encodedTrack);

            if (!data) {
                const node = player.node;
                const nodeOptions = node.options ?? node;
                const host = nodeOptions.host;
                const port = nodeOptions.port;
                const auth = nodeOptions.authorization ?? nodeOptions.password;
                const secure = nodeOptions.secure ?? false;
                const protocol = secure ? 'https' : 'http';
                const url = `${protocol}://${host}:${port}/v4/loadlyrics?encodedTrack=${encodeURIComponent(encodedTrack)}`;

                const res = await fetch(url, { headers: { Authorization: auth } });
                if (!res.ok) return this.customError(`Nodelink lyrics request failed: ${res.status}`);

                const json = await res.json();
                if (json.loadType !== 'lyrics' || !json.data) return this.customError('No lyrics found.');

                data = json.data;
                setCachedLyrics(guildId.id, encodedTrack, data);
            }

            const { synced, lines } = data;

            if (!synced) {
                if (type === 'synced') return this.success('false');
                if (type === 'currentLine') return this.success('[ letras não sincronizadas ]');
                return this.success('');
            }

            if (type === 'synced') return this.success('true');

            const position = player.position ?? 0;

            if (lines.length > 0 && position < lines[0].time) {
                if (type === 'currentLine') return this.success('...');
                if (type === 'nextLine') return this.success(lines[0].text?.trim() || '');
                return this.success('');
            }

            let currentIndex = 0;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].time <= position) currentIndex = i;
                else break;
            }

            const beforeLastLine    = lines[currentIndex - 2]?.text?.trim() || '♪';
            const lastLine    = lines[currentIndex - 1]?.text?.trim() || '♪';
            const currentLine = lines[currentIndex]?.text?.trim()     || '♪';
            const nextLine    = lines[currentIndex + 1]?.text?.trim() || '♪';
            const afterNextLine    = lines[currentIndex + 2]?.text?.trim() || '♪';

            if (type === 'beforeLastLine')    return this.success(lastLine);
            if (type === 'lastLine')    return this.success(lastLine);
            if (type === 'nextLine')    return this.success(nextLine);
            if (type === 'afterNextLine')    return this.success(nextLine);
            if (type === 'currentLine') return this.success(currentLine);
            return this.success(JSON.stringify({ beforeLastLine, lastLine, currentLine, nextLine, afterNextLine, synced: true }));
        }
        catch (err) {
            console.error('[Nodelink] Lyrics error:', err);
            return this.customError('Could not fetch lyrics. Player is safe.');
        }
    },
});
//# sourceMappingURL=playerCurrentLyrics.js.map
