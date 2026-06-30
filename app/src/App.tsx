import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Leaf, Wallet, Loader2, Plus, ShieldCheck, Sprout, TreePine } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
type Claim = { id: string; claimant: string; project: string; evidence_url: string; claimed_tonnes: number; state: string; legitimate: boolean; verified_tonnes: number; reason: string }

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_claims: 0, verified: 0, total_tonnes: 0 })
  const [claims, setClaims] = useState<Claim[]>([])
  const [open, setOpen] = useState(false)
  const [project, setProject] = useState(''); const [ev, setEv] = useState(''); const [tonnes, setTonnes] = useState('500')
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_claims: Number(s?.total_claims ?? 0), verified: Number(s?.verified ?? 0), total_tonnes: Number(s?.total_tonnes ?? 0) })
      const total = Number(s?.total_claims ?? 0); const out: Claim[] = []
      for (let i = total - 1; i >= 0 && i >= total - 20; i--) { try { const c = (await read('get_claim', [String(i)])) as any; if (c?.exists) out.push({ ...c, id: String(i) }) } catch {} }
      setClaims(out)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function claim() { if (!project.trim() || !ev.trim()) return toast.error('Project + evidence.'); if (!(Number(tonnes) > 0)) return toast.error('Tonnes > 0'); setCreating(true); const t = toast.loading('Filing…'); try { await write('claim_offset', [project.trim(), ev.trim(), Math.round(Number(tonnes))]); toast.success('Filed.', { id: t }); setProject(''); setEv(''); setOpen(false); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function verify(c: Claim) { setBusy(c.id); const to = toast.loading('Verifying… (30–60s)'); try { await write('verify', [c.id]); const x = (await read('get_claim', [c.id])) as any; toast.success(x?.legitimate ? `${x?.verified_tonnes} t verified` : 'Rejected', { id: to }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: to }) } finally { setBusy(null) } }

  const maxClaimed = Math.max(1, ...claims.map((c) => c.claimed_tonnes))

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: 'DM Sans, system-ui, sans-serif' }}>
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1100px_circle_at_12%_-8%,#84cc1618,transparent_55%),radial-gradient(820px_circle_at_100%_0%,#22c55e14,transparent_50%)]" />

      {/* floating brand + connect — no header bar */}
      <div className="fixed right-3 top-3 z-50 flex items-center gap-2 rounded-full border border-border bg-card/80 py-1.5 pl-3.5 pr-1.5 shadow-lg shadow-black/40 backdrop-blur-md">
        <Leaf className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold tracking-tight">GreenProof</span>
        <Button size="sm" className="ml-1 rounded-full" variant={wallet ? 'outline' : 'primary'} onClick={connect}>
          <Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}
        </Button>
      </div>

      <main className="mx-auto max-w-6xl px-5 pb-16 pt-20 sm:pt-24">
        {/* HERO BAND — impact metric tiles */}
        <motion.section
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-card via-surface to-background p-6 sm:p-9"
        >
          <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
            {/* headline metric: total tonnes credited */}
            <div className="min-w-[260px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <TreePine className="h-3.5 w-3.5" /> Verified carbon ledger
              </span>
              <div className="mt-4 flex items-end gap-2 leading-none">
                <span className="text-6xl font-black tabular-nums text-primary sm:text-7xl"><NumberTicker value={stats.total_tonnes} /></span>
                <span className="mb-1.5 text-xl font-bold text-accent">t</span>
              </div>
              <div className="mt-2 text-sm text-muted">tonnes CO₂e credited &amp; quantified on-chain</div>
            </div>

            {/* secondary metric tiles */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-background/40 px-6 py-5 text-center">
                <div className="text-4xl font-black tabular-nums text-true sm:text-5xl"><NumberTicker value={stats.verified} /></div>
                <div className="mt-1.5 text-[11px] uppercase tracking-wider text-muted">verified projects</div>
              </div>
              <div className="rounded-2xl border border-border bg-background/40 px-6 py-5 text-center">
                <div className="text-4xl font-black tabular-nums text-foreground sm:text-5xl"><NumberTicker value={stats.total_claims} /></div>
                <div className="mt-1.5 text-[11px] uppercase tracking-wider text-muted">total claims</div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* section header + claim toggle */}
        <div className="mt-10 flex items-center gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Per-project tonnage</h2>
          <div className="h-px flex-1 bg-border" />
          <Button size="sm" variant="outline" onClick={() => setOpen(!open)}><Plus className="h-4 w-4" /> File claim</Button>
        </div>

        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mt-3 grid gap-2 rounded-2xl border border-border bg-card/60 p-3 sm:grid-cols-[1fr_1fr_120px_auto]">
              <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Project" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <input value={ev} onChange={(e) => setEv(e.target.value)} placeholder="Registry/evidence URL" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <div className="relative"><input value={tonnes} onChange={(e) => setTonnes(e.target.value)} className="w-full rounded-lg border border-border bg-background/70 px-3 py-2 pr-8 text-sm outline-none focus:border-primary/50" /><span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-accent">t</span></div>
              <Button size="sm" onClick={claim} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />} Claim</Button>
            </div>
          </motion.div>
        )}

        {/* PER-PROJECT TONNAGE BAR METERS (verified vs claimed) */}
        <div className="mt-4 space-y-3">
          {claims.length === 0 && <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted">No claims yet — file the first offset claim.</div>}
          {claims.map((c) => {
            const verified = c.state === 'verified', rejected = c.state === 'rejected'
            const claimW = (c.claimed_tonnes / maxClaimed) * 100
            const verW = c.claimed_tonnes ? (c.verified_tonnes / c.claimed_tonnes) * claimW : 0
            return (
              <div key={c.id} className="rounded-2xl border border-border bg-card/40 p-4 transition-colors hover:border-primary/30">
                <div className="flex items-center gap-2.5">
                  <Leaf className={`h-4 w-4 shrink-0 ${verified ? 'text-true' : rejected ? 'text-false' : 'text-muted'}`} />
                  <span className="truncate text-sm font-semibold">{c.project}</span>
                  {c.state === 'pending'
                    ? <Button size="sm" className="ml-auto" disabled={busy === c.id} onClick={() => verify(c)}>{busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify</Button>
                    : <span className={`ml-auto shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${verified ? 'border-true/30 bg-true/10 text-true' : 'border-false/30 bg-false/10 text-false'}`}>{c.state}</span>}
                </div>

                {/* tonnage meter: claimed track with verified overlay */}
                <div className="relative mt-3 h-6 w-full overflow-hidden rounded-lg bg-background">
                  <div className="absolute inset-y-0 left-0 rounded-lg bg-border/80" style={{ width: `${claimW}%` }} />
                  {verified && <div className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-accent to-primary" style={{ width: `${verW}%` }} />}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums">
                  <span className="text-muted">claimed <span className="font-mono text-foreground">{c.claimed_tonnes}</span> t</span>
                  <span className={verified ? 'text-true' : 'text-muted'}>verified <span className="font-mono">{verified ? c.verified_tonnes : 0}</span> t</span>
                </div>

                {c.reason && c.state !== 'pending' && <p className="mt-2 line-clamp-1 text-[11px] text-muted">{c.reason}</p>}
              </div>
            )
          })}
        </div>

        <div className="mt-12 flex items-center justify-between border-t border-border pt-6 text-xs text-muted">
          <span>GreenProof · consensus-verified carbon credits</span>
          <a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a>
        </div>
      </main>
    </div>
  )
}
