import fs from 'fs'
import path from 'path'
import Setting from '../models/Setting.js'

class ImageGenService{
  constructor(){
    this.url = process.env.IMAGE_GEN_API_URL || ''
    this.key = process.env.IMAGE_GEN_API_KEY || ''
    this.defaultPrompt = ''
  }
  async ensureConfig(){
    if (this.url && this.key) return true
    try{
      const doc = await Setting.findOne({ key: 'ai' }).lean()
      this.url = this.url || doc?.value?.imageGenApiUrl || ''
      this.key = this.key || doc?.value?.imageGenApiKey || ''
      this.defaultPrompt = doc?.value?.defaultImagePrompt || ''
      return !!(this.url && this.key)
    }catch{
      return false
    }
  }
  isAvailable(){ return !!(this.url && this.key) }

  async generateImages(prompt, count=2){
    if (!(await this.ensureConfig())) throw new Error('Image generation API not configured')
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.key}`,
      },
      body: JSON.stringify({ prompt, n: Math.max(1, Math.min(6, Number(count)||2)) })
    })
    if (!res.ok){
      const txt = await res.text().catch(()=> '')
      throw new Error(`Image API error: ${res.status} ${txt}`)
    }
    const data = await res.json().catch(()=> ({}))
    // Accept formats: { images:["data:image/png;base64,..." or url] } or { data:[{b64_json},{url}] }
    let items = []
    if (Array.isArray(data.images)) items = data.images
    else if (Array.isArray(data.data)) items = data.data.map(x => x.b64_json ? `data:image/png;base64,${x.b64_json}` : x.url)
    else if (data.image) items = [data.image]
    items = (items||[]).filter(Boolean)
    return items
  }

  async persistToUploads(images, baseName='gen'){
    const outDir = path.resolve(process.cwd(), 'uploads')
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive:true })
    const saved = []
    let i=0
    for (const img of images){
      const ts = Date.now()
      const fname = `${baseName}-${ts}-${i++}.png`
      const abs = path.join(outDir, fname)
      try{
        if (String(img||'').startsWith('data:')){
          const b64 = String(img).split(',')[1] || ''
          await fs.promises.writeFile(abs, Buffer.from(b64, 'base64'))
        }else if (/^https?:\/\//i.test(String(img||''))){
          const r = await fetch(img)
          const buf = Buffer.from(await r.arrayBuffer())
          await fs.promises.writeFile(abs, buf)
        }else{
          continue
        }
        saved.push(`/uploads/${fname}`)
      }catch{}
    }
    return saved
  }
}

export default new ImageGenService()
