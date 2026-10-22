/*
 * Standard Thai copy for system states. Calm, specific, never blaming the
 * user. Screens may override the description to say what will appear and
 * where it comes from — that is what makes an empty state useful.
 */

export const EMPTY_COPY = {
  noItems: {
    title: 'ยังไม่มีรายการ',
    description: 'เมื่อมีรายการใหม่ จะแสดงที่นี่โดยอัตโนมัติ',
  },
  noTasks: {
    title: 'ยังไม่มีงานที่ต้องดำเนินการ',
    description: 'งานที่มอบหมายให้คุณจะปรากฏที่นี่ พร้อมขั้นตอนถัดไป',
  },
  noBacklog: {
    title: 'ไม่มีรายการค้าง',
    description: 'ทุกรายการได้รับการดำเนินการแล้ว',
  },
  noExpiringLots: {
    title: 'ยังไม่มี Lot ที่ใกล้หมดอายุ',
    description: 'Lot ที่จะหมดอายุภายในช่วงที่กำหนดจะแสดงที่นี่ เรียงตามวันหมดอายุ',
  },
  noResults: {
    title: 'ไม่พบรายการตามตัวกรอง',
    description: 'ลองเปลี่ยนคำค้นหรือล้างตัวกรองเพื่อดูรายการทั้งหมด',
  },
} as const;

export const ERROR_COPY = {
  pageLoad: {
    title: 'โหลดหน้านี้ไม่สำเร็จ',
    description: 'การเชื่อมต่ออาจขัดข้องชั่วคราว ข้อมูลของคุณไม่ได้รับผลกระทบ ลองโหลดอีกครั้ง',
  },
  section: {
    title: 'โหลดส่วนนี้ไม่สำเร็จ',
    description: 'ส่วนอื่นของหน้ายังใช้งานได้ตามปกติ',
  },
  permission: {
    title: 'คุณยังไม่มีสิทธิ์เข้าถึงส่วนนี้',
    description: 'หากต้องใช้งาน โปรดติดต่อผู้ดูแลระบบของบริษัทเพื่อขอสิทธิ์',
  },
  notFound: {
    title: 'ไม่พบหน้าที่ต้องการ',
    description: 'หน้านี้อาจถูกย้าย หรือยังไม่เปิดใช้งานในพื้นที่ทำงานนี้',
  },
  unexpected: {
    title: 'เกิดข้อผิดพลาดที่ไม่คาดคิด',
    description: 'ระบบบันทึกเหตุการณ์ไว้แล้ว ลองอีกครั้ง หากยังพบปัญหา โปรดแจ้งผู้ดูแลระบบ',
  },
} as const;

/** Shown on controls that exist in the design but are not wired in the prototype. */
export const SOON = 'เร็ว ๆ นี้';
