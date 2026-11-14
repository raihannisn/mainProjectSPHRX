import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TopBar } from './TopBar'
import { ParticleField } from './ParticleField'
import { useXRApp } from '../../xr/store'

interface ChatMessage {
  id: string
  sender: 'bot' | 'user'
  text: string
  time: string
}

const KNOWLEDGE: Record<string, { name: string; category: string; description: string; type?: string; facts: Record<string, string> }> = {
  'rcw-36': {
    name: 'RCW 36 Emission Nebula',
    category: 'Emission Nebula',
    description: 'A compact H II star-forming region in the Vela Molecular Ridge.',
    facts: {
      'What is this object?':
        'RCW 36 is an emission nebula and star-forming region located inside the Vela Molecular Ridge. It contains a young stellar cluster illuminating a surrounding bubble of ionised gas.',
      'Why is it interesting?':
        'It is one of the closest massive star-forming sites to Earth, allowing astronomers to study stellar birth and circumstellar disk evaporation in real time.',
      'How far away is it?':
        'RCW 36 lies approximately 2,300 light-years (700 parsecs) away from our Solar System.',
      'How does SPHEREx observe it?':
        'SPHEREx maps RCW 36 across 96 discrete infrared channels between 0.75 μm and 5.0 μm, tracing water ice, polycyclic aromatic hydrocarbons (PAHs), and carbon monoxide absorption lines.',
      'Apa objek ini?':
        'RCW 36 adalah nebula emisi dan wilayah pembentukan bintang di Vela Molecular Ridge. Nebula ini memiliki gugus bintang muda yang mengionisasi gas di sekitarnya.',
      'Kenapa ia menarik?':
        'Ini adalah salah satu wilayah pembentukan bintang masif terdekat ke Bumi, ideal untuk meneliti kelahiran bintang dan piringan protoplanet.',
      'Seberapa jauh?':
        'RCW 36 berjarak sekitar 2.300 tahun cahaya (700 parsek) dari Tata Surya kita.',
      'Bagaimana SPHEREx mengamatinya?':
        'SPHEREx memetakan RCW 36 pada 96 pita inframerah antara 0.75 μm hingga 5.0 μm untuk melacak es air, molekul organik, dan garis emisi gas.',
    },
  },
  'vela-ridge': {
    name: 'Vela Molecular Ridge',
    category: 'Molecular Cloud Complex',
    description: 'A vast interstellar molecular cloud complex in the southern constellation Vela.',
    facts: {
      'What is this object?':
        'The Vela Molecular Ridge (VMR) is an extensive giant molecular cloud complex containing dense gas clumps and active star-formation sites.',
      'Why is it interesting?':
        'It is a major laboratory for observing low-to-intermediate mass star formation across diverse stellar environments.',
      'How far away is it?':
        'The complex ranges from 2,300 to 6,500 light-years away.',
      'How does SPHEREx observe it?':
        'SPHEREx captures wide-field spectroscopic snapshots of the whole ridge, providing 3D-like spectral cubes across 102 survey wavelengths.',
      'Apa objek ini?':
        'Vela Molecular Ridge adalah kompleks awan molekul raksasa antarbintang di rasi bintang Vela.',
      'Kenapa ia menarik?':
        'Laboratorium alami untuk mempelajari pembentukan bintang dari berbagai skala massa.',
      'Seberapa jauh?':
        'Kompleks ini membentang antara 2.300 hingga 6.500 tahun cahaya.',
      'Bagaimana SPHEREx mengamatinya?':
        'SPHEREx memindai seluruh awan ini secara spektroskopis untuk menganalisis komposisi kimiawi debu dan gas antarbintang.',
    },
  },
  'candidate-02': {
    name: 'Moving-source candidate',
    type: 'Candidate source',
    category: 'Candidate Detection',
    description: 'An illustrative candidate source demonstrating verification workflows.',
    facts: {
      'What is this object?':
        'This candidate source illustrates how anomalous infrared flux variations or astrometric shifts are flagged during multi-epoch SPHEREx surveys.',
      'Why is it interesting?':
        'Candidate flagging allows astronomers and citizen scientists to review potential asteroids, Kuiper Belt Objects, or brown dwarfs.',
      'How far away is it?':
        'Distance is currently unmeasured and labelled as an unverified candidate.',
      'How does SPHEREx observe it?':
        'SPHEREx revisits sky tiles in 6-month intervals, enabling temporal blink comparisons to detect true solar-system motion versus detector artifacts.',
      'Apa objek ini?':
        'Kandidat peraga untuk mengilustrasikan bagaimana variasi fluks inframerah atau pergeseran posisi ditandai pada survei multi-epoch SPHEREx.',
      'Kenapa ia menarik?':
        'Penandaan kandidat membuka peluang penemuan asteroid baru, objek Sabuk Kuiper, atau katai cokelat dingin.',
      'Seberapa jauh?':
        'Jarak belum terukur (status kandidat belum terverifikasi).',
      'Bagaimana SPHEREx mengamatinya?':
        'SPHEREx mengunjungi kembali petak langit setiap 6 bulan untuk perbandingan blink antar waktu.',
    },
  },
}

export function CosmicGuideScreen() {
  const navigate = useNavigate()
  const { objectId } = useParams<{ objectId?: string }>()
  const lang = useXRApp((s) => s.settings.lang)

  const currentKey = objectId && KNOWLEDGE[objectId] ? objectId : 'rcw-36'
  const currentObj = KNOWLEDGE[currentKey]

  const chips =
    lang === 'id'
      ? ['Apa objek ini?', 'Kenapa ia menarik?', 'Seberapa jauh?', 'Bagaimana SPHEREx mengamatinya?']
      : ['What is this object?', 'Why is it interesting?', 'How far away is it?', 'How does SPHEREx observe it?']

  const initialGreeting =
    lang === 'id'
      ? `Halo! Aku Cosmic Guide. Tanyakan apa saja tentang ${currentObj.name}. (Data disajikan dengan transparansi ilmiah).`
      : `Hi! I'm your Cosmic Guide. Ask me anything about ${currentObj.name}. (Answers adhere to NASA/SPHEREx verified data).`

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'bot',
      text: initialGreeting,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  const [inputVal, setInputVal] = useState('')

  const handleSend = (question: string) => {
    if (!question.trim()) return

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: question,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputVal('')

    setTimeout(() => {
      const knownAnswer = currentObj.facts[question]
      const botText =
        knownAnswer ||
        (lang === 'id'
          ? `Mengenai "${question}" pada ${currentObj.name}: SPHEREx mengamati objek ini pada 96 kanal inframerah. Hubungi tim sains untuk kueri lanjutan atau periksa FITS header di menu Comparison.`
          : `Regarding "${question}" on ${currentObj.name}: SPHEREx observes this target in 96 infrared channels. Consult the FITS metadata or compare epochs in the Comparison view.`)

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: botText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, botMsg])
    }, 450)
  }

  return (
    <div className="fe-app">
      <ParticleField />
      <TopBar />

      <main className="fe-guide-container">
        <div className="fe-guide-head">
          <div>
            <div className="fe-eyebrow">Interactive Cosmic AI Guide</div>
            <h1 style={{ margin: '4px 0 0', fontSize: '1.6rem', fontWeight: 600 }}>
              {currentObj.name}
            </h1>
            <p className="fe-muted" style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>
              Category: {currentObj.category} · Verified provenance
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="fe-btn-text" onClick={() => navigate('/explorer')}>
              ← Explorer
            </button>
            <button
              className="fe-btn-primary fe-btn-gold"
              onClick={() => navigate('/xr/body/spherex')}
            >
              Inspect in 3D ↗
            </button>
          </div>
        </div>

        {/* Object context switcher */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="fe-mono fe-muted" style={{ fontSize: '0.72rem' }}>
            {lang === 'id' ? 'PILIH TOPIK:' : 'DISCUSSING:'}
          </span>
          {Object.keys(KNOWLEDGE).map((k) => (
            <button
              key={k}
              className={`fe-tab ${k === currentKey ? 'active' : ''}`}
              style={{ fontSize: '0.72rem', padding: '6px 12px' }}
              onClick={() => {
                navigate(`/guide/${k}`)
                const switchMsg: ChatMessage = {
                  id: `sw-${Date.now()}`,
                  sender: 'bot',
                  text:
                    lang === 'id'
                      ? `Konteks diubah ke: ${KNOWLEDGE[k].name}`
                      : `Switched context to: ${KNOWLEDGE[k].name}`,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }
                setMessages((m) => [...m, switchMsg])
              }}
            >
              {KNOWLEDGE[k].name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Suggested Quick Question Chips */}
        <div className="fe-guide-chips">
          {chips.map((q) => (
            <button key={q} className="fe-guide-chip" onClick={() => handleSend(q)}>
              {q}
            </button>
          ))}
        </div>

        {/* Chat History View */}
        <div className="fe-guide-chat" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`fe-msg ${m.sender}`}>
              <div style={{ fontSize: '0.64rem', opacity: 0.7, marginBottom: '4px' }}>
                {m.sender === 'bot' ? 'COSMIC GUIDE · SCIENTIFIC ASSISTANT' : 'RESEARCHER'} · {m.time}
              </div>
              <div>{m.text}</div>
            </div>
          ))}
        </div>

        {/* Chat Input Form */}
        <form
          className="fe-guide-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleSend(inputVal)
          }}
        >
          <input
            type="text"
            className="fe-guide-input"
            placeholder={
              lang === 'id'
                ? `Tanyakan tentang ${currentObj.name} atau misi SPHEREx...`
                : `Ask about ${currentObj.name} or SPHEREx survey...`
            }
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
          />
          <button type="submit" className="fe-btn-primary" style={{ padding: '0 24px', minHeight: '44px' }}>
            {lang === 'id' ? 'Kirim' : 'Send'}
          </button>
        </form>
      </main>
    </div>
  )
}
