import PocketBase from 'pocketbase';

const baseUrl =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}/pb-api`
    : 'http://localhost:8090';

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
