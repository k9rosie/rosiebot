import {
  CommandBuilder,
  CommandCallback,
  CommandFormatter,
  CommandMetadata,
  CommandProcessor,
  DiscordResponseContent,
  SeriesSearchParams,
} from 'rosiebot/src/commands/types';
import { Command, ErrorMessage, StatusCode } from 'rosiebot/src/util/enums';
import SeriesModel, { Series } from 'rosiebot/src/db/models/Series';
import WaifuModel, { Waifu } from 'rosiebot/src/db/models/Waifu';
import StudioModel, { Studio } from 'rosiebot/src/db/models/Studio';
import APIField from 'rosiebot/src/util/APIField';
import { pagedInteractiveSeriesMessage } from 'rosiebot/src/discord/embeds/series';
import brandingEmbed from 'rosiebot/src/discord/embeds/branding';
import { pagedInteractiveWaifuMessage } from 'rosiebot/src/discord/embeds/waifu';

const metadata: CommandMetadata = {
  name: Command.ssearch,
  description: 'Search for series',
  arguments: '<search string>',
  supportsDM: true,
};

interface SeriesResults {
  studio?: Studio;
  series: Series | Series[];
  waifu?: Waifu[];
}

const command: CommandCallback<SeriesResults, SeriesSearchParams> = async (
  params
) => {
  const start = Date.now();
  if (params) {
    const { text } = params;
    if (params.studio) {
      const [studioDoc] = await StudioModel.find(
        { $text: { $search: text } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(1)
        .lean()
        .populate(APIField.series);
      const seriesDocs = await SeriesModel.find({
        [APIField.studio]: studioDoc[APIField._id],
      }).lean();
      return {
        time: Date.now() - start,
        statusCode: StatusCode.Success,
        data: { studio: studioDoc, series: seriesDocs },
      };
    }
    const [seriesDoc] = await SeriesModel.find(
      { $text: { $search: text } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(1)
      .lean()
      .populate(APIField.studio);
    const waifuDocs = await WaifuModel.find({
      [APIField.series]: seriesDoc[APIField._id],
    })
      .sort({ [APIField.likes]: -1 })
      .lean()
      .populate(APIField.appearances);
    return {
      statusCode: StatusCode.Success,
      time: Date.now() - start,
      data: { series: seriesDoc, waifu: waifuDocs },
    };
  }
  return {
    statusCode: StatusCode.Error,
  };
};

const processor: CommandProcessor<SeriesResults> = (msg, args) => {
  const query = args.join(' ');
  if (query) {
    const studioRegex = /^studio:/;
    if (query.match(studioRegex)) {
      const text = query.replace(studioRegex, '').trim();
      return command({ text, studio: true });
    }
    return command({ text: query });
  }
  return command();
};

const formatter: CommandFormatter<SeriesResults, Series | Waifu> = (
  result,
  user
) => {
  if (result.data) {
    const { studio, series, waifu } = result.data;
    if (studio && Array.isArray(series)) {
      return {
        embed: pagedInteractiveSeriesMessage(
          series,
          brandingEmbed(result.time),
          false,
          `${user}`
        ),
        content: `${studio[APIField.name]}`,
      };
    }
    if (!Array.isArray(series) && Array.isArray(waifu) && waifu.length > 0) {
      return {
        embed: pagedInteractiveWaifuMessage(
          waifu,
          brandingEmbed(result.time),
          false,
          `${user} Showing results for series ${series[APIField.name]}`
        ),
      } as DiscordResponseContent<Series | Waifu>;
    }
  }
  return { content: ErrorMessage[result.statusCode] };
};

const ssearch: CommandBuilder<
  SeriesResults,
  SeriesSearchParams,
  Series | Waifu
> = {
  metadata,
  command,
  processor,
  formatter,
};

export default ssearch;
