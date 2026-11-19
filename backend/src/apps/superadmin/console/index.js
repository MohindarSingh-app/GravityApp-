const express = require('express');
const path = require('path');
const { pathToFileURL } = require('url');
const { tsImport } = require('tsx/esm/api');

const apiModuleUrl = pathToFileURL(
  path.resolve(__dirname, '..', 'console-api', 'index.ts'),
).href;
const parentUrl = pathToFileURL(__filename).href;

function createSuperadminConsole(options = {}) {
  const router = express.Router();
  let initializePromise;

  return {
    router,
    initialize(bootstrap) {
      if (!initializePromise) {
        initializePromise = (async () => {
          const { createSuperadminRouter } = await tsImport(apiModuleUrl, parentUrl);
          const dataFile = options.dataFile
            || process.env.SUPERADMIN_DATA_FILE
            || path.resolve(__dirname, '../../../../data/superadmin-access-control.json');
          router.use(await createSuperadminRouter({
            bootstrap,
            dataFile: path.resolve(dataFile),
          }));
        })().catch((error) => {
          initializePromise = undefined;
          throw error;
        });
      }

      return initializePromise;
    },
  };
}

module.exports = { createSuperadminConsole };