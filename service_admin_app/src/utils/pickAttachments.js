import ImagePicker from 'react-native-image-crop-picker';
import ImageResizer from '@bam.tech/react-native-image-resizer';
import RNFS from 'react-native-fs';

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSIONS = [1600, 1200, 900];
const JPEG_QUALITIES = [0.78, 0.62, 0.48];

function base64ByteLength(base64) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function attachmentFileName(asset, mimeType) {
  const source = String(asset.filename || asset.fileName || `fault-photo-${Date.now()}.jpg`)
    .split(/[\\/]/)
    .pop()
    .replace(/[\r\n"]/g, '_');
  const stem = source.replace(/\.[^.]+$/, '') || 'fault-photo';
  return `${stem}.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
}

export async function normalizeAttachmentPhoto(asset, resizer = ImageResizer, fileSystem = RNFS) {
  const sourceUri = asset && (asset.path || asset.uri);
  if (!sourceUri) {
    throw new Error('The selected photo has no readable file. Choose another photo.');
  }

  let width = Number(asset.width) || 0;
  let height = Number(asset.height) || 0;
  const sourceName = String(asset.filename || asset.fileName || '').toLowerCase();
  const sourceMimeType = String(asset.mime || asset.mimeType || '').toLowerCase();
  const outputMimeType = sourceMimeType === 'image/png' || sourceName.endsWith('.png')
    ? 'image/png'
    : 'image/jpeg';
  const format = outputMimeType === 'image/png' ? 'PNG' : 'JPEG';
  const qualities = outputMimeType === 'image/png' ? [1] : JPEG_QUALITIES;

  for (const maxDimension of MAX_DIMENSIONS) {
    const largestDimension = Math.max(width, height);
    const scale = width > 0 && height > 0 && largestDimension > maxDimension
      ? maxDimension / largestDimension
      : 1;
    const targetWidth = width ? Math.max(1, Math.round(width * scale)) : maxDimension;
    const targetHeight = height ? Math.max(1, Math.round(height * scale)) : maxDimension;

    for (const quality of qualities) {
      const resized = await resizer.createResizedImage(
        sourceUri,
        targetWidth,
        targetHeight,
        format,
        Math.round(quality * 100),
        0,
        undefined,
        false,
        { mode: 'contain', onlyScaleDown: true },
      );
      width = width || resized.width;
      height = height || resized.height;

      const contentBase64 = String(await fileSystem.readFile(resized.path, 'base64'))
        .replace(/^data:[^;]+;base64,/, '')
        .replace(/\s/g, '');
      const byteLength = base64ByteLength(contentBase64);
      const hasValidSignature = outputMimeType === 'image/png'
        ? contentBase64.startsWith('iVBORw0KGgo')
        : contentBase64.startsWith('/9j/');
      if (!hasValidSignature || byteLength < 64) {
        throw new Error('The selected photo could not be read. Choose another photo.');
      }
      if (byteLength <= MAX_ATTACHMENT_BYTES) {
        return {
          fileName: attachmentFileName(asset, outputMimeType),
          mimeType: outputMimeType,
          contentBase64,
          previewUri: resized.uri,
        };
      }
    }
  }

  throw new Error('This photo is too large to upload, even after compression. Choose a smaller photo.');
}

function pickerErrorMessage(error) {
  if (error && error.code === 'E_NO_LIBRARY_PERMISSION') {
    return new Error('Allow photo access to attach equipment or project photos.');
  }
  if (error && error.code === 'E_NO_CAMERA_PERMISSION') {
    return new Error('Allow camera access to take an equipment photo.');
  }
  return error;
}

export async function pickAttachmentPhotos(selectionLimit = 5) {
  if (selectionLimit <= 0) return [];

  let result;
  try {
    result = await ImagePicker.openPicker({
      mediaType: 'photo',
      multiple: true,
      maxFiles: selectionLimit,
      includeBase64: false,
      compressImageQuality: 1,
    });
  } catch (error) {
    if (error && error.code === 'E_PICKER_CANCELLED') return [];
    throw pickerErrorMessage(error);
  }

  const assets = Array.isArray(result) ? result : [result];
  if (assets.length > selectionLimit) {
    throw new Error(`Choose no more than ${selectionLimit} photos at once.`);
  }
  const photos = [];
  for (let index = 0; index < assets.length; index += 1) {
    try {
      photos.push(await normalizeAttachmentPhoto(assets[index]));
    } catch (error) {
      const message = error && error.message
        ? error.message
        : 'The photo could not be prepared.';
      throw new Error(`Photo ${index + 1}: ${message}`);
    }
  }
  return photos;
}

export async function captureAttachmentPhoto() {
  let result;
  try {
    result = await ImagePicker.openCamera({
      mediaType: 'photo',
      includeBase64: false,
      compressImageQuality: 1,
    });
  } catch (error) {
    if (error && error.code === 'E_PICKER_CANCELLED') return null;
    throw pickerErrorMessage(error);
  }
  return normalizeAttachmentPhoto(result);
}
