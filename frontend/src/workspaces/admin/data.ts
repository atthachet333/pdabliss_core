/* Planned standard roles (configuration concept only — no RBAC yet). */

export const ROLES = [
  { code: 'SYSTEM_ADMIN', name: 'ผู้ดูแลระบบ', note: 'จัดการผู้ใช้ แผนก และการตั้งค่า' },
  { code: 'EXECUTIVE', name: 'ผู้บริหาร', note: 'ดูภาพรวมทุกแผนก อนุมัติได้เมื่อได้รับสิทธิ์' },
  { code: 'DEPARTMENT_MANAGER', name: 'หัวหน้าแผนก', note: 'ดูแลงานและอนุมัติภายในแผนก' },
  { code: 'STAFF', name: 'พนักงาน', note: 'ทำงานประจำวันของแผนก' },
  { code: 'VIEWER', name: 'ผู้ดูข้อมูล', note: 'ดูข้อมูลอย่างเดียว' },
] as const;
