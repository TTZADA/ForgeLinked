import { ArgType, NativeFunction } from '@tryforge/forgescript'

import { ForgeLinked } from '../../index.js'

export default new NativeFunction({
  name: '$playerTrackInfoOf',
  description: 'Get the info of a track',
  version: '1.0.0',
  brackets: true,
  unwrap: true,
  args: [
    {
      name: 'guildId',
      description: 'The guild id to get the track info for',
      type: ArgType.Guild,
      required: true,
      rest: false,
    },
    {
      name: 'index',
      description: 'The index of the track to get the info for',
      type: ArgType.Number,
      required: true,
      rest: false,
    },
  ],
  output: ArgType.Json,
  execute(ctx, [guildId, index]) {
    const linked = ctx.client.getExtension(ForgeLinked, true).lavalink
    if (!linked) return this.customError('ForgeLinked is not initialized')
    const player = linked.getPlayer(guildId.id)
    if (!player) return this.customError('Player not found')
    return this.successJSON(player.queue.tracks[index]?.info)
  },
})
