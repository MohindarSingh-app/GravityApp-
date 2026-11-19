import RNFS from 'react-native-fs';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

const DOCUMENT_TYPES = {
  pdf: { extension: 'pdf' },
  cad: { extensions: ['dwg', 'dxf'] },
  documents: { extensions: ['doc', 'docx', 'xls', 'xlsx', 'txt'] },
};

const MIME_TYPES_BY_EXTENSION = {
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  dwg: 'application/acad',
  dxf: 'application/dxf',
  pdf: 'application/pdf',
  txt: 'text/plain',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function extensionOf(fileName) {
  const match = /\.([^.]+)$/.exec(String(fileName || '').toLowerCase());
  return match ? match[1] : '';
}

function base64ByteLength(base64) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function filePath(uri) {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

export async function pickServiceDocuments(kind, selectionLimit = 5) {
  const documentType = DOCUMENT_TYPES[kind];
  if (!documentType) throw new Error('Choose a supported document type.');

  let files;
  try {
    files = await pick({
      type: [types.allFiles],
      allowMultiSelection: true,
    });
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return [];
    throw error;
  }

  if (files.length > selectionLimit) {
    throw new Error(`Choose no more than ${selectionLimit} files at once.`);
  }

  const prepared = [];
  for (let index = 0; index < files.length; index += 1) {
    const asset = files[index];
    const fileName = String(asset.name || '').split(/[\\/]/).pop();
    const extension = extensionOf(fileName);
    const validExtension = documentType.extension
      ? extension === documentType.extension
      : documentType.extensions.includes(extension);
    if (!validExtension) {
      throw new Error(`File ${index + 1} must be ${documentType.extension ? 'a PDF' : `one of: ${documentType.extensions.join(', ')}`}.`);
    }
    if (!asset.uri) throw new Error(`File ${index + 1} has no readable file location.`);
    if (Number(asset.size) > MAX_ATTACHMENT_BYTES) {
      throw new Error(`File ${index + 1} is larger than 4 MB.`);
    }

    const [copy] = await keepLocalCopy({
      files: [{ uri: asset.uri, fileName }],
      destination: 'cachesDirectory',
    });
    if (!copy || copy.status !== 'success' || !copy.localUri) {
      throw new Error(`File ${index + 1} could not be copied for upload: ${copy?.copyError || 'no local file was returned.'}`);
    }

    const contentBase64 = String(await RNFS.readFile(filePath(copy.localUri), 'base64'))
      .replace(/\s/g, '');
    const byteSize = base64ByteLength(contentBase64);
    if (byteSize < 64 || byteSize > MAX_ATTACHMENT_BYTES) {
      throw new Error(`File ${index + 1} must be between 64 bytes and 4 MB.`);
    }

    prepared.push({
      fileName,
      mimeType: MIME_TYPES_BY_EXTENSION[extension],
      contentBase64,
      byteSize,
      attachmentKind: kind,
    });
  }
  return prepared;
}
