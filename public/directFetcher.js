// حل بديل: استخدام Google Sheets API بدون بروكسي
// لكن يحتاج API key

const GOOGLE_SHEETS_API_KEY = 'YOUR_API_KEY'; // يجب الحصول عليه من Google Cloud Console

// أو استخدام published sheets (public) بدون API key
const getPublicSheetUrl = (sheetId, gid) => {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
};

// URLs محدثة للوصول المباشر (إذا كانت الشيتات public)
const DIRECT_URLS = {
  openContracts: getPublicSheetUrl('1XwBko5v8zOdTdv-By8HK_DvZnYT2T12mBw_SIbCfMkE', '769459790'),
  closedInvygo: getPublicSheetUrl('1XwBko5v8zOdTdv-By8HK_DvZnYT2T12mBw_SIbCfMkE', '1830448171'),
  closedOther: getPublicSheetUrl('1XwBko5v8zOdTdv-By8HK_DvZnYT2T12mBw_SIbCfMkE', '375289726'),
  maintenance: getPublicSheetUrl('1v4rQWn6dYPVQPd-PkhvrDNgKVnexilrR2XIUVa5RKEM', '0'),
  cars: getPublicSheetUrl('1sHvEQMtt3suuxuMA0zhcXk5TYGqZzit0JvGLk1CQ0LI', '804568597')
};

// محاولة الوصول المباشر أولاً
const tryDirectFetch = async (url) => {
  try {
    const response = await fetch(url, {
      mode: 'cors',
      headers: {
        'Accept': 'text/csv'
      }
    });
    if (response.ok) {
      return await response.text();
    }
  } catch (e) {
    console.log('Direct fetch failed:', e.message);
  }
  return null;
};

console.log('Direct fetcher loaded - this is an alternative approach');
console.log('Current approach with proxy is working fine');
console.log('To use direct access, sheets must be published publicly');