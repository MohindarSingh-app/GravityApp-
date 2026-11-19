import Ionicons from 'react-native-vector-icons/Ionicons';

const ICONS = {
  bolt: 'flash',
  search: 'search',
  home: 'home',
  rush: 'warning',
  book: 'calendar',
  calendar: 'calendar',
  jobs: 'briefcase',
  briefcase: 'briefcase',
  cover: 'shield-checkmark',
  shield: 'shield-checkmark',
  pin: 'location',
  wrench: 'construct',
  user: 'person',
  bell: 'notifications',
  key: 'key',
  sun: 'sunny',
  moon: 'moon',
  device: 'hardware-chip',
  chip: 'hardware-chip',
  settings: 'settings',
  bulb: 'bulb',
  globe: 'globe',
  battery: 'battery-full',
  alert: 'alert-circle',
  speed: 'speedometer',
  save: 'save',
  sync: 'sync',
  box: 'cube',
  grid: 'grid',
  cable: 'git-network',
  cart: 'cart',
  store: 'storefront',
  hammer: 'hammer',
  cert: 'ribbon',
  hmi: 'tablet-portrait',
  scada: 'desktop',
  plant: 'business',
  back: 'chevron-back',
  chevron: 'chevron-forward',
  chevronUp: 'chevron-up',
  check: 'checkmark',
  plus: 'add',
  minus: 'remove',
  filter: 'options',
  spark: 'sparkles',
  camera: 'camera',
  close: 'close',
  call: 'call',
  logout: 'log-out',
  pulse: 'pulse',
  share: 'share-social',
  download: 'download-outline',
  chat: 'chatbubble',
  whatsapp: 'logo-whatsapp',
  document: 'document-text',
  edit: 'pencil',
};

export function Glyph({ name, color, size = 24 }) {
  return (
    <Ionicons
      name={ICONS[name] || name || 'ellipse'}
      size={size}
      color={color}
    />
  );
}
