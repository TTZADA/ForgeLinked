"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const index_js_1 = require("../../index.js");
exports.default = new forgescript_1.NativeFunction({
    name: '$playerCurrentLyrics',
    description: 'Get the current lyrics of a player (lastLine, currentLine, nextLine)',
    version: '1.0.0',
    brackets: true,
    unwrap: true,
    args: [
        {
            name: 'guildId',
            description: 'The guild id to get the current lyrics for',
            type: forgescript_1.ArgType.Guild,
            required: false,
            rest: false,
        },
        {
            name: 'type',
            description: 'What to return: currentLine, lastLine, nextLine, or synced',
            type: forgescript_1.ArgType.String,
            required: false,
            rest: false,
        },
    ],
    output: forgescript_1.ArgType.String,
    async execute(ctx, [guildId, type]) {
        const linked = ctx.client.getExtension(index_js_1.ForgeLinked, true).lavalink;
        if (!linked)
            return this.customError('ForgeLinked is not initialized');
        if (!guildId)
            guildId = ctx.guild;
        if (!guildId)
            return this.customError('Unable to find any guild.');
        const player = linked.getPlayer(guildId.id);
        if (!player)
            return this.customError('Player not found');
        try {
            const lyrics = await player.getCurrentLyrics();
            if (!lyrics)
                return this.customError('No lyrics found.');

            if (!lyrics.data?.synced) {
                if (type === 'synced') return this.success('false');
                if (type === 'currentLine') return this.success('[ unsynchronized lyrics ]');
                return this.success('');
            }

            if (type === 'synced') return this.success('true');

            const lines = lyrics.data.lines;
            const position = player.position ?? 0;

            let currentIndex = 0;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].time <= position) currentIndex = i;
                else break;
            }

            const lastLine  = lines[currentIndex - 1]?.text?.trim() || '';
            const currentLine = lines[currentIndex]?.text?.trim() || '';
            const nextLine  = lines[currentIndex + 1]?.text?.trim() || '';

            if (type === 'lastLine')    return this.success(lastLine);
            if (type === 'nextLine')    return this.success(nextLine);
            if (type === 'currentLine') return this.success(currentLine);

            return this.success(JSON.stringify({ lastLine, currentLine, nextLine, synced: true }));

        } catch (err) {
            console.error('[Lavalink] Lyrics error:', err);
            return this.customError('Could not fetch lyrics. Player is safe.');
        }
    },
});
//# sourceMappingURL=playerCurrentLyrics.js.map
