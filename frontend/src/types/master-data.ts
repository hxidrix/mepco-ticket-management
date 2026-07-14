export type MasterResource =
  | 'departments' | 'circles' | 'cities' | 'categories' | 'complaint-types'
  | 'priorities' | 'statuses';

export interface MasterItem {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean | number;
  sortOrder: number;
  parentId?: number | null;
  parentName?: string | null;
  domain?: 'consumer' | 'employee';
  departmentId?: number | null;
  isConfidential?: boolean | number;
  colorToken?: string;
  slaTargetHours?: number | null;
  isTerminal?: boolean | number;
}

export interface MasterCatalog {
  departments: MasterItem[];
  circles: Array<MasterItem & { cities: MasterItem[] }>;
  categories: Array<MasterItem & { complaintTypes: MasterItem[] }>;
  priorities: MasterItem[];
  statuses: MasterItem[];
}
