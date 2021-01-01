import { logInfo } from './util/logger';
import hookDiscordEvents from './discord/events';
import hookDbEvents from './db/events';
import randomApi from './random/api';
import client from './discord/client';
import db from './db/db';

const version = process.env.npm_package_version;

const startBot = () => {
  logInfo(`Started Rosiebot ${version}`);
  hookDbEvents(db);
  hookDiscordEvents(client);
  randomApi.generateInteger(1, 100).then((integer) => {
    logInfo(integer, 'random');
  });
};

startBot();
