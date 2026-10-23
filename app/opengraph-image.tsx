import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const alt = 'СтройАудит.ai — экспресс-проверка проектов и смет ИЖС'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const font = await readFile(join(process.cwd(), 'assets/manrope-bold.ttf'))

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#FAFAFA',
        color: '#171717',
        padding: '72px',
        fontFamily: 'Manrope',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: 14,
            background: '#171717',
            color: '#FAFAFA',
            fontSize: 24,
          }}
        >
          СА
        </div>
        <div style={{ display: 'flex', marginLeft: 20, fontSize: 32 }}>СтройАудит.ai</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 980 }}>
        <div style={{ display: 'flex', fontSize: 68, lineHeight: 1.05, letterSpacing: -1.5 }}>
          Экспресс-проверка проектов и смет ИЖС
        </div>
        <div style={{ display: 'flex', marginTop: 28, fontSize: 32, color: '#525252' }}>
          СН и СП Беларуси, России и Казахстана
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: 'Manrope', data: font, style: 'normal', weight: 700 }],
    },
  )
}
