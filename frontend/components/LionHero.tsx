import { useEffect, useRef, useState } from 'react'

export default function LionHero() {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const matrixRef   = useRef<HTMLCanvasElement>(null)
  const [loaded,    setLoaded]    = useState(false)
  const [scanning,  setScanning]  = useState(false)
  const [glitching, setGlitching] = useState(false)

  // Matrix rain
  useEffect(() => {
    const canvas = matrixRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width  = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    const cols    = Math.floor(canvas.width / 14)
    const drops   = Array(cols).fill(1)
    const chars   = '01アイウエオカキクケコサシスセソタチツLDALIONXTRONAIWEB3DeFi'

    const draw = () => {
      ctx.fillStyle = 'rgba(5,5,8,0.07)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = 'rgba(20,184,166,0.45)'
      ctx.font = '13px Space Mono, monospace'
      drops.forEach((y, i) => {
        const char = chars[Math.floor(Math.random() * chars.length)]
        ctx.fillText(char, i * 14, y * 14)
        if (y * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0
        drops[i]++
      })
    }
    const id = setInterval(draw, 55)
    return () => clearInterval(id)
  }, [])

  // Orbit particles canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width = canvas.offsetWidth
    const H = canvas.height = canvas.offsetHeight
    const cx = W / 2, cy = H / 2
    let t = 0, animId: number

    const orbits = [
      { r: 130, count: 8,  speed: 0.008, size: 2.5, color: '#f5a623', phase: 0    },
      { r: 165, count: 12, speed: 0.005, size: 1.8, color: '#14b8a6', phase: 1.2  },
      { r: 200, count: 6,  speed: 0.003, size: 3.0, color: '#f5a623', phase: 2.1  },
    ]

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      t += 1

      orbits.forEach(o => {
        // Orbit ring
        ctx.beginPath()
        ctx.arc(cx, cy, o.r, 0, Math.PI * 2)
        ctx.strokeStyle = o.color === '#f5a623' ? 'rgba(245,166,35,0.07)' : 'rgba(20,184,166,0.07)'
        ctx.lineWidth   = 1
        ctx.stroke()

        // Particles on orbit
        for (let i = 0; i < o.count; i++) {
          const angle = (i / o.count) * Math.PI * 2 + t * o.speed + o.phase
          const px    = cx + o.r * Math.cos(angle)
          const py    = cy + o.r * Math.sin(angle)
          const glow  = ctx.createRadialGradient(px, py, 0, px, py, o.size * 3)
          glow.addColorStop(0,   o.color + 'ff')
          glow.addColorStop(0.5, o.color + '88')
          glow.addColorStop(1,   o.color + '00')
          ctx.beginPath()
          ctx.arc(px, py, o.size, 0, Math.PI * 2)
          ctx.fillStyle = glow
          ctx.fill()
        }
      })

      // Rotating dashes on inner ring
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2 + t * 0.004
        const x1 = cx + 110 * Math.cos(angle)
        const y1 = cy + 110 * Math.sin(angle)
        const x2 = cx + 120 * Math.cos(angle)
        const y2 = cy + 120 * Math.sin(angle)
        ctx.beginPath()
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
        ctx.strokeStyle = i % 3 === 0 ? 'rgba(245,166,35,0.6)' : 'rgba(20,184,166,0.25)'
        ctx.lineWidth = i % 3 === 0 ? 2 : 1
        ctx.stroke()
      }

      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [])

  // Entrance sequence
  useEffect(() => {
    const t1 = setTimeout(() => setLoaded(true),   400)
    const t2 = setTimeout(() => setScanning(true), 800)
    const t3 = setTimeout(() => setGlitching(true), 1500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  // Periodic glitch
  useEffect(() => {
    const t = setInterval(() => {
      setGlitching(true)
      setTimeout(() => setGlitching(false), 300)
    }, 5000)
    return () => clearInterval(t)
  }, [])

  // ── Mobile: static lightweight version (no canvas) ────────
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center md:hidden" style={{ height: 220, width: '100%' }}>
        <div style={{ fontSize: 80, filter: 'drop-shadow(0 0 24px rgba(245,166,35,0.7)) drop-shadow(0 0 48px rgba(20,184,166,0.4))', animation: 'lion-pulse 4s ease-in-out infinite' }}>
          🦁
        </div>
        <div className="mt-3 font-black text-xl tracking-widest" style={{ color: '#f5a623', fontFamily: 'Space Mono, monospace', textShadow: '0 0 20px rgba(245,166,35,0.5)' }}>LION X</div>
        <div className="mt-1 text-xs font-mono tracking-widest" style={{ color: 'rgba(20,184,166,0.6)' }}>AI PLATFORM · TRON NETWORK</div>
        <style>{`@keyframes lion-pulse { 0%,100%{transform:scale(1) rotate(-2deg)}50%{transform:scale(1.05) rotate(2deg)} }`}</style>
      </div>
    )
  }

  return (
    <div className="relative hidden md:flex items-center justify-center" style={{ height: 440, width: '100%' }}>

      {/* Matrix rain background */}
      <canvas ref={matrixRef} className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"/>

      {/* HUD corner brackets */}
      {[['top-4 left-4', 'border-t-2 border-l-2 rounded-tl-sm'],
        ['top-4 right-4', 'border-t-2 border-r-2 rounded-tr-sm'],
        ['bottom-4 left-4', 'border-b-2 border-l-2 rounded-bl-sm'],
        ['bottom-4 right-4', 'border-b-2 border-r-2 rounded-br-sm'],
      ].map(([pos, border]) => (
        <div key={pos} className={`absolute ${pos} w-6 h-6 ${border} transition-all duration-700`}
          style={{ borderColor: '#14b8a6', opacity: loaded ? 0.7 : 0 }}/>
      ))}

      {/* HUD data readouts */}
      <div className="absolute top-5 left-10 text-left transition-all duration-1000" style={{ opacity: loaded ? 1 : 0 }}>
        {['SYS: ONLINE', 'NET: TRON/SHASTA', 'TOKEN: LDA'].map((l, i) => (
          <div key={l} className="font-mono text-xs mb-0.5" style={{ color: '#14b8a6', opacity: 0.6, animationDelay: `${i * 200}ms` }}>{l}</div>
        ))}
      </div>
      <div className="absolute top-5 right-10 text-right transition-all duration-1000" style={{ opacity: loaded ? 1 : 0 }}>
        {['SUPPLY: 10,000,000', 'BURN: 70% PER TX', 'STATUS: LIVE'].map((l, i) => (
          <div key={l} className="font-mono text-xs mb-0.5" style={{ color: '#f5a623', opacity: 0.6 }}>{l}</div>
        ))}
      </div>

      {/* Orbit canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none"/>

      {/* Holographic expanding rings */}
      {loaded && [0, 800, 1600].map(delay => (
        <div key={delay} className="absolute rounded-full pointer-events-none" style={{
          width: 220, height: 220,
          border: '1px solid rgba(20,184,166,0.5)',
          animation: `expand-ring 3s ease-out ${delay}ms infinite`,
        }}/>
      ))}

      {/* Scan line */}
      {scanning && (
        <div className="absolute pointer-events-none" style={{
          left: '50%', transform: 'translateX(-50%)',
          width: 220, height: 2,
          background: 'linear-gradient(90deg,transparent,rgba(20,184,166,0.8),transparent)',
          animation: 'scan-sweep 2.5s ease-in-out infinite',
          boxShadow: '0 0 10px rgba(20,184,166,0.5)',
        }}/>
      )}

      {/* The Lion */}
      <div className="relative z-10 flex flex-col items-center"
        style={{
          transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: loaded ? 'scale(1) translateY(0)' : 'scale(0.3) translateY(40px)',
          opacity: loaded ? 1 : 0,
        }}>

        {/* Outer glow ring */}
        <div className="absolute rounded-full" style={{
          width: 200, height: 200,
          background: 'radial-gradient(circle,rgba(245,166,35,0.15) 0%,rgba(20,184,166,0.05) 50%,transparent 70%)',
          animation: 'breathe 3s ease-in-out infinite',
        }}/>

        {/* Hexagon frame */}
        <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
          <svg width="160" height="160" className="absolute" style={{ animation: 'spin-slow 20s linear infinite' }}>
            <polygon points="80,4 148,42 148,118 80,156 12,118 12,42"
              fill="none" stroke="rgba(245,166,35,0.3)" strokeWidth="1.5"
              strokeDasharray="8 4"/>
          </svg>
          <svg width="140" height="140" className="absolute" style={{ animation: 'spin-slow 15s linear infinite reverse' }}>
            <polygon points="70,6 128,38 128,102 70,134 12,102 12,38"
              fill="none" stroke="rgba(20,184,166,0.25)" strokeWidth="1"
              strokeDasharray="4 6"/>
          </svg>

          {/* Lion emoji — the star */}
          <div className="relative z-10 select-none"
            style={{
              fontSize: 88,
              filter: `drop-shadow(0 0 20px rgba(245,166,35,0.7)) drop-shadow(0 0 40px rgba(245,166,35,0.4)) drop-shadow(0 0 60px rgba(20,184,166,0.3))`,
              animation: 'lion-pulse 4s ease-in-out infinite',
              ...(glitching ? { filter: 'drop-shadow(0 0 20px rgba(20,184,166,0.9)) hue-rotate(90deg) brightness(1.5)', transform: 'translate(-2px, 1px) skewX(-3deg)' } : {}),
              transition: glitching ? 'none' : 'filter 0.3s ease, transform 0.3s ease',
            }}>
            🦁
          </div>
        </div>

        {/* LION X glitch text */}
        <div className="mt-3 relative" style={{ letterSpacing: 6 }}>
          <span className="font-black text-2xl tracking-widest uppercase"
            style={{
              color: glitching ? '#14b8a6' : '#f5a623',
              textShadow: glitching
                ? '2px 0 #f5a623, -2px 0 #14b8a6, 0 0 20px #14b8a6'
                : '0 0 20px rgba(245,166,35,0.6), 0 0 40px rgba(245,166,35,0.3)',
              transition: 'all 0.1s ease',
              fontFamily: 'Space Mono, monospace',
            }}>
            LION X
          </span>
          {glitching && (
            <>
              <span className="absolute inset-0 font-black text-2xl tracking-widest uppercase" style={{ color: '#f5a623', opacity: 0.7, transform: 'translate(2px,-1px)', clipPath: 'polygon(0 0,100% 0,100% 40%,0 40%)', fontFamily: 'Space Mono,monospace', letterSpacing: 6 }}>LION X</span>
              <span className="absolute inset-0 font-black text-2xl tracking-widest uppercase" style={{ color: '#14b8a6', opacity: 0.7, transform: 'translate(-2px,1px)', clipPath: 'polygon(0 60%,100% 60%,100% 100%,0 100%)', fontFamily: 'Space Mono,monospace', letterSpacing: 6 }}>LION X</span>
            </>
          )}
        </div>

        {/* Tagline */}
        <div className="mt-1 font-mono text-xs tracking-widest" style={{ color: 'rgba(20,184,166,0.6)' }}>
          AI PLATFORM · TRON NETWORK
        </div>
      </div>

      <style>{`
        @keyframes expand-ring {
          0%   { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes scan-sweep {
          0%   { top: 30%; }
          50%  { top: 70%; }
          100% { top: 30%; }
        }
        @keyframes lion-pulse {
          0%,100% { transform: scale(1) rotate(-2deg); }
          50%     { transform: scale(1.05) rotate(2deg); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
