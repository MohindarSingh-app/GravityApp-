import ImagePicker from 'react-native-image-crop-picker';

export async function pickProfilePhoto() {
  let image;
  try {
    image = await ImagePicker.openPicker({
      mediaType: 'photo',
      cropping: true,
      width: 512,
      height: 512,
      compressImageQuality: 0.55,
      includeBase64: true,
    });
  } catch (error) {
    if (error && error.code === 'E_PICKER_CANCELLED') return null;
    if (error && error.code === 'E_NO_LIBRARY_PERMISSION') {
      throw new Error('Allow photo access to add a profile picture.');
    }
    throw error;
  }
  if (!image.data) {
    throw new Error('That photo could not be read. Try another image.');
  }
  return `data:${image.mime || 'image/jpeg'};base64,${image.data}`;
}
