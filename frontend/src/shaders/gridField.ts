/**
 * 单色几何场 —— Daily Tech News 的落地页主视觉。
 *
 * 构图（全部在 CSS 像素空间计算——size 为画布尺寸 ÷ DPR，与
 * .geo-fallback 的网格尺度严格一致，线条永远锐利）：
 *   1. 28px 细网格（发丝级）          2. 140px 主网格
 *   3. 主网格交点上的十字准星          4. 45° 对角信号线（缓慢呼吸）
 *   5. 横扫光带（唤醒经过的网格 + 抖动噪点）
 *   6. 大圆盘与环上雷达刻度            7. 胶片颗粒
 *
 * 输出 premultiplied alpha：画布透明，纸色来自页面背景，墨色随主题
 * 翻转（invert 0 = 黑墨，1 = 白墨）。所有项一次乘加，无循环，
 * 全屏 DPR2 下成本可忽略——这是帧率纪律的一部分。
 *
 * uv 来自 vgpu 生成的全屏三角形，可见区域内恰好铺满 [0,1]²，
 * 乘 size 即得 CSS 像素坐标。invert/seed 是实打实使用的参数而非填充。
 */
export const GRID_FIELD_WGSL = /* wgsl */ `
struct Params {
  time: f32,
  size: vec2f,
  invert: f32,
  seed: f32,
};

@group(0) @binding(0) var<uniform> params: Params;

fn hash21(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + dot(p3, vec3f(p3.y, p3.z, p3.x) + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

/** 到最近网格线的 1px 抗锯齿带。 */
fn bandAt(coord: f32, period: f32, width: f32) -> f32 {
  let d = abs(coord - round(coord / period) * period);
  return 1.0 - smoothstep(width, width + 1.0, d);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = uv * params.size;
  var ink = 0.0;

  let minor = max(bandAt(p.x, 28.0, 0.5), bandAt(p.y, 28.0, 0.5));
  ink += minor * 0.10;

  let mx = bandAt(p.x, 140.0, 0.5);
  let my = bandAt(p.y, 140.0, 0.5);
  let major = max(mx, my);
  ink += major * 0.17;

  ink += mx * my * 0.50;

  let diag = (p.x + p.y) * 0.70710678;
  let breath = 0.5 + 0.5 * sin(diag * 0.045 - params.time * 0.4);
  ink += bandAt(diag, 280.0, 0.5) * (0.05 + 0.11 * breath);

  let span = params.size.x + 480.0;
  let bandX = fract(params.time / 11.0) * span - 240.0;
  let wake = exp(-abs(p.x - bandX) * 0.012);
  ink += wake * (minor * 0.30 + major * 0.22 + 0.015);
  let cell = floor(p / 3.0);
  ink += wake * step(0.978, hash21(cell + vec2f(params.seed))) * 0.5;

  let center = vec2f(params.size.x * 0.72, params.size.y * 0.44);
  let radius = min(params.size.x, params.size.y) * 0.30;
  let ring = 1.0 - smoothstep(0.5, 1.5, abs(length(p - center) - radius));
  ink += ring * 0.30;
  let angle = atan2(p.y - center.y, p.x - center.x);
  let sweep = fract(angle / 6.2831853 + params.time * 0.05);
  ink += ring * step(0.96, sweep) * 0.45;
  // 内环虚线：与 CSS 兜底的 dashed 圆保持同一构图。
  let ring2 = 1.0 - smoothstep(0.5, 1.5, abs(length(p - center) - radius * 0.72));
  ink += ring2 * step(0.55, fract((p.x + p.y) / 14.0)) * 0.18;

  ink += (hash21(p + vec2f(params.seed * 13.7)) - 0.5) * 0.018;

  let coverage = clamp(ink, 0.0, 1.0);
  let tone = mix(vec3f(0.06), vec3f(0.93), params.invert);
  return vec4f(tone * coverage, coverage);
}
`
