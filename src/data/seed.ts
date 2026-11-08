import type { CategoryId, Priority, Status, WishItem, WishlistData } from '../types';
import { DATA_VERSION } from '../types';

/** 初始清单：35 项，全部价格 / 链接 / 年份留空，只有 Tesla Model 3 预置为「已拥有」。 */
type Row = [
  name: string,
  brand: string,
  model: string,
  category: CategoryId,
  priority?: Priority,
  status?: Status,
  completedAt?: string | null,
];

const HIGH = 'high' as const;

const ROWS: Row[] = [
  // A. 科技数码 7
  ['高端旗舰手机', 'Apple', 'iPhone 18 Pro / Pro Max', 'tech', HIGH],
  ['专业笔记本电脑', 'Apple', 'MacBook Pro', 'tech'],
  ['高端智能手表', 'Apple', 'Apple Watch Ultra 4', 'tech'],
  ['高端无线耳机', 'Apple', 'AirPods 系列', 'tech'],
  ['空间计算设备', 'Apple', 'Apple Vision Pro', 'tech'],
  ['全画幅相机', 'Leica', 'Leica Q3', 'tech', HIGH],
  ['专业无人机', 'DJI', 'Mavic 4 Pro', 'tech'],

  // B. 家居生活 9
  ['高端吹风机', 'Dyson', 'Supersonic Nural', 'home'],
  ['高端造型器', 'Dyson', 'Airwrap i.d.', 'home'],
  ['高端扫地机器人', 'Roborock', 'Saros 20', 'home'],
  ['高端洗碗机', 'Miele', '型号待定', 'home'],
  ['人体工学椅', 'Herman Miller', 'Aeron', 'home', HIGH],
  ['家庭影院', 'Sonos', '整套系统', 'home'],
  ['高端电视', 'LG', 'OLED G 系列', 'home'],
  ['家用咖啡机', 'La Marzocco', 'Linea Mini', 'home'],
  ['全屋智能系统', 'Apple Home', '智能家居生态', 'home'],

  // C. 汽车与个人品位 7 —— Tesla Model 3 为已拥有，购入日期 2024-01-30
  ['已拥有汽车', 'Tesla', 'Model 3', 'auto', 'medium', 'owned', '2024-01-30'],
  ['梦想跑车', 'Porsche', '911 Carrera', 'auto', HIGH],
  ['豪华纯电轿跑', 'Porsche', 'Taycan', 'auto'],
  ['经典机械腕表', 'Omega', 'Speedmaster', 'auto'],
  ['收藏级腕表', 'Rolex', 'Submariner', 'auto'],
  ['高端旅行箱', 'RIMOWA', 'Original Cabin', 'auto'],
  ['高端钢笔', 'Montblanc', 'Meisterstück', 'auto'],

  // D. 人生体验 12
  ['新疆自驾', '', '完成一次长途自驾旅行', 'life'],
  ['西藏旅行', '', '完成一次西藏旅行', 'life'],
  ['新西兰旅行', '', '探索新西兰南岛', 'life'],
  ['冰岛旅行', '', '亲眼观看极光', 'life', HIGH],
  ['家庭旅行', '', '带父母进行一次高品质长途旅行', 'life', HIGH],
  ['摄影能力', '', '掌握摄影和视频创作', 'life'],
  ['外语能力', '', '掌握一门外语，达到日常流畅交流水平', 'life'],
  ['运动目标', '', '完成一次半程马拉松', 'life'],
  ['潜水体验', '', '取得潜水证并完成深潜', 'life'],
  ['理想住宅', '', '完成理想住宅装修及智能家居配置', 'life', HIGH],
  ['家庭财务', '', '建立充足的家庭应急储备', 'life'],
  ['财务自由', '', '实现持续投资和长期财务自主', 'life', HIGH],
];

/** 每次首次启动都生成一份干净的初始数据；不会覆盖用户已有的本地数据。 */
export function createSeedData(): WishlistData {
  const now = new Date().toISOString();
  const items: WishItem[] = ROWS.map((row, i) => {
    const [name, brand, model, category, priority = 'medium', status = 'want', completedAt = null] = row;
    return {
      id: `seed-${String(i + 1).padStart(2, '0')}`,
      name,
      brand,
      model,
      category,
      cover: null,
      link: null,
      targetPrice: null,
      currentPrice: null,
      currency: 'CNY',
      year: null,
      priority,
      note: '',
      status,
      completedAt,
      createdAt: now,
      updatedAt: now,
    };
  });
  return {
    version: DATA_VERSION,
    items,
    settings: { theme: 'system', lastSavedAt: null },
  };
}

export const SEED_ITEM_COUNT = ROWS.length;
