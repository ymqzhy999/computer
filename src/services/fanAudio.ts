import { ref } from 'vue'

/**
 * 机箱风扇声：完全用 WebAudio 现场合成，不加载任何音频文件。
 *
 * 真实的风扇声不是“白噪声”，它由四部分叠出来：
 * 1. 风道主体：粉红噪声（能量集中在低频）经低通 + 170Hz 附近的共振峰，形成“呼呼”的风团；
 * 2. 高频气流：同一噪声取 2.6kHz 窄带，很轻的一层“嘶”声，只在安静时才听得到；
 * 3. 叶片通过频率：7 片扇叶 × 900~1600rpm ≈ 105~190Hz 的基频，加二次/三次谐波，
 *    两组风扇略微失谐（±1.3%）互相拍频，才有“嗡嗡里带一点点起伏”的真实感；
 * 4. 湍流抖动：两个很慢的 LFO 同时调制音量与低通频率，风声不会像合成器那样平直。
 *
 * 只有在用户按下“通电”这类真实点击后才启动，满足浏览器的自动播放限制。
 */
class FanAudioEngine {
  /** 静音是用户显式选择，和是否通电无关；断电时无论如何都不出声。 */
  readonly muted = ref(false)

  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBufferSourceNode | null = null
  private noiseFilter: BiquadFilterNode | null = null
  /** 每个叶片音频振荡器对应的倍率（失谐 × 谐波次数），用于通电时统一改音高。 */
  private bladeVoices: { osc: OscillatorNode; ratio: number }[] = []
  private running = false
  private intensity = 1

  /** 叶片通过频率：扇叶越多、转速越高，基频越高。 */
  private bladeFrequency(intensity: number): number {
    return 104 + 52 * intensity
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  /** 粉红噪声：低频更厚，听起来像“空气在流动”，而不是收音机的沙沙声。 */
  private createPinkBuffer(ctx: AudioContext): AudioBuffer {
    const seconds = 4
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let b0 = 0
    let b1 = 0
    let b2 = 0
    let b3 = 0
    let b4 = 0
    let b5 = 0
    let b6 = 0
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1
      // Paul Kellet 的粉红噪声近似滤波器
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      b3 = 0.8665 * b3 + white * 0.3104856
      b4 = 0.55 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.016898
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
      b6 = white * 0.115926
      data[i] = pink * 0.11
    }
    // 去掉首尾可能出现的阶跃，循环时不“咔哒”
    const fade = Math.floor(ctx.sampleRate * 0.02)
    for (let i = 0; i < fade; i += 1) {
      const k = i / fade
      data[i] *= k
      data[data.length - 1 - i] *= k
    }
    return buffer
  }

  private buildVoices(ctx: AudioContext, master: GainNode) {
    const buffer = this.createPinkBuffer(ctx)

    // ——— 1. 风道主体 ———
    const body = ctx.createBufferSource()
    body.buffer = buffer
    body.loop = true

    const bodyLow = ctx.createBiquadFilter()
    bodyLow.type = 'lowpass'
    bodyLow.frequency.value = 1500
    bodyLow.Q.value = 0.7

    // 真实风扇几乎没有 80Hz 以下的能量，砍掉才不“轰”
    const bodyCut = ctx.createBiquadFilter()
    bodyCut.type = 'highpass'
    bodyCut.frequency.value = 82
    bodyCut.Q.value = 0.7

    const bodyPeak = ctx.createBiquadFilter()
    bodyPeak.type = 'peaking'
    bodyPeak.frequency.value = 230
    bodyPeak.Q.value = 1.1
    bodyPeak.gain.value = 6

    const bodyGain = ctx.createGain()
    bodyGain.gain.value = 0.78

    // 湍流：音量忽大忽小，像真实风扇的气团
    const turbulence = ctx.createGain()
    turbulence.gain.value = 1
    const slowA = ctx.createOscillator()
    slowA.type = 'sine'
    slowA.frequency.value = 1.7
    const slowADepth = ctx.createGain()
    slowADepth.gain.value = 0.1
    const slowB = ctx.createOscillator()
    slowB.type = 'sine'
    slowB.frequency.value = 0.29
    const slowBDepth = ctx.createGain()
    slowBDepth.gain.value = 0.06
    slowA.connect(slowADepth)
    slowADepth.connect(turbulence.gain)
    slowB.connect(slowBDepth)
    slowBDepth.connect(turbulence.gain)
    slowA.start()
    slowB.start()

    body.connect(bodyLow)
    bodyLow.connect(bodyCut)
    bodyCut.connect(bodyPeak)
    bodyPeak.connect(bodyGain)
    // 轻微左右分布，听起来像风从机箱两侧同时过来
    const bodyPan = ctx.createStereoPanner()
    bodyPan.pan.value = -0.22
    bodyGain.connect(turbulence)
    turbulence.connect(bodyPan)
    bodyPan.connect(master)
    body.start()

    // 极慢的滤波器摆动，让“呼呼”的厚度有变化
    const drift = ctx.createOscillator()
    drift.type = 'sine'
    drift.frequency.value = 0.13
    const driftDepth = ctx.createGain()
    driftDepth.gain.value = 150
    drift.connect(driftDepth)
    driftDepth.connect(bodyLow.frequency)
    drift.start()

    this.noise = body
    this.noiseFilter = bodyLow

    // ——— 2. 高频气流（轻微） ———
    const hiss = ctx.createBufferSource()
    hiss.buffer = buffer
    hiss.loop = true
    hiss.playbackRate.value = 1.07
    const hissBand = ctx.createBiquadFilter()
    hissBand.type = 'bandpass'
    hissBand.frequency.value = 2600
    hissBand.Q.value = 0.85
    const hissGain = ctx.createGain()
    hissGain.gain.value = 0.16
    hiss.connect(hissBand)
    hissBand.connect(hissGain)
    const hissPan = ctx.createStereoPanner()
    hissPan.pan.value = 0.28
    hissGain.connect(hissPan)
    hissPan.connect(master)
    hiss.start()

    // ——— 3. 叶片通过频率：两组略微失谐的扇叶 ———
    for (const [detune, level] of [
      [1, 1],
      [1.013, 0.72],
    ] as const) {
      const base = ctx.createOscillator()
      base.type = 'sawtooth'
      base.frequency.value = this.bladeFrequency(this.intensity) * detune

      const baseTame = ctx.createBiquadFilter()
      baseTame.type = 'lowpass'
      baseTame.frequency.value = 780
      baseTame.Q.value = 0.6

      const baseGain = ctx.createGain()
      baseGain.gain.value = 0.026 * level

      base.connect(baseTame)
      baseTame.connect(baseGain)
      baseGain.connect(master)
      base.start()
      this.bladeVoices.push({ osc: base, ratio: detune })

      for (const [mult, toneLevel] of [
        [2, 0.013],
        [3, 0.006],
      ] as const) {
        const harmonic = ctx.createOscillator()
        harmonic.type = 'sine'
        harmonic.frequency.value = this.bladeFrequency(this.intensity) * detune * mult
        const harmonicGain = ctx.createGain()
        harmonicGain.gain.value = toneLevel * level
        harmonic.connect(harmonicGain)
        harmonicGain.connect(master)
        harmonic.start()
        this.bladeVoices.push({ osc: harmonic, ratio: detune * mult })
      }
    }

    // ——— 4. 低频箱体共振：机箱本身的“闷” ———
    const rumble = ctx.createBufferSource()
    rumble.buffer = buffer
    rumble.loop = true
    rumble.playbackRate.value = 0.83
    const rumbleLow = ctx.createBiquadFilter()
    rumbleLow.type = 'lowpass'
    rumbleLow.frequency.value = 150
    rumbleLow.Q.value = 1.2

    // 去掉 45Hz 以下几乎听不见、却白占电平的次低频，避免小音箱“噗噗”失真
    const rumbleCut = ctx.createBiquadFilter()
    rumbleCut.type = 'highpass'
    rumbleCut.frequency.value = 85
    rumbleCut.Q.value = 0.7

    const rumbleGain = ctx.createGain()
    rumbleGain.gain.value = 0.3
    rumble.connect(rumbleLow)
    rumbleLow.connect(rumbleCut)
    rumbleCut.connect(rumbleGain)
    rumbleGain.connect(master)
    rumble.start()
  }

  private targetVolume(): number {
    return this.running && !this.muted.value ? 0.52 * this.intensity : 0
  }

  private ramp(seconds = 0.6) {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setTargetAtTime(this.targetVolume(), now, seconds)
  }

  /** 通电：创建音频图并淡入。必须在用户点击的调用栈里触发。 */
  start(intensity = 1) {
    const wasRunning = this.running
    this.intensity = Math.min(1.35, Math.max(0.45, intensity))
    this.running = true
    const ctx = this.ensureContext()
    if (!ctx || !this.master) return
    if (ctx.state === 'suspended') void ctx.resume()
    if (!this.noise) this.buildVoices(ctx, this.master)
    // 刚通电时像真机一样先低转再升速，风扇数量/功耗变化时音高也跟着变
    const now = ctx.currentTime
    const target = this.bladeFrequency(this.intensity)
    for (const voice of this.bladeVoices) {
      const frequency = target * voice.ratio
      voice.osc.frequency.cancelScheduledValues(now)
      if (!wasRunning) voice.osc.frequency.setValueAtTime(frequency * 0.55, now)
      voice.osc.frequency.setTargetAtTime(frequency, now, 0.55)
    }
    this.ramp(wasRunning ? 0.6 : 1.1)
  }

  /** 断电：风扇减速 + 淡出，然后挂起音频上下文，不再占用 CPU。 */
  stop() {
    this.running = false
    if (this.ctx) {
      const now = this.ctx.currentTime
      for (const voice of this.bladeVoices) {
        voice.osc.frequency.cancelScheduledValues(now)
        voice.osc.frequency.setTargetAtTime(voice.osc.frequency.value * 0.55, now, 0.5)
      }
    }
    this.ramp(0.5)
    if (!this.ctx) return
    window.setTimeout(() => {
      if (this.running || this.ctx?.state !== 'running') return
      void this.ctx.suspend()
    }, 1200)
  }

  handlePower(on: boolean, intensity = 1) {
    if (on) this.start(intensity)
    else this.stop()
  }

  setMuted(muted: boolean) {
    this.muted.value = muted
    if (this.ctx?.state === 'suspended' && this.running) void this.ctx.resume()
    this.ramp(0.4)
  }

  toggleMute() {
    this.setMuted(!this.muted.value)
  }
}

export const fanAudio = new FanAudioEngine()




