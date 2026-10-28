import type { Localized } from '@/i18n/useCopy';

/*
 * /contact — the location block (EP24.1.4; simplified in EP24.1.4.2; the whole
 * width of /contact since EP24.1.4.3). The company name and address come from CONTACT; only the
 * map's accessible name and the one Google Maps action are worded here. The
 * Google Maps disclosure lives in the cookie banner and the Privacy Policy.
 */

const th = {
  open: 'เปิดเส้นทางใน Google Maps',
  mapTitle: 'แผนที่ Google แสดงที่ตั้ง PDA BLISS COMPANY LIMITED',
};

export type LocationCopy = typeof th;

export const LOCATION_COPY: Localized<LocationCopy> = {
  th,
  en: {
    open: 'Open directions in Google Maps',
    mapTitle: 'Google map showing PDA BLISS COMPANY LIMITED',
  },
  'zh-CN': {
    open: '在 Google 地图中查看路线',
    mapTitle: '显示 PDA BLISS COMPANY LIMITED 位置的 Google 地图',
  },
};
