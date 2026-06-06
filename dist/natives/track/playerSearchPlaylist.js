"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const index_js_1 = require("../../index.js");
exports.default = new forgescript_1.NativeFunction({
    name: '$playerSearchPlaylist',
    description: 'Search for a playlist or a album',
    version: '1.0.0',
    brackets: true,
    unwrap: true,
    args: [
        {
            name: 'guildId',
            description: 'The guild id to search for the track in',
            type: forgescript_1.ArgType.Guild,
            required: true,
            rest: false,
        },
        {
            name: 'query',
            description: 'The query to search for',
            type: forgescript_1.ArgType.String,
            required: true,
            rest: false,
        },
        {
            name: 'source',
            description: 'The source to use. Such as yt for youtube ytm for youtube music etc. Depends on the lavalink server config',
            type: forgescript_1.ArgType.String,
            required: false,
            rest: false,
        },
        {
            name: 'requester',
            description: 'The requester of the track',
            type: forgescript_1.ArgType.Member,
            required: false,
            rest: false,
        },
        {
            name: 'limit',
            description: 'The limit of the tracks to return',
            type: forgescript_1.ArgType.Number,
            required: false,
            rest: false,
        },
    ],
    output: forgescript_1.ArgType.Json,
    async execute(ctx, [guildId, query, source, requester, limit]) {
        const linked = ctx.client.getExtension(index_js_1.ForgeLinked, true).lavalink;
        if (!linked)
            return this.customError('ForgeLinked is not initialized');
        const player = linked.getPlayer(guildId.id);
        if (!player)
            return this.customError('Player not found');
        const info = await player.node.fetchInfo();
        const supported = info.sourceManagers || [];
        let finalQuery = query;
        let type;
        if (source) {
            if (!supported.includes(source)) {
                return this.customError(`Source '${source}' not supported by the Lavalink server`);
            }
            finalQuery = `${source}:playlist:${query}`;
        }
        const result = await player.search(finalQuery, {
            requester: requester?.id ?? ctx.member?.id,
        });
        if (!result.tracks.length)
            return this.customError('No results found!');
        let tracks = result.tracks;
        if (limit)
            tracks = tracks.slice(0, limit);
        return this.successJSON({
            status: 'success',
            source,
            type: result.loadType,
            message: `Found ${tracks.length} playlists matching the query.`,
            requester: result.tracks[0].requester,
            playlistsCount: tracks.length,
            playlists: tracks.map((track) => ({
                title: track.info.title,
                author: track.info.author,
                duration: track.info.duration,
                url: track.info.uri,
                thumbnail: track.info.artworkUrl,
                source,
            })),
        });
    },
});
//# sourceMappingURL=playerSearchTrack.js.map
