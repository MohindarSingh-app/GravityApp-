const Module = require('node:module');

const resolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilenameWithExpoPolyfill(request, parent, isMain, options) {
  if (request === 'react-native/rn-get-polyfills') {
    return resolveFilename.call(this, '@react-native/js-polyfills', parent, isMain, options);
  }
  return resolveFilename.call(this, request, parent, isMain, options);
};