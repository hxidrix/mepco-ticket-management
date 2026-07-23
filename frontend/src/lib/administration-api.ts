import { apiClient } from './api';
import type { UserRole } from '../types/auth';
import type { PaginationMeta } from '../types/users';

export interface Announcement { id:number;title:string;body:string;authorName:string;startsAt:string;endsAt:string|null;isActive:number;audiences:UserRole[];createdAt:string;updatedAt:string }
export interface AuditItem { id:number;actorId:number|null;actorName:string|null;actorRole:string|null;action:string;entityType:string;entityId:string|null;result:string;requestId:string|null;ipAddress:string|null;beforeData:unknown;afterData:unknown;metadata:unknown;createdAt:string }
export interface StaffScope { id:number;userId:number;displayName:string;role:string;domain:'consumer'|'employee';departmentId:number|null;departmentName:string|null;categoryId:number|null;categoryName:string|null;circleId:number|null;circleName:string|null;divisionId:number|null;divisionName:string|null;subdivisionId:number|null;subdivisionName:string|null }
function unwrap<T>(payload:unknown):T { if(typeof payload!=='object'||payload===null||!('data'in payload))throw new Error('Invalid API response');return (payload as {data:T}).data; }
export async function activeAnnouncementsRequest():Promise<Announcement[]>{const response=await apiClient.get('/administration/announcements');return unwrap<Announcement[]>(response.data);}
export async function announcementsRequest():Promise<Announcement[]>{const response=await apiClient.get('/administration/announcements/all');return unwrap<Announcement[]>(response.data);}
export async function createAnnouncementRequest(input:Record<string,unknown>):Promise<void>{await apiClient.post('/administration/announcements',input);}
export async function deactivateAnnouncementRequest(id:number):Promise<void>{await apiClient.delete(`/administration/announcements/${id}`);}
export async function auditRequest(page=1,search='',result=''):Promise<{items:AuditItem[];meta:PaginationMeta}>{const response=await apiClient.get('/administration/audit',{params:{page,pageSize:30,...(search===''?{}:{search}),...(result===''?{}:{result})}});return{items:unwrap<AuditItem[]>(response.data),meta:(response.data as {meta:PaginationMeta}).meta};}
export async function scopesRequest():Promise<StaffScope[]>{const response=await apiClient.get('/administration/scopes');return unwrap<StaffScope[]>(response.data);}
export async function replaceScopesRequest(userId:number,scopes:Array<Record<string,unknown>>):Promise<void>{await apiClient.put(`/administration/scopes/${userId}`,{scopes});}
