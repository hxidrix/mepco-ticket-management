import { randomUUID } from 'node:crypto';

import { hash } from 'bcryptjs';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { env } from '../config/env.js';
import { databasePool } from './pool.js';
import { effectiveSlaTargetHours } from '../shared/sla.js';
import {
  categories,
  circles,
  complaintTypeSlaTargetHours,
  departments,
  priorities,
  roles,
  slugify,
  ticketStatuses,
} from './seeds/catalog-data.js';

interface IdRow extends RowDataPacket {
  id: number;
}

interface CountRow extends RowDataPacket {
  count: number;
}

interface TestUserIds {
  consumer: number;
  suspendedConsumer: number;
  employee: number;
  technicianIt: number;
  technicianOps: number;
  technicianCsd: number;
  supervisor: number;
  administrator: number;
}

interface DemoUserIds {
  employee: number;
  suspendedEmployee: number;
  technicianIt: number;
  technicianOps: number;
  technicianCsd: number;
  supervisor: number;
  administrator: number;
}

interface ConsumerRecordSeedRow extends RowDataPacket {
  id: number;
  referenceNumber: string;
  consumerId: string;
  registeredPhone: string | null;
  circleId: number;
  divisionId: number;
  subdivisionId: number;
  circleName: string;
  divisionName: string;
  subdivisionName: string;
}

const testCredentials = Object.freeze({
  consumer: { identifier: '10000000000001', password: 'Demo@12345' },
  employee: { identifier: '00000001', password: 'Demo@12345' },
  technician: { identifier: 'tech.it', password: 'Demo@12345' },
  supervisor: { identifier: 'supervisor.demo', password: 'Demo@12345' },
  administrator: { identifier: 'admin.demo', password: 'Demo@12345' },
});

const localDemoPassword = 'MepcoDemo@2026!';

async function idBy(
  connection: PoolConnection,
  table: string,
  column: string,
  value: string,
): Promise<number> {
  const sql = `SELECT id FROM ${connection.escapeId(table)} WHERE ${connection.escapeId(column)} = ? LIMIT 1`;
  const [rows] = await connection.execute<IdRow[]>(sql, [value]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`Missing ${table}.${column} value: ${value}`);
  return id;
}

async function categoryIdBy(
  connection: PoolConnection,
  domain: 'consumer' | 'employee',
  slug: string,
): Promise<number> {
  const [rows] = await connection.execute<IdRow[]>(
    'SELECT id FROM categories WHERE domain = ? AND slug = ? LIMIT 1',
    [domain, slug],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`Missing ${domain} category: ${slug}`);
  return id;
}

async function upsertMasterData(connection: PoolConnection): Promise<void> {
  for (const [name, description] of roles) {
    await connection.execute(
      `INSERT INTO roles (name, description, is_active)
       VALUES (?, ?, TRUE)
       ON DUPLICATE KEY UPDATE description = VALUES(description), is_active = TRUE`,
      [name, description],
    );
  }

  for (const [index, department] of departments.entries()) {
    await connection.execute(
      `INSERT INTO departments (name, slug, description, is_active, sort_order)
       VALUES (?, ?, ?, TRUE, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), description = VALUES(description), is_active = TRUE,
         sort_order = VALUES(sort_order)`,
      [department.name, slugify(department.name), department.description, index + 1],
    );
  }

  for (const [circleIndex, circle] of circles.entries()) {
    await connection.execute(
      `INSERT INTO circles (name, slug, is_active, sort_order)
       VALUES (?, ?, TRUE, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = TRUE, sort_order = VALUES(sort_order)`,
      [circle.name, slugify(circle.name), circleIndex + 1],
    );
    const circleId = await idBy(connection, 'circles', 'slug', slugify(circle.name));
    await connection.execute(
      `INSERT INTO cities (circle_id, name, slug, is_active, sort_order)
       VALUES (?, 'Other', 'other', FALSE, 9999)
       ON DUPLICATE KEY UPDATE is_active = FALSE`,
      [circleId],
    );

    for (const [divisionIndex, division] of circle.divisions.entries()) {
      await connection.execute(
        `INSERT INTO divisions (circle_id, name, slug, is_active, sort_order)
         VALUES (?, ?, ?, TRUE, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = TRUE, sort_order = VALUES(sort_order)`,
        [circleId, division.name, slugify(division.name), divisionIndex + 1],
      );
      const [divisionRows] = await connection.execute<IdRow[]>(
        'SELECT id FROM divisions WHERE circle_id = ? AND slug = ? LIMIT 1',
        [circleId, slugify(division.name)],
      );
      const divisionId = divisionRows[0]?.id;
      if (divisionId === undefined) throw new Error(`Missing division: ${division.name}`);
      for (const [subdivisionIndex, subdivision] of division.subdivisions.entries()) {
        await connection.execute(
          `INSERT INTO subdivisions (division_id, name, slug, is_active, sort_order)
           VALUES (?, ?, ?, TRUE, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = TRUE,
             sort_order = VALUES(sort_order)`,
          [divisionId, subdivision, slugify(subdivision), subdivisionIndex + 1],
        );
      }
    }
  }

  for (const [index, [name, slug, description, colorToken, slaTargetHours]] of priorities.entries()) {
    await connection.execute(
      `INSERT INTO priorities
         (name, slug, description, color_token, sla_target_hours, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, TRUE, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), description = VALUES(description), color_token = VALUES(color_token),
         sla_target_hours = VALUES(sla_target_hours), is_active = TRUE, sort_order = VALUES(sort_order)`,
      [name, slug, description, colorToken, slaTargetHours, index + 1],
    );
  }

  for (const [index, [name, slug, description, isTerminal]] of ticketStatuses.entries()) {
    await connection.execute(
      `INSERT INTO ticket_statuses
         (name, slug, description, is_terminal, is_active, sort_order)
       VALUES (?, ?, ?, ?, TRUE, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), description = VALUES(description), is_terminal = VALUES(is_terminal),
         is_active = TRUE, sort_order = VALUES(sort_order)`,
      [name, slug, description, isTerminal, index + 1],
    );
  }

  for (const [categoryIndex, category] of categories.entries()) {
    const departmentId =
      category.department === undefined
        ? null
        : await idBy(connection, 'departments', 'name', category.department);
    const categorySlug = slugify(category.name);

    await connection.execute(
      `INSERT INTO categories
         (domain, department_id, name, slug, description, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, TRUE, ?)
       ON DUPLICATE KEY UPDATE
         department_id = VALUES(department_id), name = VALUES(name), description = VALUES(description),
         is_active = TRUE, sort_order = VALUES(sort_order)`,
      [
        category.domain,
        departmentId,
        category.name,
        categorySlug,
        `${category.name} classification for ${category.domain} tickets`,
        categoryIndex + 1,
      ],
    );

    const categoryId = await categoryIdBy(connection, category.domain, categorySlug);

    for (const [typeIndex, complaintType] of category.complaintTypes.entries()) {
      const isConfidential = category.confidentialTypes?.includes(complaintType) ?? false;
      const slaTargetHours = complaintTypeSlaTargetHours(
        category.domain,
        category.name,
        complaintType,
      );
      await connection.execute(
        `INSERT INTO complaint_types
           (category_id, name, slug, sla_target_hours, is_confidential, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, TRUE, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), sla_target_hours = VALUES(sla_target_hours),
           is_confidential = VALUES(is_confidential), is_active = TRUE,
           sort_order = VALUES(sort_order)`,
        [
          categoryId,
          complaintType,
          slugify(complaintType),
          slaTargetHours,
          isConfidential,
          typeIndex + 1,
        ],
      );
    }
  }
}

async function demoWorkLocation(connection: PoolConnection): Promise<{
  circleId: number;
  divisionId: number;
  subdivisionId: number;
  label: string;
}> {
  const circleId = await idBy(connection, 'circles', 'name', 'Multan Circle');
  const [divisionRows] = await connection.execute<IdRow[]>(
    'SELECT id FROM divisions WHERE circle_id=? AND name=? LIMIT 1',
    [circleId, 'Multan Cantt Division'],
  );
  const divisionId = divisionRows[0]?.id;
  if (divisionId === undefined) throw new Error('Seed work division was not found');
  const [subdivisionRows] = await connection.execute<IdRow[]>(
    'SELECT id FROM subdivisions WHERE division_id=? AND name=? LIMIT 1',
    [divisionId, 'Cantt'],
  );
  const subdivisionId = subdivisionRows[0]?.id;
  if (subdivisionId === undefined) throw new Error('Seed work sub-division was not found');
  return {
    circleId,
    divisionId,
    subdivisionId,
    label: 'Multan Circle / Multan Cantt Division / Cantt',
  };
}

const realisticConsumerRecords = [
  ['10012345678901', '0123456789', 'Muhammad Ahmad', '03011234567', 'A-1a Residential', 'Multan Circle', 'Multan Cantt Division', 'Cantt'],
  ['10012345678902', '0123456790', 'Fatima Zahra', null, 'A-1b Residential', 'Multan Circle', 'Mumtazabad Division', 'Mumtazabad'],
  ['10012345678903', '0123456791', 'Ali Raza', '03021234567', 'A-2 Commercial', 'Khanewal Circle', 'Khanewal Division', 'Civil Lines'],
  ['10012345678904', '0123456792', 'Ayesha Siddiqua', '03031234567', 'A-1a Residential', 'Vehari Circle', 'Vehari Division', 'Vehari City'],
  ['10012345678905', '0123456793', 'Usman Tariq', null, 'A-3 General Services', 'Sahiwal Circle', 'Sahiwal 1st Division', 'Farid Town'],
  ['10012345678906', '0123456794', 'Maryam Iqbal', '03041234567', 'A-1b Residential', 'Dera Ghazi Khan (D.G. Khan) Circle', 'D.G. Khan Division', 'D.G. Khan-I'],
  ['10012345678907', '0123456795', 'Hassan Mehmood', '03051234567', 'A-1a Residential', 'Muzaffargarh Circle', 'Muzaffargarh Division', 'Muzaffargarh City'],
  ['10012345678908', '0123456796', 'Zainab Noor', null, 'A-1b Residential', 'Layyah Circle', 'Layyah Division', 'Layyah City'],
  ['10012345678909', '0123456797', 'Bilal Hussain', '03061234567', 'A-2 Commercial', 'Bahawalpur Circle', 'Bahawalpur Division (Model Town)', 'Satellite Town'],
  ['10012345678910', '0123456798', 'Sana Khalid', '03071234567', 'A-1a Residential', 'Bahawalnagar Circle', 'Bahawalnagar Division', 'Bahawalnagar City'],
  ['10012345678911', '0123456799', 'Hamza Nadeem', null, 'A-3 General Services', 'Rahim Yar Khan Circle', 'Rahim Yar Khan Division', 'RYK City'],
] as const;

async function seedConsumerRecords(connection: PoolConnection): Promise<void> {
  for (const [referenceNumber, consumerId, fullName, phone, tariff, circleName,
    divisionName, subdivisionName] of realisticConsumerRecords) {
    const circleId = await idBy(connection, 'circles', 'name', circleName);
    const [divisionRows] = await connection.execute<IdRow[]>(
      'SELECT id FROM divisions WHERE circle_id = ? AND name = ? LIMIT 1',
      [circleId, divisionName],
    );
    const divisionId = divisionRows[0]?.id;
    if (divisionId === undefined) throw new Error(`Missing seed division: ${divisionName}`);
    const [subdivisionRows] = await connection.execute<IdRow[]>(
      'SELECT id FROM subdivisions WHERE division_id = ? AND name = ? LIMIT 1',
      [divisionId, subdivisionName],
    );
    const subdivisionId = subdivisionRows[0]?.id;
    if (subdivisionId === undefined) throw new Error(`Missing seed sub-division: ${subdivisionName}`);
    await connection.execute(
      `INSERT INTO consumer_records
        (reference_number, consumer_id, full_name, registered_phone, tariff,
         circle_id, division_id, subdivision_id, service_address, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE
         consumer_id = VALUES(consumer_id), full_name = VALUES(full_name),
         registered_phone = VALUES(registered_phone), tariff = VALUES(tariff),
         circle_id = VALUES(circle_id), division_id = VALUES(division_id),
         subdivision_id = VALUES(subdivision_id), service_address = VALUES(service_address),
         is_active = TRUE`,
      [referenceNumber, consumerId, fullName, phone, tariff, circleId, divisionId,
        subdivisionId, `${subdivisionName}, ${divisionName}`],
    );
  }
}

async function upsertStaffUser(
  connection: PoolConnection,
  roleName: 'technician' | 'supervisor' | 'administrator',
  username: string,
  displayName: string,
  passwordHash: string,
  departmentName: string | null,
  designation: string,
): Promise<number> {
  const roleId = await idBy(connection, 'roles', 'name', roleName);
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO users (role_id, display_name, username, email, phone, password_hash, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')
     ON DUPLICATE KEY UPDATE
       id = LAST_INSERT_ID(id), role_id = VALUES(role_id), display_name = VALUES(display_name),
       password_hash = VALUES(password_hash), status = 'active', deleted_at = NULL`,
    [roleId, displayName, username, `${username}@example.test`, '03000000000', passwordHash],
  );
  const userId = result.insertId;
  const departmentId =
    departmentName === null ? null : await idBy(connection, 'departments', 'name', departmentName);
  const location = await demoWorkLocation(connection);

  await connection.execute(
    `INSERT INTO staff_profiles
       (user_id,department_id,designation,work_location,circle_id,division_id,subdivision_id)
     VALUES (?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       department_id = VALUES(department_id), designation = VALUES(designation),
       work_location = VALUES(work_location),circle_id=VALUES(circle_id),
       division_id=VALUES(division_id),subdivision_id=VALUES(subdivision_id)`,
    [
      userId,
      departmentId,
      designation,
      location.label,
      location.circleId,
      location.divisionId,
      location.subdivisionId,
    ],
  );
  return userId;
}

async function upsertConsumer(
  connection: PoolConnection,
  referenceNumber: string,
  displayName: string,
  passwordHash: string,
  status: 'active' | 'suspended',
): Promise<number> {
  const [existing] = await connection.execute<IdRow[]>(
    'SELECT user_id AS id FROM consumer_profiles WHERE reference_number = ?',
    [referenceNumber],
  );
  const roleId = await idBy(connection, 'roles', 'name', 'consumer');
  const circleId = await idBy(connection, 'circles', 'name', 'Multan Circle');
  const [divisionRows] = await connection.execute<IdRow[]>(
    'SELECT id FROM divisions WHERE circle_id = ? AND name = ? LIMIT 1',
    [circleId, 'Multan Cantt Division'],
  );
  const divisionId = divisionRows[0]?.id;
  if (divisionId === undefined) throw new Error('Seed division Multan Cantt Division was not found');
  const [subdivisionRows] = await connection.execute<IdRow[]>(
    'SELECT id FROM subdivisions WHERE division_id = ? AND name = ? LIMIT 1',
    [divisionId, 'Cantt'],
  );
  const subdivisionId = subdivisionRows[0]?.id;
  if (subdivisionId === undefined) throw new Error('Seed sub-division Cantt was not found');
  const [legacyCityRows] = await connection.execute<IdRow[]>(
    `SELECT id FROM cities WHERE circle_id = ? AND slug = 'other' LIMIT 1`,
    [circleId],
  );
  const legacyCityId = legacyCityRows[0]?.id;
  if (legacyCityId === undefined) throw new Error('Seed legacy location placeholder was not found');
  let userId = existing[0]?.id;

  if (userId === undefined) {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO users
         (role_id, display_name, email, phone, password_hash, status, status_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        roleId,
        displayName,
        `${referenceNumber}@consumer.example.test`,
        '03001111111',
        passwordHash,
        status,
        status === 'suspended' ? 'Fictional suspended-account acceptance scenario' : null,
      ],
    );
    userId = result.insertId;
    await connection.execute(
      `INSERT INTO consumer_profiles
         (user_id, reference_number, address, circle_id, division_id, subdivision_id, city_id,
          service_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        referenceNumber,
        'Fictional Consumer Address, Multan',
        circleId,
        divisionId,
        subdivisionId,
        legacyCityId,
        'Fictional Service Location, Multan',
      ],
    );
  } else {
    await connection.execute(
      `UPDATE users SET role_id = ?, display_name = ?, password_hash = ?, status = ?,
         status_reason = ?, deleted_at = NULL WHERE id = ?`,
      [
        roleId,
        displayName,
        passwordHash,
        status,
        status === 'suspended' ? 'Fictional suspended-account acceptance scenario' : null,
        userId,
      ],
    );
    await connection.execute(
      `UPDATE consumer_profiles
       SET circle_id = ?, division_id = ?, subdivision_id = ?
       WHERE user_id = ?`,
      [circleId, divisionId, subdivisionId, userId],
    );
  }
  return userId;
}

async function upsertEmployee(
  connection: PoolConnection,
  employeeId: string,
  displayName: string,
  passwordHash: string,
): Promise<number> {
  const [existing] = await connection.execute<IdRow[]>(
    'SELECT user_id AS id FROM employee_profiles WHERE employee_id = ?',
    [employeeId],
  );
  const roleId = await idBy(connection, 'roles', 'name', 'employee');
  const departmentId = await idBy(
    connection,
    'departments',
    'name',
    'Information Technology (IT) Directorate',
  );
  const location = await demoWorkLocation(connection);
  let userId = existing[0]?.id;

  if (userId === undefined) {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO users (role_id, display_name, email, phone, password_hash, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [roleId, displayName, 'employee.demo@example.test', '03002222222', passwordHash],
    );
    userId = result.insertId;
    await connection.execute(
      `INSERT INTO employee_profiles
         (user_id,employee_id,department_id,designation,work_location,
          circle_id,division_id,subdivision_id)
       VALUES (?, ?, ?, 'Junior Software Engineer', ?, ?, ?, ?)`,
      [
        userId,
        employeeId,
        departmentId,
        location.label,
        location.circleId,
        location.divisionId,
        location.subdivisionId,
      ],
    );
  } else {
    await connection.execute(
      `UPDATE users SET role_id = ?, display_name = ?, password_hash = ?, status = 'active',
         deleted_at = NULL WHERE id = ?`,
      [roleId, displayName, passwordHash, userId],
    );
    await connection.execute(
      `UPDATE employee_profiles
       SET department_id=?,work_location=?,circle_id=?,division_id=?,subdivision_id=?
       WHERE user_id=?`,
      [
        departmentId,
        location.label,
        location.circleId,
        location.divisionId,
        location.subdivisionId,
        userId,
      ],
    );
  }
  return userId;
}

async function seedUsers(connection: PoolConnection): Promise<TestUserIds> {
  const passwordHash = await hash('Demo@12345', 12);
  const consumer = await upsertConsumer(
    connection,
    testCredentials.consumer.identifier,
    'Ayesha Demo Consumer',
    passwordHash,
    'active',
  );
  const suspendedConsumer = await upsertConsumer(
    connection,
    '10000000000099',
    'Suspended Demo Consumer',
    passwordHash,
    'suspended',
  );
  const employee = await upsertEmployee(
    connection,
    testCredentials.employee.identifier,
    'Hamza Demo Employee',
    passwordHash,
  );
  const technicianIt = await upsertStaffUser(
    connection,
    'technician',
    'tech.it',
    'Sara IT Technician',
    passwordHash,
    'Information Technology (IT) Directorate',
    'IT Support Technician',
  );
  const technicianOps = await upsertStaffUser(
    connection,
    'technician',
    'tech.ops',
    'Bilal Operations Technician',
    passwordHash,
    'Operations (OP) Directorate',
    'Operations Technician',
  );
  const technicianCsd = await upsertStaffUser(
    connection,
    'technician',
    'tech.csd',
    'Zain Customer Services Technician',
    passwordHash,
    'Commercial/Customer Services Directorate (CSD)',
    'Customer Services Technician',
  );
  const supervisor = await upsertStaffUser(
    connection,
    'supervisor',
    'supervisor.demo',
    'Mariam Demo Supervisor',
    passwordHash,
    'Information Technology (IT) Directorate',
    'Help Desk Supervisor',
  );
  const administrator = await upsertStaffUser(
    connection,
    'administrator',
    'admin.demo',
    'Usman Demo Administrator',
    passwordHash,
    'Information Technology (IT) Directorate',
    'System Administrator',
  );
  const inactiveTechnician = await upsertStaffUser(
    connection,
    'technician',
    'tech.inactive',
    'Inactive Demo Technician',
    passwordHash,
    'Information Technology (IT) Directorate',
    'Inactive Acceptance Account',
  );
  await connection.execute(
    "UPDATE users SET status = 'inactive', status_reason = 'Fictional inactive-account scenario' WHERE id = ?",
    [inactiveTechnician],
  );
  const fictionalCnics: Array<[number, string]> = [
    [consumer, '3520200000001'],
    [suspendedConsumer, '3520200000002'],
    [employee, '3520200000003'],
    [technicianIt, '3520200000004'],
    [technicianOps, '3520200000005'],
    [technicianCsd, '3520200000006'],
    [supervisor, '3520200000007'],
    [administrator, '3520200000008'],
    [inactiveTechnician, '3520200000009'],
  ];
  for (const [userId, cnic] of fictionalCnics) {
    await connection.execute('UPDATE users SET cnic = ? WHERE id = ?', [cnic, userId]);
  }

  const itDepartmentId = await idBy(
    connection,
    'departments',
    'name',
    'Information Technology (IT) Directorate',
  );
  const opsDepartmentId = await idBy(
    connection,
    'departments',
    'name',
    'Operations (OP) Directorate',
  );
  const csdDepartmentId = await idBy(
    connection,
    'departments',
    'name',
    'Commercial/Customer Services Directorate (CSD)',
  );
  await connection.execute('DELETE FROM staff_scopes WHERE user_id IN (?, ?, ?, ?)', [
    technicianIt,
    technicianOps,
    technicianCsd,
    supervisor,
  ]);
  await connection.execute(
    `INSERT INTO staff_scopes (user_id, domain, department_id, can_self_assign)
     VALUES (?, 'employee', ?, FALSE), (?, 'consumer', NULL, FALSE),
            (?, 'employee', ?, FALSE), (?, 'consumer', NULL, FALSE),
            (?, 'employee', ?, FALSE), (?, 'consumer', NULL, FALSE),
            (?, 'employee', NULL, FALSE), (?, 'consumer', NULL, FALSE)`,
    [
      technicianIt,
      itDepartmentId,
      technicianIt,
      technicianOps,
      opsDepartmentId,
      technicianOps,
      technicianCsd,
      csdDepartmentId,
      technicianCsd,
      supervisor,
      supervisor,
    ],
  );

  return {
    consumer,
    suspendedConsumer,
    employee,
    technicianIt,
    technicianOps,
    technicianCsd,
    supervisor,
    administrator,
  };
}

async function updateDemoIdentity(
  connection: PoolConnection,
  userId: number,
  email: string,
  phone: string,
  cnic: string,
): Promise<void> {
  await connection.execute(
    `UPDATE users
     SET email = ?, phone = ?, cnic = ?, status = 'active', status_reason = NULL,
         locked_until = NULL, failed_login_count = 0, deleted_at = NULL
     WHERE id = ?`,
    [email, phone, cnic, userId],
  );
}

async function seedLocalDemoUsers(connection: PoolConnection): Promise<DemoUserIds> {
  const passwordHash = await hash(localDemoPassword, 12);
  const employee = await upsertEmployee(connection, '00001001', 'Hamza Nadeem', passwordHash);
  const suspendedEmployee = await upsertEmployee(connection, '00001002', 'Areeba Khan', passwordHash);
  const technicianIt = await upsertStaffUser(
    connection,
    'technician',
    'tech.it.local',
    'Sara Ahmed',
    passwordHash,
    'Information Technology (IT) Directorate',
    'IT Support Technician',
  );
  const technicianOps = await upsertStaffUser(
    connection,
    'technician',
    'tech.ops.local',
    'Bilal Hussain',
    passwordHash,
    'Operations (OP) Directorate',
    'Operations Technician',
  );
  const technicianCsd = await upsertStaffUser(
    connection,
    'technician',
    'tech.csd.local',
    'Zain Ali',
    passwordHash,
    'Commercial/Customer Services Directorate (CSD)',
    'Customer Services Technician',
  );
  const supervisor = await upsertStaffUser(
    connection,
    'supervisor',
    'supervisor.multan',
    'Mariam Raza',
    passwordHash,
    'Operations (OP) Directorate',
    'Circle Support Supervisor',
  );
  const administrator = await upsertStaffUser(
    connection,
    'administrator',
    'admin.local',
    'Usman Khalid',
    passwordHash,
    'Information Technology (IT) Directorate',
    'System Administrator',
  );

  const identities: Array<[number, string, string, string]> = [
    [employee, 'hamza.nadeem@mepco.local', '03010001001', '3520212345601'],
    [suspendedEmployee, 'areeba.khan@mepco.local', '03010001002', '3520212345602'],
    [technicianIt, 'sara.ahmed@mepco.local', '03010001003', '3520212345603'],
    [technicianOps, 'bilal.hussain@mepco.local', '03010001004', '3520212345604'],
    [technicianCsd, 'zain.ali@mepco.local', '03010001005', '3520212345605'],
    [supervisor, 'mariam.raza@mepco.local', '03010001006', '3520212345606'],
    [administrator, 'usman.khalid@mepco.local', '03010001007', '3520212345607'],
  ];
  for (const [userId, email, phone, cnic] of identities) {
    await updateDemoIdentity(connection, userId, email, phone, cnic);
  }
  await connection.execute(
    `UPDATE users
     SET status = 'suspended', status_reason = 'Pending verification of an HR record'
     WHERE id = ?`,
    [suspendedEmployee],
  );

  const itDepartmentId = await idBy(
    connection,
    'departments',
    'name',
    'Information Technology (IT) Directorate',
  );
  const operationsDepartmentId = await idBy(
    connection,
    'departments',
    'name',
    'Operations (OP) Directorate',
  );
  const customerServicesDepartmentId = await idBy(
    connection,
    'departments',
    'name',
    'Commercial/Customer Services Directorate (CSD)',
  );
  await connection.execute(
    'DELETE FROM staff_scopes WHERE user_id IN (?, ?, ?, ?)',
    [technicianIt, technicianOps, technicianCsd, supervisor],
  );
  await connection.execute(
    `INSERT INTO staff_scopes (user_id, domain, department_id, can_self_assign)
     VALUES (?, 'employee', ?, FALSE), (?, 'consumer', NULL, FALSE),
            (?, 'employee', ?, FALSE), (?, 'consumer', NULL, FALSE),
            (?, 'employee', ?, FALSE), (?, 'consumer', NULL, FALSE),
            (?, 'employee', NULL, FALSE), (?, 'consumer', NULL, FALSE)`,
    [
      technicianIt,
      itDepartmentId,
      technicianIt,
      technicianOps,
      operationsDepartmentId,
      technicianOps,
      technicianCsd,
      customerServicesDepartmentId,
      technicianCsd,
      supervisor,
      supervisor,
    ],
  );

  return {
    employee,
    suspendedEmployee,
    technicianIt,
    technicianOps,
    technicianCsd,
    supervisor,
    administrator,
  };
}

interface TicketSeed {
  ticketNumber: string;
  domain: 'consumer' | 'employee';
  requesterId: number;
  subject: string;
  description: string;
  categoryName: string;
  complaintTypeName: string;
  departmentName?: string;
  prioritySlug: 'low' | 'medium' | 'high' | 'critical';
  statusSlug: string;
  assigneeId?: number;
  ageDays: number;
  resolution?: string;
}

async function ensureTicket(
  connection: PoolConnection,
  seed: TicketSeed,
  supervisorId: number,
): Promise<void> {
  const [existing] = await connection.execute<CountRow[]>(
    'SELECT COUNT(*) AS count FROM tickets WHERE ticket_number = ?',
    [seed.ticketNumber],
  );
  if ((existing[0]?.count ?? 0) > 0) return;

  const categoryId = await categoryIdBy(connection, seed.domain, slugify(seed.categoryName));
  const [complaintRows] = await connection.execute<IdRow[]>(
    'SELECT id FROM complaint_types WHERE category_id = ? AND slug = ? LIMIT 1',
    [categoryId, slugify(seed.complaintTypeName)],
  );
  const complaintTypeId = complaintRows[0]?.id;
  if (complaintTypeId === undefined) throw new Error(`Missing complaint type ${seed.complaintTypeName}`);
  const priorityId = await idBy(connection, 'priorities', 'slug', seed.prioritySlug);
  const complaintSlaTargetHours = complaintTypeSlaTargetHours(
    seed.domain,
    seed.categoryName,
    seed.complaintTypeName,
  );
  const prioritySlaTargetHours = priorities.find(([, slug]) => slug === seed.prioritySlug)?.[4]
    ?? null;
  const slaTargetHours = effectiveSlaTargetHours(
    complaintSlaTargetHours,
    prioritySlaTargetHours,
  );
  const statusId = await idBy(connection, 'ticket_statuses', 'slug', seed.statusSlug);
  const departmentId =
    seed.departmentName === undefined
      ? null
      : await idBy(connection, 'departments', 'name', seed.departmentName);
  const circleId = seed.domain === 'consumer' ? await idBy(connection, 'circles', 'name', 'Multan Circle') : null;
  let divisionId: number | null = null;
  let subdivisionId: number | null = null;
  if (circleId !== null) {
    const [divisionRows] = await connection.execute<IdRow[]>(
      'SELECT id FROM divisions WHERE circle_id = ? AND name = ? LIMIT 1',
      [circleId, 'Multan Cantt Division'],
    );
    divisionId = divisionRows[0]?.id ?? null;
    if (divisionId !== null) {
      const [subdivisionRows] = await connection.execute<IdRow[]>(
        'SELECT id FROM subdivisions WHERE division_id = ? AND name = ? LIMIT 1',
        [divisionId, 'Cantt'],
      );
      subdivisionId = subdivisionRows[0]?.id ?? null;
    }
  }
  const createdAt = new Date(Date.now() - seed.ageDays * 86_400_000);

  const [ticketResult] = await connection.execute<ResultSetHeader>(
    `INSERT INTO tickets (
       ticket_number, requester_id, domain, subject, description, category_id, complaint_type_id,
       department_id, circle_id, division_id, subdivision_id, location_details, priority_id,
       complaint_sla_target_hours, sla_target_hours, status_id,
       current_assignee_id, resolution_summary, category_name_snapshot,
       complaint_type_name_snapshot, department_name_snapshot, circle_name_snapshot,
       division_name_snapshot, subdivision_name_snapshot, resolved_at, closed_at, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      seed.ticketNumber,
      seed.requesterId,
      seed.domain,
      seed.subject,
      seed.description,
      categoryId,
      complaintTypeId,
      departmentId,
      circleId,
      divisionId,
      subdivisionId,
      seed.domain === 'consumer' ? 'Fictional service location, Multan' : 'Fictional demo office',
      priorityId,
      complaintSlaTargetHours,
      slaTargetHours,
      statusId,
      seed.assigneeId ?? null,
      seed.resolution ?? null,
      seed.categoryName,
      seed.complaintTypeName,
      seed.departmentName ?? null,
      seed.domain === 'consumer' ? 'Multan Circle' : null,
      seed.domain === 'consumer' ? 'Multan Cantt Division' : null,
      seed.domain === 'consumer' ? 'Cantt' : null,
      ['resolved', 'closed'].includes(seed.statusSlug) ? createdAt : null,
      seed.statusSlug === 'closed' ? createdAt : null,
      createdAt,
    ],
  );
  const ticketId = ticketResult.insertId;
  await connection.execute(
    `INSERT INTO ticket_history
       (ticket_id, event_type, actor_id, new_value, reason, created_at)
     VALUES (?, 'ticket_created', ?, ?, 'Fictional seeded workflow', ?)`,
    [ticketId, seed.requesterId, JSON.stringify({ status: 'new' }), createdAt],
  );

  if (seed.assigneeId !== undefined) {
    await connection.execute(
      `INSERT INTO assignments (ticket_id, technician_id, assigned_by, reason, assigned_at)
       VALUES (?, ?, ?, 'Fictional seeded assignment', ?)`,
      [ticketId, seed.assigneeId, supervisorId, createdAt],
    );
    await connection.execute(
      `INSERT INTO ticket_history
         (ticket_id, event_type, actor_id, new_value, reason, created_at)
       VALUES (?, 'assigned', ?, ?, 'Fictional seeded assignment', ?)`,
      [ticketId, supervisorId, JSON.stringify({ technicianId: seed.assigneeId }), createdAt],
    );
    await connection.execute(
      `INSERT INTO comments (ticket_id, author_id, visibility, body, created_at)
       VALUES (?, ?, 'public', 'The ticket is being reviewed by the assigned team.', ?)`,
      [ticketId, seed.assigneeId, createdAt],
    );
    await connection.execute(
      `INSERT INTO comments (ticket_id, author_id, visibility, body, created_at)
       VALUES (?, ?, 'internal', 'Fictional diagnostic note for demonstration reporting.', ?)`,
      [ticketId, seed.assigneeId, createdAt],
    );
  }

  await connection.execute(
    `INSERT INTO notifications (recipient_id, type, title, message, target_type, target_id, created_at)
     VALUES (?, 'ticket_created', 'Ticket submitted', ?, 'ticket', ?, ?)`,
    [seed.requesterId, `${seed.ticketNumber} was created`, ticketId, createdAt],
  );
}

interface PublicTicketSeed {
  ticketNumber: string;
  referenceNumber: string;
  subject: string;
  description: string;
  categoryName: string;
  complaintTypeName: string;
  prioritySlug: 'low' | 'medium' | 'high' | 'critical';
  statusSlug: string;
  assigneeId?: number;
  ageDays: number;
  resolution?: string;
}

async function ensurePublicDemoTicket(
  connection: PoolConnection,
  seed: PublicTicketSeed,
  supervisorId: number,
): Promise<void> {
  const [existing] = await connection.execute<CountRow[]>(
    'SELECT COUNT(*) AS count FROM tickets WHERE ticket_number = ?',
    [seed.ticketNumber],
  );
  if ((existing[0]?.count ?? 0) > 0) return;

  const [consumerRows] = await connection.execute<ConsumerRecordSeedRow[]>(
    `SELECT cr.id, cr.reference_number AS referenceNumber, cr.consumer_id AS consumerId,
            cr.registered_phone AS registeredPhone, cr.circle_id AS circleId,
            cr.division_id AS divisionId, cr.subdivision_id AS subdivisionId,
            c.name AS circleName, d.name AS divisionName, sd.name AS subdivisionName
     FROM consumer_records cr
     JOIN circles c ON c.id = cr.circle_id
     JOIN divisions d ON d.id = cr.division_id
     JOIN subdivisions sd ON sd.id = cr.subdivision_id
     WHERE cr.reference_number = ?
     LIMIT 1`,
    [seed.referenceNumber],
  );
  const consumer = consumerRows[0];
  if (consumer === undefined) throw new Error(`Missing demo consumer record ${seed.referenceNumber}`);

  const categoryId = await categoryIdBy(connection, 'consumer', slugify(seed.categoryName));
  const [complaintRows] = await connection.execute<IdRow[]>(
    'SELECT id FROM complaint_types WHERE category_id = ? AND slug = ? LIMIT 1',
    [categoryId, slugify(seed.complaintTypeName)],
  );
  const complaintTypeId = complaintRows[0]?.id;
  if (complaintTypeId === undefined) throw new Error(`Missing complaint type ${seed.complaintTypeName}`);
  const priorityId = await idBy(connection, 'priorities', 'slug', seed.prioritySlug);
  const statusId = await idBy(connection, 'ticket_statuses', 'slug', seed.statusSlug);
  const complaintSlaTargetHours = complaintTypeSlaTargetHours(
    'consumer',
    seed.categoryName,
    seed.complaintTypeName,
  );
  const prioritySlaTargetHours = priorities.find(([, slug]) => slug === seed.prioritySlug)?.[4]
    ?? null;
  const slaTargetHours = effectiveSlaTargetHours(
    complaintSlaTargetHours,
    prioritySlaTargetHours,
  );
  const createdAt = new Date(Date.now() - seed.ageDays * 86_400_000);
  const isResolved = ['resolved', 'closed'].includes(seed.statusSlug);

  const [ticketResult] = await connection.execute<ResultSetHeader>(
    `INSERT INTO tickets (
       ticket_number, requester_id, consumer_record_id, complaint_contact_phone, domain,
       subject, description, category_id, complaint_type_id, department_id,
       circle_id, division_id, subdivision_id, location_details, priority_id,
       complaint_sla_target_hours, sla_target_hours, status_id, current_assignee_id,
       resolution_summary, category_name_snapshot, complaint_type_name_snapshot,
       department_name_snapshot, circle_name_snapshot, division_name_snapshot,
       subdivision_name_snapshot, resolved_at, closed_at, created_at
     ) VALUES (?, NULL, ?, ?, 'consumer', ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               NULL, ?, ?, ?, ?, ?, ?)`,
    [
      seed.ticketNumber,
      consumer.id,
      consumer.registeredPhone,
      seed.subject,
      seed.description,
      categoryId,
      complaintTypeId,
      consumer.circleId,
      consumer.divisionId,
      consumer.subdivisionId,
      `${consumer.subdivisionName}, ${consumer.divisionName}`,
      priorityId,
      complaintSlaTargetHours,
      slaTargetHours,
      statusId,
      seed.assigneeId ?? null,
      seed.resolution ?? null,
      seed.categoryName,
      seed.complaintTypeName,
      consumer.circleName,
      consumer.divisionName,
      consumer.subdivisionName,
      isResolved ? createdAt : null,
      seed.statusSlug === 'closed' ? createdAt : null,
      createdAt,
    ],
  );
  const ticketId = ticketResult.insertId;
  await connection.execute(
    `INSERT INTO ticket_history (ticket_id, event_type, actor_id, new_value, reason, created_at)
     VALUES (?, 'ticket_created', NULL, ?, 'Local public-portal seed data', ?)`,
    [ticketId, JSON.stringify({ status: 'new', source: 'public_portal' }), createdAt],
  );

  if (seed.assigneeId !== undefined) {
    await connection.execute(
      `INSERT INTO assignments (ticket_id, technician_id, assigned_by, reason, assigned_at)
       VALUES (?, ?, ?, 'Automatic department routing', ?)`,
      [ticketId, seed.assigneeId, supervisorId, createdAt],
    );
    await connection.execute(
      `INSERT INTO ticket_history (ticket_id, event_type, actor_id, new_value, reason, created_at)
       VALUES (?, 'assigned', ?, ?, 'Automatic department routing', ?)`,
      [ticketId, supervisorId, JSON.stringify({ technicianId: seed.assigneeId }), createdAt],
    );
    await connection.execute(
      `INSERT INTO comments (ticket_id, author_id, visibility, body, created_at)
       VALUES (?, ?, 'public', 'The complaint has been assigned and is being reviewed.', ?)`,
      [ticketId, seed.assigneeId, createdAt],
    );
  }
}

async function seedTestActivity(connection: PoolConnection, users: TestUserIds): Promise<void> {
  const itDepartment = 'Information Technology (IT) Directorate';
  const tickets: TicketSeed[] = [
    {
      ticketNumber: 'MEPCO-2026-000001', domain: 'consumer', requesterId: users.consumer,
      subject: 'Live wire reported near demo street', description: 'A fictional critical safety scenario for acceptance testing.',
      categoryName: 'Line Complaints', complaintTypeName: 'Live Fallen Wire', prioritySlug: 'critical',
      statusSlug: 'new', ageDays: 1,
    },
    {
      ticketNumber: 'MEPCO-2026-000002', domain: 'employee', requesterId: users.employee,
      subject: 'Desktop workstation will not start', description: 'Fictional IT hardware issue for assignment testing.',
      categoryName: itDepartment, complaintTypeName: 'Hardware', departmentName: itDepartment,
      prioritySlug: 'medium', statusSlug: 'assigned', assigneeId: users.technicianIt, ageDays: 2,
    },
    {
      ticketNumber: 'MEPCO-2026-000003', domain: 'consumer', requesterId: users.consumer,
      subject: 'Recurring voltage fluctuation', description: 'Fictional active consumer issue.',
      categoryName: 'Line Complaints', complaintTypeName: 'Fluctuation', prioritySlug: 'high',
      statusSlug: 'in-progress', assigneeId: users.technicianOps, ageDays: 5,
    },
    {
      ticketNumber: 'MEPCO-2026-000004', domain: 'employee', requesterId: users.employee,
      subject: 'VPN details required', description: 'Fictional pending-user employee request.',
      categoryName: itDepartment, complaintTypeName: 'Network & Connectivity', departmentName: itDepartment,
      prioritySlug: 'low', statusSlug: 'pending-user', assigneeId: users.technicianIt, ageDays: 8,
    },
    {
      ticketNumber: 'MEPCO-2026-000005', domain: 'consumer', requesterId: users.consumer,
      subject: 'Incorrect meter reading', description: 'Fictional resolved billing-related issue.',
      categoryName: 'Non-Line Complaints', complaintTypeName: 'Wrong Meter Reading', prioritySlug: 'medium',
      statusSlug: 'resolved', assigneeId: users.technicianOps, ageDays: 12,
      resolution: 'The fictional meter record was reviewed and corrected for demonstration.',
    },
    {
      ticketNumber: 'MEPCO-2026-000006', domain: 'employee', requesterId: users.employee,
      subject: 'Portal access restored', description: 'Fictional completed employee ticket.',
      categoryName: itDepartment, complaintTypeName: 'Digital Portals', departmentName: itDepartment,
      prioritySlug: 'medium', statusSlug: 'closed', assigneeId: users.technicianIt, ageDays: 20,
      resolution: 'Access was restored using the fictional local demonstration workflow.',
    },
    {
      ticketNumber: 'MEPCO-2026-000007', domain: 'consumer', requesterId: users.consumer,
      subject: 'Transformer issue returned', description: 'Fictional reopened consumer issue.',
      categoryName: 'Line Complaints', complaintTypeName: 'Tripping (Due to Transformer)', prioritySlug: 'high',
      statusSlug: 'reopened', assigneeId: users.technicianOps, ageDays: 30,
    },
    {
      ticketNumber: 'MEPCO-2026-000008', domain: 'employee', requesterId: users.employee,
      subject: 'Duplicate equipment request', description: 'Fictional cancelled request.',
      categoryName: itDepartment, complaintTypeName: 'Hardware', departmentName: itDepartment,
      prioritySlug: 'low', statusSlug: 'cancelled', ageDays: 3,
    },
  ];

  for (const ticket of tickets) {
    await ensureTicket(connection, ticket, users.supervisor);
  }

  await connection.execute(
    `UPDATE tickets t
     JOIN complaint_types ct ON ct.id = t.complaint_type_id
     JOIN priorities p ON p.id = t.priority_id
     SET t.complaint_sla_target_hours = ct.sla_target_hours,
         t.sla_target_hours = LEAST(ct.sla_target_hours, COALESCE(p.sla_target_hours, ct.sla_target_hours))`,
  );

  const [announcementRows] = await connection.execute<CountRow[]>(
    "SELECT COUNT(*) AS count FROM announcements WHERE title = 'Welcome to the MEPCO Help Desk Demo'",
  );
  if ((announcementRows[0]?.count ?? 0) === 0) {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO announcements (title, body, author_id, starts_at, ends_at, is_active)
       VALUES ('Welcome to the MEPCO Help Desk Demo',
               'This fictional local environment demonstrates consumer and employee support workflows.',
               ?, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 365 DAY), TRUE)`,
      [users.administrator],
    );
    const [roleRows] = await connection.query<IdRow[]>('SELECT id FROM roles WHERE is_active = TRUE');
    for (const role of roleRows) {
      await connection.execute(
        'INSERT IGNORE INTO announcement_audiences (announcement_id, role_id) VALUES (?, ?)',
        [result.insertId, role.id],
      );
    }
  }

  await connection.execute(
    `INSERT INTO audit_logs
       (actor_id, action, entity_type, entity_id, result, request_id, metadata)
     SELECT ?, 'seed.completed', 'database', ?, 'success', ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM audit_logs WHERE action = 'seed.completed' AND entity_id = ?
     )`,
    [
      users.administrator,
      'development-demo',
      randomUUID(),
      JSON.stringify({ fictional: true, roles: 5, ticketScenarios: 8 }),
      'development-demo',
    ],
  );
}

async function seedLocalDemoActivity(connection: PoolConnection, users: DemoUserIds): Promise<void> {
  const publicTickets: PublicTicketSeed[] = [
    {
      ticketNumber: 'MEPCO-2026-100001',
      referenceNumber: '10012345678901',
      subject: 'Dangerous low-hanging service wire',
      description: 'The service wire is hanging unusually low near the front gate and needs an urgent safety inspection.',
      categoryName: 'Line Complaints',
      complaintTypeName: 'Live Fallen Wire',
      prioritySlug: 'critical',
      statusSlug: 'new',
      ageDays: 1,
    },
    {
      ticketNumber: 'MEPCO-2026-100002',
      referenceNumber: '10012345678901',
      subject: 'Voltage fluctuates during evening hours',
      description: 'Lights dim repeatedly between 7 pm and 10 pm and household appliances restart intermittently.',
      categoryName: 'Line Complaints',
      complaintTypeName: 'Fluctuation',
      prioritySlug: 'high',
      statusSlug: 'in-progress',
      assigneeId: users.technicianOps,
      ageDays: 3,
    },
    {
      ticketNumber: 'MEPCO-2026-100003',
      referenceNumber: '10012345678903',
      subject: 'Meter reading needs verification',
      description: 'The current bill shows a reading that does not match the physical meter display.',
      categoryName: 'Non-Line Complaints',
      complaintTypeName: 'Wrong Meter Reading',
      prioritySlug: 'medium',
      statusSlug: 'pending-user',
      assigneeId: users.technicianCsd,
      ageDays: 5,
    },
    {
      ticketNumber: 'MEPCO-2026-100004',
      referenceNumber: '10012345678904',
      subject: 'Repeated transformer tripping resolved',
      description: 'The local transformer was tripping several times each day during peak usage.',
      categoryName: 'Line Complaints',
      complaintTypeName: 'Tripping (Due to Transformer)',
      prioritySlug: 'high',
      statusSlug: 'resolved',
      assigneeId: users.technicianOps,
      ageDays: 9,
      resolution: 'The field team replaced a damaged connector and verified stable transformer operation.',
    },
  ];
  for (const ticket of publicTickets) {
    await ensurePublicDemoTicket(connection, ticket, users.supervisor);
  }

  const informationTechnology = 'Information Technology (IT) Directorate';
  const employeeTickets: TicketSeed[] = [
    {
      ticketNumber: 'MEPCO-2026-200001',
      domain: 'employee',
      requesterId: users.employee,
      subject: 'Desktop cannot connect to the office network',
      description: 'The workstation receives an address but cannot reach internal applications or shared drives.',
      categoryName: informationTechnology,
      complaintTypeName: 'Network & Connectivity',
      departmentName: informationTechnology,
      prioritySlug: 'medium',
      statusSlug: 'assigned',
      assigneeId: users.technicianIt,
      ageDays: 2,
    },
    {
      ticketNumber: 'MEPCO-2026-200002',
      domain: 'employee',
      requesterId: users.employee,
      subject: 'Access required for monthly reporting portal',
      description: 'Reporting access is required before the next monthly submission window.',
      categoryName: informationTechnology,
      complaintTypeName: 'Digital Portals',
      departmentName: informationTechnology,
      prioritySlug: 'low',
      statusSlug: 'pending-user',
      assigneeId: users.technicianIt,
      ageDays: 4,
    },
  ];
  for (const ticket of employeeTickets) {
    await ensureTicket(connection, ticket, users.supervisor);
  }

  const [announcementRows] = await connection.execute<CountRow[]>(
    "SELECT COUNT(*) AS count FROM announcements WHERE title = 'Scheduled help desk maintenance'",
  );
  if ((announcementRows[0]?.count ?? 0) === 0) {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO announcements (title, body, author_id, starts_at, ends_at, is_active)
       VALUES ('Scheduled help desk maintenance',
               'The local training environment will undergo routine maintenance after office hours on Friday.',
               ?, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY), TRUE)`,
      [users.administrator],
    );
    const [roleRows] = await connection.query<IdRow[]>(
      "SELECT id FROM roles WHERE name IN ('employee', 'technician', 'supervisor', 'administrator')",
    );
    for (const role of roleRows) {
      await connection.execute(
        'INSERT IGNORE INTO announcement_audiences (announcement_id, role_id) VALUES (?, ?)',
        [result.insertId, role.id],
      );
    }
  }

  await connection.execute(
    `INSERT INTO audit_logs
       (actor_id, action, entity_type, entity_id, result, request_id, metadata)
     SELECT ?, 'seed.completed', 'database', 'local-demo', 'success', ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM audit_logs WHERE action = 'seed.completed' AND entity_id = 'local-demo'
     )`,
    [
      users.administrator,
      randomUUID(),
      JSON.stringify({ fictional: true, staffAccounts: 5, employeeAccounts: 2, publicTickets: 4 }),
    ],
  );
}

interface SeedOptions {
  includeTestFixtures?: boolean;
  includeDemoData?: boolean;
}

export async function runSeed(options: SeedOptions = {}): Promise<void> {
  if (options.includeTestFixtures === true && env.nodeEnv !== 'test') {
    throw new Error('Test fixtures can only be seeded when NODE_ENV=test');
  }
  if (options.includeDemoData === true && env.nodeEnv === 'production') {
    throw new Error('Local demo data cannot be seeded when NODE_ENV=production');
  }
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await upsertMasterData(connection);
    if (env.nodeEnv !== 'production') await seedConsumerRecords(connection);
    if (options.includeTestFixtures === true) {
      const users = await seedUsers(connection);
      await seedTestActivity(connection, users);
    }
    if (options.includeDemoData === true) {
      const users = await seedLocalDemoUsers(connection);
      await seedLocalDemoActivity(connection, users);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
