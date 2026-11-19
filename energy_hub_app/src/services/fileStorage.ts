import RNFS from 'react-native-fs';

export const readFileAsBase64 = (uri: string): Promise<string> => {
  const path = uri.startsWith('file://')
    ? decodeURIComponent(uri.slice('file://'.length))
    : uri;
  return RNFS.readFile(path, 'base64');
};
