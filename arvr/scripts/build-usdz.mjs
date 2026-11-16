// Builds the AR Quick Look models for iPhone/iPad (Safari has no WebXR): a textured globe per body.
// Output: public/ar/<id>.usdz (a USDZ is an uncompressed zip whose files start on 64-byte boundaries).
// Usage: node scripts/build-usdz.mjs            (all bodies below)
// To add a body: give it an equirectangular texture in public/textures and add a line to BODIES, then list
// the id in AR_QUICKLOOK_BODIES (src/xr/arSupport.ts).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { crc32 } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
/** radius in metres: a small table-top globe, not to scale */
const BODIES = [
  { id: 'mars', texture: 'textures/mars.jpg', radius: 0.12 },
  { id: 'moon', texture: 'textures/moon.jpg', radius: 0.1 },
]
const SEGMENTS = 64
const RINGS = 32

function globeUsda(name, radius) {
  const points = []
  const normals = []
  const st = []
  for (let j = 0; j <= RINGS; j++) {
    const v = j / RINGS
    const theta = v * Math.PI // 0 = north pole
    for (let i = 0; i <= SEGMENTS; i++) {
      const u = i / SEGMENTS
      const phi = u * Math.PI * 2
      const nx = Math.sin(theta) * Math.cos(phi)
      const ny = Math.cos(theta)
      const nz = -Math.sin(theta) * Math.sin(phi)
      points.push(`(${(nx * radius).toFixed(5)}, ${(ny * radius).toFixed(5)}, ${(nz * radius).toFixed(5)})`)
      normals.push(`(${nx.toFixed(5)}, ${ny.toFixed(5)}, ${nz.toFixed(5)})`)
      st.push(`(${u.toFixed(5)}, ${(1 - v).toFixed(5)})`)
    }
  }
  const counts = []
  const indices = []
  const stride = SEGMENTS + 1
  for (let j = 0; j < RINGS; j++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const a = j * stride + i
      const b = a + 1
      const c = a + stride
      const d = c + 1
      counts.push(3, 3)
      indices.push(a, c, b, b, c, d)
    }
  }
  return `#usda 1.0
(
    defaultPrim = "${name}"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "${name}" (
    kind = "component"
)
{
    def Mesh "Globe" (
        prepend apiSchemas = ["MaterialBindingAPI"]
    )
    {
        int[] faceVertexCounts = [${counts.join(', ')}]
        int[] faceVertexIndices = [${indices.join(', ')}]
        point3f[] points = [${points.join(', ')}]
        normal3f[] normals = [${normals.join(', ')}] (
            interpolation = "vertex"
        )
        texCoord2f[] primvars:st = [${st.join(', ')}] (
            interpolation = "vertex"
        )
        uniform token subdivisionScheme = "none"
        rel material:binding = </${name}/Material>
    }

    def Material "Material"
    {
        token outputs:surface.connect = </${name}/Material/Surface.outputs:surface>

        def Shader "Surface"
        {
            uniform token info:id = "UsdPreviewSurface"
            color3f inputs:diffuseColor.connect = </${name}/Material/Albedo.outputs:rgb>
            float inputs:roughness = 0.95
            float inputs:metallic = 0
            token outputs:surface
        }

        def Shader "Albedo"
        {
            uniform token info:id = "UsdUVTexture"
            asset inputs:file = @texture.jpg@
            float2 inputs:st.connect = </${name}/Material/UV.outputs:result>
            token inputs:wrapS = "repeat"
            token inputs:wrapT = "clamp"
            float3 outputs:rgb
        }

        def Shader "UV"
        {
            uniform token info:id = "UsdPrimvarReader_float2"
            token inputs:varname = "st"
            float2 outputs:result
        }
    }
}
`
}

/** Stored (uncompressed) zip; each file's data starts on a 64-byte boundary as USDZ requires. */
function usdz(files) {
  const parts = []
  const central = []
  let offset = 0
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name)
    const base = 30 + nameBuf.length
    const pad = (64 - ((offset + base + 4) % 64)) % 64 // 4 = extra-field header
    const extra = Buffer.alloc(4 + pad)
    extra.writeUInt16LE(0x1986, 0) // arbitrary id used for alignment padding
    extra.writeUInt16LE(pad, 2)
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(crc >>> 0, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(extra.length, 28)
    parts.push(local, nameBuf, extra, data)
    const cen = Buffer.alloc(46)
    cen.writeUInt32LE(0x02014b50, 0)
    cen.writeUInt16LE(20, 4)
    cen.writeUInt16LE(20, 6)
    cen.writeUInt32LE(crc >>> 0, 16)
    cen.writeUInt32LE(data.length, 20)
    cen.writeUInt32LE(data.length, 24)
    cen.writeUInt16LE(nameBuf.length, 28)
    cen.writeUInt32LE(offset, 42)
    central.push(cen, nameBuf)
    offset += local.length + nameBuf.length + extra.length + data.length
  }
  const centralBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, centralBuf, end])
}

mkdirSync(join(root, 'public/ar'), { recursive: true })
for (const b of BODIES) {
  const name = b.id[0].toUpperCase() + b.id.slice(1)
  const out = usdz([
    { name: `${b.id}.usda`, data: Buffer.from(globeUsda(name, b.radius)) },
    { name: 'texture.jpg', data: readFileSync(join(root, 'public', b.texture)) },
  ])
  writeFileSync(join(root, 'public/ar', `${b.id}.usdz`), out)
  console.log(`public/ar/${b.id}.usdz  ${(out.length / 1024).toFixed(0)} KB`)
}
