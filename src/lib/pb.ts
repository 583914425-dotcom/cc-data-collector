import PocketBase from 'pocketbase';

const baseUrl = (() => {
  if (typeof window === 'undefined') return 'http://localhost:8090';
  const proto = window.location.protocol;
  const hostname = window.location.hostname;
  // Always use port 5000 so requests reach Express directly,
  // bypassing any CDN that strips port and causes 426 errors.
  const port = window.location.port || '5000';
  return `${proto}//${hostname}:${port}/pb-api`;
})();

export const pb = new PocketBase(baseUrl);

pb.autoCancellation(false);

export type PBUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string;
  created: string;
  updated: string;
};

export function toPatient(record: any) {
  return {
    id: record.id,
    createdAt: record.created,
    updatedAt: record.updated,
    ...(record.patientData || {}),
    name:        record.name        || record.patientData?.name        || '',
    authorUid:   record.authorUid   || record.patientData?.authorUid   || '',
    authorEmail: record.authorEmail || record.patientData?.authorEmail || '',
    authorName:  record.authorName  || record.patientData?.authorName  || '',
  };
}
