import { useContext } from 'react';

import { PublicComplaintContext } from '../context/public-complaint-context';

export function usePublicComplaint() {
  const value = useContext(PublicComplaintContext);
  if (value === null) throw new Error('usePublicComplaint must be used inside PublicComplaintProvider');
  return value;
}
