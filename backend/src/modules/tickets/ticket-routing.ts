const OPERATIONS_DEPARTMENT = 'Operations (OP) Directorate';
const CUSTOMER_SERVICES_DEPARTMENT = 'Commercial/Customer Services Directorate (CSD)';

/**
 * Consumer categories do not carry a department in the catalog, so creation
 * uses this policy to find the team responsible for the reported issue.
 */
export function consumerRoutingDepartment(categoryName: string): string {
  switch (categoryName.trim().toLowerCase()) {
    case 'non-line complaints':
    case 'leads / requests / others':
      return CUSTOMER_SERVICES_DEPARTMENT;
    case 'line complaints':
    case 'other':
    default:
      return OPERATIONS_DEPARTMENT;
  }
}

