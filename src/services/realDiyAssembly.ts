import type { Category } from '../types'

export interface RealDiyStep {
  step: number
  category: Category
  title: string
  action: string
  detail: string
  tip: string
  caution: string
}

export const REAL_DIY_STEPS: RealDiyStep[] = [
  {
    step: 1,
    category: 'motherboard',
    title: '第一步：准备主板平台',
    action: '选择并放置主板',
    detail: '将主板平放在包装盒绝缘面上作为初装工作台，确认 CPU 插槽、DIMM 内存插槽及 M.2 接口完好。',
    tip: '真实装机诀窍：绝大部分配件（CPU、内存、固态、散热器扣具）先在机箱外主板上预装好，再整体移入机箱，操作空间最大、最省力！',
    caution: '切勿在化纤地毯或静电严重环境下直接裸板操作。'
  },
  {
    step: 2,
    category: 'cpu',
    title: '第二步：安装 CPU 处理器',
    action: 'CPU 对准三角放入插槽',
    detail: '下压并向外推开主板插槽拉杆，掀开扣盖；对准 CPU 边缘金色小三角与主板防呆标，垂直轻放落座。',
    tip: '严禁倾斜划插或强行按压 CPU，自然落座后盖下扣具并扣紧压杆，黑色塑料保护盖会自动弹脱。',
    caution: '插槽针脚极脆弱（尤其 Intel LGA / AMD AM5 触点），绝对严禁用手或异物触碰针脚！'
  },
  {
    step: 3,
    category: 'memory',
    title: '第三步：安装内存条',
    action: '双通道对准防呆口卡入',
    detail: '掰开主板内存插槽卡扣，对准内存金手指中段偏心防呆缺口，双手按压两端直到听到“咔哒”回弹声。',
    tip: '若安装 2 根内存，务必优先插在从 CPU 往外数的第 2、4 槽（A2/B2），这是电气性能最好的主双通道位。',
    caution: '防呆缺口不对称，如果插不进请立即翻转方向，切勿蛮力硬压。'
  },
  {
    step: 4,
    category: 'ssd',
    title: '第四步：安装 M.2 固态硬盘',
    action: '30° 斜插并锁紧散热装甲',
    detail: '拧下第一条近 CPU 位的金属散热装甲，将 M.2 固态以 30° 角插到底，平压后拧上螺丝或旋转免螺丝卡扣。',
    tip: '重装散热马甲前，【必须撕除】金属散热片内侧蓝色/粉色导热硅胶垫上的透明塑料薄膜！',
    caution: '若忘记撕膜，固态高负荷时热量无法传导，温度可飙升至 80°C 以上导致严重降速甚至掉盘。'
  },
  {
    step: 5,
    category: 'cooler',
    title: '第五步：安装 CPU 散热器',
    action: '涂抹硅脂上紧散热器',
    detail: '在 CPU 顶盖中央挤出黄豆大小导热硅脂；安装好平台对应金属支架，对角交替逐步拧紧散热螺丝。',
    tip: '风冷双塔注意吹风方向（从前向后吹）；水冷先比划好机箱顶部冷排走管方向。',
    caution: '【高频翻车点】散热器纯铜底座上的“PEEL OFF BEFORE INSTALL”保护透明膜必须在涂硅脂前撕掉！'
  },
  {
    step: 6,
    category: 'case',
    title: '第六步：机箱准备与主板入箱',
    action: '装铜柱并固定主板',
    detail: '取下机箱钢化玻璃侧板与背板；确认主板版型（ATX/M-ATX）安装对应铜柱，将主板移入机箱锁紧各角螺丝。',
    tip: '多余未对准孔位的铜柱必须旋下，避免顶住主板背面焊点短路；螺丝先全部带上螺纹再逐一对角拧紧。',
    caution: '装主板螺丝时要拿稳螺丝刀，避免螺丝刀打滑划伤主板表面印刷电路走线。'
  },
  {
    step: 7,
    category: 'psu',
    title: '第七步：安装电源与预走线',
    action: '推入电源仓并预留线缆',
    detail: '如果是全模组电源，先插好主板 24Pin、CPU 供电 8Pin、显卡供电线；将电源推入电源仓，后部固定 4 颗螺丝。',
    tip: '电源风扇通常朝下（吸入冷风后排出），若机箱下部无进风滤网则朝上。从背线孔穿出主板与显卡供电线。',
    caution: '不同品牌、不同型号的模组线严禁混插！线序不同会导致瞬间烧毁主板或显卡。'
  },
  {
    step: 8,
    category: 'fan',
    title: '第八步：安装机箱风扇',
    action: '前进后出构建立体风道',
    detail: '按照标准前进后出、下进上出的正压风道方向，用螺丝将机箱风扇固定，串联好 PWM 调速与 ARGB 灯效线。',
    tip: '通常风扇有商标 Logo 骨架面为进风，有塑料支架面为出风。保持进风量略大于出风量形成微正压，能极大减少缝隙积灰。',
    caution: '理好风扇排线，避免线缆刮蹭旋转中的扇叶产生异响。'
  },
  {
    step: 9,
    category: 'gpu',
    title: '第九步：安装独立显卡',
    action: '拆 PCIe 挡板插紧显卡',
    detail: '拆下机箱对应第一条 PCIe 5.0 插槽的挡板，双手托稳显卡垂直下压进插槽直至卡扣锁死，拧紧挡板螺丝。',
    tip: '现代大型显卡（4070TiS/4080S/4090/5090）重量很大，建议务必在尾部放置显卡防下垂支架。插紧 12V-2x6 或 8Pin 供电线。',
    caution: '16Pin 供电插头必须完全插到底听见锁扣咬合，严禁虚插或距离插头过近处产生 90° 死折！'
  },
  {
    step: 10,
    category: 'expansion',
    title: '第十步：理线封箱与通电点亮',
    action: '接好前置跳线，开机点亮！',
    detail: '插接机箱前面板跳线（POWER SW、USB3.0、Type-C、AUDIO）；连接显示器与电源线，按下开机键完成首测！',
    tip: 'AMD 平台首次开机往往需要数十秒进行内存自检与训练（Memory Training），主板 DRAM 黄灯常亮稍候片刻即可顺利进入 BIOS。',
    caution: '显示器 DP/HDMI 线必须插在【独立显卡】背板接口，切勿误插在主板核显接口上！'
  }
]

export const REAL_DIY_ORDER: Category[] = [
  'motherboard',
  'cpu',
  'memory',
  'ssd',
  'cooler',
  'case',
  'psu',
  'fan',
  'gpu',
  'expansion'
]

export function getVisibleCategoriesForStep(stepNumber: number): Category[] {
  if (stepNumber <= 0) return []
  if (stepNumber >= REAL_DIY_STEPS.length) return [...REAL_DIY_ORDER, 'hdd']
  return REAL_DIY_ORDER.slice(0, stepNumber)
}
