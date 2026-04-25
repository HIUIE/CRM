export interface Country {
  code: string;
  name: string;
  nameZh: string;
  pinyin: string; // Initials or full pinyin for bilingual search
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: 'AF', name: 'Afghanistan', nameZh: '阿富汗', pinyin: 'afh', flag: '🇦🇫' },
  { code: 'AL', name: 'Albania', nameZh: '阿尔巴尼亚', pinyin: 'aebny', flag: '🇦🇱' },
  { code: 'DZ', name: 'Algeria', nameZh: '阿尔及利亚', pinyin: 'aejly', flag: '🇩🇿' },
  { code: 'AO', name: 'Angola', nameZh: '安哥拉', pinyin: 'agl', flag: '🇦🇴' },
  { code: 'AR', name: 'Argentina', nameZh: '阿根廷', pinyin: 'agt', flag: '🇦🇷' },
  { code: 'AU', name: 'Australia', nameZh: '澳大利亚', pinyin: 'adly', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', nameZh: '奥地利', pinyin: 'adl', flag: '🇦🇹' },
  { code: 'BD', name: 'Bangladesh', nameZh: '孟加拉国', pinyin: 'mjlg', flag: '🇧🇩' },
  { code: 'BE', name: 'Belgium', nameZh: '比利时', pinyin: 'bls', flag: '🇧🇪' },
  { code: 'BR', name: 'Brazil', nameZh: '巴西', pinyin: 'bx', flag: '🇧🇷' },
  { code: 'CA', name: 'Canada', nameZh: '加拿大', pinyin: 'jnd', flag: '🇨🇦' },
  { code: 'CL', name: 'Chile', nameZh: '智利', pinyin: 'zl', flag: '🇨🇱' },
  { code: 'CN', name: 'China', nameZh: '中国', pinyin: 'zg', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', nameZh: '哥伦比亚', pinyin: 'glby', flag: '🇨🇴' },
  { code: 'HR', name: 'Croatia', nameZh: '克罗地亚', pinyin: 'kldy', flag: '🇭🇷' },
  { code: 'CZ', name: 'Czech Republic', nameZh: '捷克', pinyin: 'jk', flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark', nameZh: '丹麦', pinyin: 'dm', flag: '🇩🇰' },
  { code: 'EG', name: 'Egypt', nameZh: '埃及', pinyin: 'aj', flag: '🇪🇬' },
  { code: 'ET', name: 'Ethiopia', nameZh: '埃塞俄比亚', pinyin: 'aseby', flag: '🇪🇹' },
  { code: 'FI', name: 'Finland', nameZh: '芬兰', pinyin: 'fl', flag: '🇫🇮' },
  { code: 'FR', name: 'France', nameZh: '法国', pinyin: 'fg', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', nameZh: '德国', pinyin: 'dg', flag: '🇩🇪' },
  { code: 'GH', name: 'Ghana', nameZh: '加纳', pinyin: 'jn', flag: '🇬🇭' },
  { code: 'GR', name: 'Greece', nameZh: '希腊', pinyin: 'xl', flag: '🇬🇷' },
  { code: 'HK', name: 'Hong Kong', nameZh: '中国香港', pinyin: 'zgxg', flag: '🇭🇰' },
  { code: 'HU', name: 'Hungary', nameZh: '匈牙利', pinyin: 'xyl', flag: '🇭🇺' },
  { code: 'IN', name: 'India', nameZh: '印度', pinyin: 'yd', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia', nameZh: '印度尼西亚', pinyin: 'ydnxy', flag: '🇮🇩' },
  { code: 'IR', name: 'Iran', nameZh: '伊朗', pinyin: 'yl', flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq', nameZh: '伊拉克', pinyin: 'ylk', flag: '🇮🇶' },
  { code: 'IE', name: 'Ireland', nameZh: '爱尔兰', pinyin: 'al', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', nameZh: '以色列', pinyin: 'yslk', flag: '🇮🇱' },
  { code: 'IT', name: 'Italy', nameZh: '意大利', pinyin: 'ydl', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', nameZh: '日本', pinyin: 'rb', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordan', nameZh: '约旦', pinyin: 'yd', flag: '🇯🇴' },
  { code: 'KZ', name: 'Kazakhstan', nameZh: '哈萨克斯坦', pinyin: 'hskst', flag: '🇰🇿' },
  { code: 'KE', name: 'Kenya', nameZh: '肯尼亚', pinyin: 'kny', flag: '🇰🇪' },
  { code: 'KR', name: 'South Korea', nameZh: '韩国', pinyin: 'hg', flag: '🇰🇷' },
  { code: 'KW', name: 'Kuwait', nameZh: '科威特', pinyin: 'kwt', flag: '🇰🇼' },
  { code: 'LY', name: 'Libya', nameZh: '利比亚', pinyin: 'lby', flag: '🇱🇾' },
  { code: 'MY', name: 'Malaysia', nameZh: '马来西亚', pinyin: 'mlxy', flag: '🇲🇾' },
  { code: 'MX', name: 'Mexico', nameZh: '墨西哥', pinyin: 'mxg', flag: '🇲🇽' },
  { code: 'MA', name: 'Morocco', nameZh: '摩洛哥', pinyin: 'mlg', flag: '🇲🇦' },
  { code: 'MM', name: 'Myanmar', nameZh: '缅甸', pinyin: 'md', flag: '🇲🇲' },
  { code: 'NP', name: 'Nepal', nameZh: '尼泊尔', pinyin: 'nbe', flag: '🇳🇵' },
  { code: 'NL', name: 'Netherlands', nameZh: '荷兰', pinyin: 'hl', flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand', nameZh: '新西兰', pinyin: 'xxl', flag: '🇳🇿' },
  { code: 'NG', name: 'Nigeria', nameZh: '尼日利亚', pinyin: 'nrly', flag: '🇳🇬' },
  { code: 'NO', name: 'Norway', nameZh: '挪威', pinyin: 'nw', flag: '🇳🇴' },
  { code: 'OM', name: 'Oman', nameZh: '阿曼', pinyin: 'am', flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan', nameZh: '巴基斯坦', pinyin: 'bjst', flag: '🇵🇰' },
  { code: 'PE', name: 'Peru', nameZh: '秘鲁', pinyin: 'bl', flag: '🇵🇪' },
  { code: 'PH', name: 'Philippines', nameZh: '菲律宾', pinyin: 'flyb', flag: '🇵🇭' },
  { code: 'PL', name: 'Poland', nameZh: '波兰', pinyin: 'bl', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', nameZh: '葡萄牙', pinyin: 'pty', flag: '🇵🇹' },
  { code: 'QA', name: 'Qatar', nameZh: '卡塔尔', pinyin: 'kte', flag: '🇶🇦' },
  { code: 'RO', name: 'Romania', nameZh: '罗马尼亚', pinyin: 'lmny', flag: '🇷🇴' },
  { code: 'RU', name: 'Russia', nameZh: '俄罗斯', pinyin: 'els', flag: '🇷🇺' },
  { code: 'SA', name: 'Saudi Arabia', nameZh: '沙特阿拉伯', pinyin: 'sdalb', flag: '🇸🇦' },
  { code: 'SN', name: 'Senegal', nameZh: '塞内加尔', pinyin: 'snge', flag: '🇸🇳' },
  { code: 'SG', name: 'Singapore', nameZh: '新加坡', pinyin: 'xjp', flag: '🇸🇬' },
  { code: 'ZA', name: 'South Africa', nameZh: '南非', pinyin: 'nf', flag: '🇿🇦' },
  { code: 'ES', name: 'Spain', nameZh: '西班牙', pinyin: 'xby', flag: '🇪🇸' },
  { code: 'SE', name: 'Sweden', nameZh: '瑞典', pinyin: 'rd', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', nameZh: '瑞士', pinyin: 'rs', flag: '🇨🇭' },
  { code: 'TW', name: 'Taiwan', nameZh: '中国台湾', pinyin: 'zgtw', flag: '🇹🇼' },
  { code: 'TZ', name: 'Tanzania', nameZh: '坦桑尼亚', pinyin: 'tsny', flag: '🇹🇿' },
  { code: 'TH', name: 'Thailand', nameZh: '泰国', pinyin: 'tg', flag: '🇹🇭' },
  { code: 'TN', name: 'Tunisia', nameZh: '突尼斯', pinyin: 'tns', flag: '🇹🇳' },
  { code: 'TR', name: 'Turkey', nameZh: '土耳其', pinyin: 'teq', flag: '🇹🇷' },
  { code: 'UA', name: 'Ukraine', nameZh: '乌克兰', pinyin: 'wkl', flag: '🇺🇦' },
  { code: 'AE', name: 'United Arab Emirates', nameZh: '阿联酋', pinyin: 'alq', flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom', nameZh: '英国', pinyin: 'yg', flag: '🇬🇧' },
  { code: 'US', name: 'United States', nameZh: '美国', pinyin: 'mg', flag: '🇺🇸' },
  { code: 'UZ', name: 'Uzbekistan', nameZh: '乌兹别克斯坦', pinyin: 'uzbkst', flag: '🇺🇿' },
  { code: 'VE', name: 'Venezuela', nameZh: '委内瑞拉', pinyin: 'wnrl', flag: '🇻🇪' },
  { code: 'VN', name: 'Vietnam', nameZh: '越南', pinyin: 'yn', flag: '🇻🇳' },
  { code: 'YE', name: 'Yemen', nameZh: '也门', pinyin: 'ym', flag: '🇾🇪' },
  { code: 'ZM', name: 'Zambia', nameZh: '赞比亚', pinyin: 'zby', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe', nameZh: '津巴布韦', pinyin: 'zbbw', flag: '🇿🇼' },
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
