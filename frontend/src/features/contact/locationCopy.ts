import type { Localized } from '@/i18n/useCopy';

/*
 * /contact location (EP24.1.4): where PDA BLISS is, and the map. Facts only —
 * the address itself comes from CONTACT; nothing about opening hours or
 * walk-ins is stated because none was provided.
 */

const th = {
  eyebrow: 'ที่ตั้ง',
  title: 'ที่ตั้งบริษัท',
  lead: 'ที่อยู่ของ PDA BLISS และตำแหน่งบนแผนที่ — เปิดใน Google Maps เพื่อนำทางได้ทันที',
  open: 'เปิดใน Google Maps',
  show: 'แสดงแผนที่',
  mapTitle: 'แผนที่ Google แสดงที่ตั้ง PDA BLISS COMPANY LIMITED',
  placeholder: 'แผนที่จาก Google',
  consent:
    'การแสดงแผนที่จะโหลดเนื้อหาจาก Google ซึ่งอาจตั้งคุกกี้ของ Google เอง แผนที่จะโหลดเมื่อคุณกดแสดงเท่านั้น',
  privacy: 'นโยบายความเป็นส่วนตัว',
  shown: 'แสดงแผนที่แล้ว',
  seeMap: 'ดูที่ตั้งบนแผนที่',
};

export type LocationCopy = typeof th;

export const LOCATION_COPY: Localized<LocationCopy> = {
  th,
  en: {
    eyebrow: 'Location',
    title: 'Where to find us',
    lead: 'The PDA BLISS address and its place on the map — open it in Google Maps for directions.',
    open: 'Open in Google Maps',
    show: 'Show map',
    mapTitle: 'Google map showing PDA BLISS COMPANY LIMITED',
    placeholder: 'Map from Google',
    consent:
      'Showing the map loads content from Google, which may set its own cookies. It loads only when you choose to show it.',
    privacy: 'Privacy Policy',
    shown: 'Map shown',
    seeMap: 'See the location on the map',
  },
  'zh-CN': {
    eyebrow: '位置',
    title: '公司位置',
    lead: 'PDA BLISS 的地址及其在地图上的位置——在 Google 地图中打开即可导航。',
    open: '在 Google 地图中打开',
    show: '显示地图',
    mapTitle: '显示 PDA BLISS COMPANY LIMITED 位置的 Google 地图',
    placeholder: '来自 Google 的地图',
    consent:
      '显示地图会加载来自 Google 的内容，Google 可能会设置其自身的 Cookie。仅在您选择显示时才会加载。',
    privacy: '隐私政策',
    shown: '地图已显示',
    seeMap: '在地图上查看位置',
  },
};
