import { launchImageLibrary } from 'react-native-image-picker';
import type { ImageLibraryOptions } from 'react-native-image-picker';

type PickerOptions = Pick<ImageLibraryOptions, 'quality' | 'includeBase64'>;

export const launchImageLibraryAsync = async (options: PickerOptions = {}) => {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    ...options,
  });

  if (result.errorCode) {
    throw new Error(result.errorMessage || `Image picker failed: ${result.errorCode}.`);
  }

  if (!result.didCancel && !result.assets?.[0]?.uri) {
    throw new Error('The image picker did not return a readable image.');
  }

  const asset = result.assets?.[0];
  return {
    canceled: Boolean(result.didCancel),
    assets: asset?.uri
      ? [{
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.type,
        base64: asset.base64,
      }]
      : [],
  };
};
