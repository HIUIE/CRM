export interface Country {
  code: string;
  name: string;
  nameZh: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: 'AF', name: 'Afghanistan', nameZh: '阿富汗', flag: '🇦🇫' },
  { code: 'AL', name: 'Albania', nameZh: '阿尔巴尼亚', flag: '🇦🇱' },
  { code: 'DZ', name: 'Algeria', nameZh: '阿尔及利亚', flag: '🇩🇿' },
  { code: 'AO', name: 'Angola', nameZh: '安哥拉', flag: '🇦🇴' },
  { code: 'AR', name: 'Argentina', nameZh: '阿根廷', flag: '🇦🇷' },
  { code: 'AU', name: 'Australia', nameZh: '澳大利亚', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', nameZh: '奥地利', flag: '🇦🇹' },
  { code: 'BD', name: 'Bangladesh', nameZh: '孟加拉国', flag: '🇧🇩' },
  { code: 'BE', name: 'Belgium', nameZh: '比利时', flag: '🇧🇪' },
  { code: 'BR', name: 'Brazil', nameZh: '巴西', flag: '🇧🇷' },
  { code: 'CA', name: 'Canada', nameZh: '加拿大', flag: '🇨🇦' },
  { code: 'CL', name: 'Chile', nameZh: '智利', flag: '🇨🇱' },
  { code: 'CN', name: 'China', nameZh: '中国', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', nameZh: '哥伦比亚', flag: '🇨🇴' },
  { code: 'HR', name: 'Croatia', nameZh: '克罗地亚', flag: '🇭🇷' },
  { code: 'CZ', name: 'Czech Republic', nameZh: '捷克', flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark', nameZh: '丹麦', flag: '🇩🇰' },
  { code: 'EG', name: 'Egypt', nameZh: '埃及', flag: '🇪🇬' },
  { code: 'ET', name: 'Ethiopia', nameZh: '埃塞俄比亚', flag: '🇪🇹' },
  { code: 'FI', name: 'Finland', nameZh: '芬兰', flag: '🇫🇮' },
  { code: 'FR', name: 'France', nameZh: '法国', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', nameZh: '德国', flag: '🇩🇪' },
  { code: 'GH', name: 'Ghana', nameZh: '加纳', flag: '🇬🇭' },
  { code: 'GR', name: 'Greece', nameZh: '希腊', flag: '🇬🇷' },
  { code: 'HK', name: 'Hong Kong', nameZh: '香港', flag: '🇭🇰' },
  { code: 'HU', name: 'Hungary', nameZh: '匈牙利', flag: '🇭🇺' },
  { code: 'IN', name: 'India', nameZh: '印度', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia', nameZh: '印度尼西亚', flag: '🇮🇩' },
  { code: 'IR', name: 'Iran', nameZh: '伊朗', flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq', nameZh: '伊拉克', flag: '🇮🇶' },
  { code: 'IE', name: 'Ireland', nameZh: '爱尔兰', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', nameZh: '以色列', flag: '🇮🇱' },
  { code: 'IT', name: 'Italy', nameZh: '意大利', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', nameZh: '日本', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordan', nameZh: '约旦', flag: '🇯🇴' },
  { code: 'KZ', name: 'Kazakhstan', nameZh: '哈萨克斯坦', flag: '🇰🇿' },
  { code: 'KE', name: 'Kenya', nameZh: '肯尼亚', flag: '🇰🇪' },
  { code: 'KR', name: 'South Korea', nameZh: '韩国', flag: '🇰🇷' },
  { code: 'KW', name: 'Kuwait', nameZh: '科威特', flag: '🇰🇼' },
  { code: 'LY', name: 'Libya', nameZh: '利比亚', flag: '🇱🇾' },
  { code: 'MY', name: 'Malaysia', nameZh: '马来西亚', flag: '🇲🇾' },
  { code: 'MX', name: 'Mexico', nameZh: '墨西哥', flag: '🇲🇽' },
  { code: 'MA', name: 'Morocco', nameZh: '摩洛哥', flag: '🇲🇦' },
  { code: 'MM', name: 'Myanmar', nameZh: '缅甸', flag: '🇲🇲' },
  { code: 'NP', name: 'Nepal', nameZh: '尼泊尔', flag: '🇳🇵' },
  { code: 'NL', name: 'Netherlands', nameZh: '荷兰', flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand', nameZh: '新西兰', flag: '🇳🇿' },
  { code: 'NG', name: 'Nigeria', nameZh: '尼日利亚', flag: '🇳🇬' },
  { code: 'NO', name: 'Norway', nameZh: '挪威', flag: '🇳🇴' },
  { code: 'OM', name: 'Oman', nameZh: '阿曼', flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan', nameZh: '巴基斯坦', flag: '🇵🇰' },
  { code: 'PE', name: 'Peru', nameZh: '秘鲁', flag: '🇵🇪' },
  { code: 'PH', name: 'Philippines', nameZh: '菲律宾', flag: '🇵🇭' },
  { code: 'PL', name: 'Poland', nameZh: '波兰', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', nameZh: '葡萄牙', flag: '🇵🇹' },
  { code: 'QA', name: 'Qatar', nameZh: '卡塔尔', flag: '🇶🇦' },
  { code: 'RO', name: 'Romania', nameZh: '罗马尼亚', flag: '🇷🇴' },
  { code: 'RU', name: 'Russia', nameZh: '俄罗斯', flag: '🇷🇺' },
  { code: 'SA', name: 'Saudi Arabia', nameZh: '沙特阿拉伯', flag: '🇸🇦' },
  { code: 'SN', name: 'Senegal', nameZh: '塞内加尔', flag: '🇸🇳' },
  { code: 'SG', name: 'Singapore', nameZh: '新加坡', flag: '🇸🇬' },
  { code: 'ZA', name: 'South Africa', nameZh: '南非', flag: '🇿🇦' },
  { code: 'ES', name: 'Spain', nameZh: '西班牙', flag: '🇪🇸' },
  { code: 'SE', name: 'Sweden', nameZh: '瑞典', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', nameZh: '瑞士', flag: '🇨🇭' },
  { code: 'TW', name: 'Taiwan', nameZh: '台湾', flag: '🇹🇼' },
  { code: 'TZ', name: 'Tanzania', nameZh: '坦桑尼亚', flag: '🇹🇿' },
  { code: 'TH', name: 'Thailand', nameZh: '泰国', flag: '🇹🇭' },
  { code: 'TN', name: 'Tunisia', nameZh: '突尼斯', flag: '🇹🇳' },
  { code: 'TR', name: 'Turkey', nameZh: '土耳其', flag: '🇹🇷' },
  { code: 'UA', name: 'Ukraine', nameZh: '乌克兰', flag: '🇺🇦' },
  { code: 'AE', name: 'United Arab Emirates', nameZh: '阿联酋', flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom', nameZh: '英国', flag: '🇬🇧' },
  { code: 'US', name: 'United States', nameZh: '美国', flag: '🇺🇸' },
  { code: 'UZ', name: 'Uzbekistan', nameZh: '乌兹别克斯坦', flag: '🇺🇿' },
  { code: 'VE', name: 'Venezuela', nameZh: '委内瑞拉', flag: '🇻🇪' },
  { code: 'VN', name: 'Vietnam', nameZh: '越南', flag: '🇻🇳' },
  { code: 'YE', name: 'Yemen', nameZh: '也门', flag: '🇾🇪' },
  { code: 'ZM', name: 'Zambia', nameZh: '赞比亚', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe', nameZh: '津巴布韦', flag: '🇿🇼' },
];

export function getCountryDisplay(countryNameOrCode: string): string {
  if (!countryNameOrCode) return '';
  const normalized = countryNameOrCode.trim().toLowerCase();
  const found = COUNTRIES.find(c =>
    c.code.toLowerCase() === normalized ||
    c.name.toLowerCase() === normalized ||
    c.nameZh === countryNameOrCode.trim()
  );
  return found ? `${found.flag} ${found.nameZh} (${found.name})` : countryNameOrCode;
}

export function getCountryFlag(countryNameOrCode: string): string {
  if (!countryNameOrCode) return '';
  const normalized = countryNameOrCode.trim().toLowerCase();
  const found = COUNTRIES.find(c =>
    c.code.toLowerCase() === normalized ||
    c.name.toLowerCase() === normalized ||
    c.nameZh === countryNameOrCode.trim()
  );
  return found?.flag || '';
}
