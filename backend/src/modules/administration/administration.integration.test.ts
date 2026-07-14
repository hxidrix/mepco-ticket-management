import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';

import { app } from '../../app.js';

function token(response:SupertestResponse):string{const value=(response.body as {data?:{accessToken?:unknown}}).data?.accessToken;if(typeof value!=='string')throw new Error('Expected token');return value;}
async function login(mode:'consumer'|'staff',identifier:string):Promise<string>{return token(await request(app).post('/api/v1/auth/login').send({mode,identifier,password:'Demo@12345'}).expect(200));}

describe('administration governance API',()=>{
  it('publishes role-targeted announcements and records the administrative audit event',async()=>{
    const admin=await login('staff','admin.demo');const consumer=await login('consumer','10000000000001');
    const create=await request(app).post('/api/v1/administration/announcements').set('Authorization',`Bearer ${admin}`).send({
      title:'Fictional service bulletin',body:'A fictional acceptance announcement for consumers.',
      startsAt:new Date(Date.now()-3_600_000).toISOString(),endsAt:new Date(Date.now()+86_400_000).toISOString(),
      isActive:true,audiences:['consumer'],
    }).expect(201);
    const id=(create.body as {data:{id:number}}).data.id;
    const visible=await request(app).get('/api/v1/administration/announcements').set('Authorization',`Bearer ${consumer}`).expect(200);
    expect((visible.body as {data:Array<{id:number}>}).data).toEqual(expect.arrayContaining([expect.objectContaining({id})]));
    const audit=await request(app).get('/api/v1/administration/audit?search=announcement.created').set('Authorization',`Bearer ${admin}`).expect(200);
    expect((audit.body as {data:Array<{action:string}>}).data.some((item)=>item.action==='admin.announcement.created')).toBe(true);
    await request(app).delete(`/api/v1/administration/announcements/${id}`).set('Authorization',`Bearer ${admin}`).expect(200);
  });

  it('lets only administrators replace technician and supervisor routing scopes',async()=>{
    const admin=await login('staff','admin.demo');const technicianToken=await login('staff','tech.it');
    const users=await request(app).get('/api/v1/users/admin?role=technician&pageSize=100').set('Authorization',`Bearer ${admin}`).expect(200);
    const technician=(users.body as {data:Array<{id:number;username:string}>}).data.find((item)=>item.username==='tech.it');
    if(technician===undefined)throw new Error('Technician missing');
    await request(app).put(`/api/v1/administration/scopes/${technician.id}`).set('Authorization',`Bearer ${admin}`)
      .send({scopes:[{domain:'employee',canSelfAssign:true}]}).expect(200);
    await request(app).put(`/api/v1/administration/scopes/${technician.id}`).set('Authorization',`Bearer ${admin}`)
      .send({scopes:[{domain:'consumer',departmentId:1}]}).expect(422);
    const scopes=await request(app).get('/api/v1/administration/scopes').set('Authorization',`Bearer ${admin}`).expect(200);
    expect((scopes.body as {data:Array<{userId:number;domain:string;canSelfAssign:number}>}).data)
      .toEqual(expect.arrayContaining([expect.objectContaining({userId:technician.id,domain:'employee',canSelfAssign:1})]));
    await request(app).get('/api/v1/administration/scopes').set('Authorization',`Bearer ${technicianToken}`).expect(403);
  });
});
