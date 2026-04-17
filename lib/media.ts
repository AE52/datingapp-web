import { MEDIA_API_URL } from '@/api';

export type MediaAssetView = {
  id: number;
  ownerId: number;
  category: string;
  contentType: string;
  originalFileName?: string | null;
  sizeBytes?: number | null;
  uploadStatus: string;
  createdAt: string;
  uploadedAt?: string | null;
};

export type PickedMediaAsset = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
};

type UploadReservationResponse = {
  asset: MediaAssetView;
  uploadUrl: string;
};

type DownloadResponse = {
  assetId: number;
  downloadUrl: string;
};

function resolveMimeType(asset: PickedMediaAsset, fallback: string) {
  if (asset.mimeType && asset.mimeType.trim()) {
    return asset.mimeType;
  }
  if (asset.fileName?.toLowerCase().endsWith('.m4a')) {
    return 'audio/m4a';
  }
  if (asset.fileName?.toLowerCase().endsWith('.mp4')) {
    return 'video/mp4';
  }
  return fallback;
}

export async function uploadMediaAsset(ownerId: number, category: string, asset: PickedMediaAsset, fallbackType: string) {
  const contentType = resolveMimeType(asset, fallbackType);
  const reservationResponse = await fetch(`${MEDIA_API_URL}/upload-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ownerId,
      category,
      contentType,
      fileName: asset.fileName ?? `${category}-${Date.now()}`,
      sizeBytes: asset.fileSize ?? null,
    }),
  });

  if (!reservationResponse.ok) {
    throw new Error('Medya yukleme rezervasyonu olusturulamadi.');
  }

  const reservation = await reservationResponse.json() as UploadReservationResponse;
  const fileResponse = await fetch(asset.uri);
  const blob = await fileResponse.blob();

  const uploadResponse = await fetch(reservation.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error('Medya nesnesi object storage katmanina yuklenemedi.');
  }

  const completeResponse = await fetch(`${MEDIA_API_URL}/${reservation.asset.id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!completeResponse.ok) {
    throw new Error('Medya yukleme tamamlanamadi.');
  }

  return completeResponse.json() as Promise<MediaAssetView>;
}

export async function getMediaDownloadUrl(assetId: number) {
  const response = await fetch(`${MEDIA_API_URL}/${assetId}/download`);
  if (!response.ok) {
    throw new Error('Medya indirme baglantisi alinamadi.');
  }
  const payload = await response.json() as DownloadResponse;
  return payload.downloadUrl;
}
