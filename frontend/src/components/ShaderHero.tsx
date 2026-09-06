import { useEffect, useRef, useState } from 'react'
import type { Frame, FrameLoopHandle, Gpu } from 'vgpu'
import { GRID_FIELD_WGSL } from '../shaders/gridField'

type HeroStatus = 'pending' | 'live' | 'static'

/**
 * 单色几何场 hero。WebGPU 可用时用 vgpu 跑真实 shader，否则退到同一
 * 构图的 CSS 几何场（.geo-fallback）。帧率纪律：
 *
 *  - DPR 钳制 [1, 2]：surface 内建，高分屏最多渲染两倍物理像素；
 *  - 滚出视口即 loop.stop()（IntersectionObserver），WebGPU 画布
 *    保留最后一帧，回视口无缝续播；
 *  - 标签页隐藏时浏览器自动停摆 rAF，无需额外监听；
 *  - prefers-reduced-motion 只画一帧定妆，永不进循环；
 *  - vgpu 仅在确认 navigator.gpu 之后动态 import——不支持的老浏览器
 *    连这个库的字节都不用下载。
 */
export function ShaderHero({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<HeroStatus>('pending')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let disposed = false
    const teardown: Array<() => void> = []

    const start = async () => {
      if (!('gpu' in navigator)) {
        setStatus('static')
        return
      }

      let vgpu: typeof import('vgpu')
      try {
        vgpu = await import('vgpu')
      } catch {
        setStatus('static')
        return
      }

      let device: Gpu | null = null
      try {
        device = await vgpu.init({ powerPreference: 'low-power' })
        if (disposed) {
          device.dispose()
          return
        }
        teardown.push(() => device?.dispose())

        const gpu = device
        const hero = vgpu.surface(gpu, canvas, { dpr: [1, 2] })
        // uv 是 [0,1] 全屏坐标；网格以 CSS 像素为单位（画布尺寸 ÷ DPR），
        // 与 .geo-fallback 的 28/140px 网格尺度严格一致。
        const cssSize = (): [number, number] => [
          hero.size[0] / hero.dpr,
          hero.size[1] / hero.dpr,
        ]
        const field = vgpu.effect(gpu, GRID_FIELD_WGSL, {
          set: {
            params: {
              time: 0,
              size: cssSize(),
              invert: document.documentElement.classList.contains('dark') ? 1 : 0,
              seed: 7,
            },
          },
        })

        // 主题切换时翻转墨色：浅色纸黑墨，深色纸白墨。
        const applyInvert = () =>
          field.set({
            params: { invert: document.documentElement.classList.contains('dark') ? 1 : 0 },
          })
        const themeObserver = new MutationObserver(applyInvert)
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class'],
        })
        teardown.push(() => themeObserver.disconnect())

        const time = vgpu.clock(gpu)
        const draw = (frame: Frame) => {
          // 尺寸随帧同步：省掉 onResize 订阅，首帧也拿到正确分辨率。
          field.set({ params: { time: time.time, size: cssSize() } })
          frame.pass(hero, field)
        }

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          // 静帧定妆：扫描带停在画面中段，圆盘完整可见。
          // 不走 draw()——clock 时间会把定妆时刻覆盖回 0。
          field.set({ params: { time: 8.5, size: cssSize() } })
          vgpu.frame(gpu, (f) => f.pass(hero, field))
          setStatus('live')
          return
        }

        let loop: FrameLoopHandle | null = null
        const startLoop = () => {
          loop ??= vgpu.frameLoop(gpu, draw)
        }
        const stopLoop = () => {
          loop?.stop()
          loop = null
        }

        startLoop()
        setStatus('live')

        // 滚出视口即停帧，把 GPU 让给正在阅读的页面。
        const io = new IntersectionObserver(
          ([entry]) => (entry.isIntersecting ? startLoop() : stopLoop()),
          { threshold: 0.02 }
        )
        io.observe(canvas)
        teardown.push(() => {
          io.disconnect()
          stopLoop()
        })
      } catch (error) {
        console.warn('[ShaderHero] WebGPU unavailable — CSS geometry fallback.', error)
        if (!disposed) setStatus('static')
      }
    }

    void start()
    return () => {
      disposed = true
      teardown.reverse().forEach((fn) => fn())
    }
  }, [])

  if (status === 'static') {
    return (
      <div className={`geo-fallback ${className ?? ''}`} aria-hidden="true">
        <div className="geo-scan" />
      </div>
    )
  }

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
