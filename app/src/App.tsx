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
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_circle_at_50%_-10%,#84cc1620,transparent_60%)]" />
      <header className="border-b border-border"><div className="mx-auto flex h-16 max-w-5xl items-center gap-2.5 px-5">
        <Leaf className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">GreenProof</span>
        <Button size="sm" className="ml-auto" variant="outline" onClick={() => setOpen(!open)}><Plus className="h-4 w-4" /> Claim</Button>
        <Button size="sm" className="ml-2" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
      </div></header>

      <main className="mx-auto max-w-5xl px-5 py-7">
        {/* dashboard metrics */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-card to-background p-5 sm:col-span-1">
            <TreePine className="h-5 w-5 text-primary" />
            <div className="mt-2 text-5xl font-black tabular-nums text-primary"><NumberTicker value={stats.total_tonnes} /></div>
            <div className="text-[11px] uppercase tracking-wider text-muted">tonnes CO₂e credited</div>
          </div>
          <div className="rounded-2xl border border-border bg-card/50 p-5"><div className="text-3xl font-black tabular-nums text-true"><NumberTicker value={stats.verified} /></div><div className="text-[11px] uppercase tracking-wider text-muted">verified projects</div></div>
          <div className="rounded-2xl border border-border bg-card/50 p-5"><div className="text-3xl font-black tabular-nums text-foreground"><NumberTicker value={stats.total_claims} /></div><div className="text-[11px] uppercase tracking-wider text-muted">total claims</div></div>
        </div>

        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mt-4 grid gap-2 rounded-xl border border-border bg-card/60 p-3 sm:grid-cols-[1fr_1fr_120px_auto]">
              <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Project" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <input value={ev} onChange={(e) => setEv(e.target.value)} placeholder="Registry/evidence URL" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <div className="relative"><input value={tonnes} onChange={(e) => setTonnes(e.target.value)} className="w-full rounded-md border border-border bg-background/70 px-3 py-2 pr-8 text-sm outline-none focus:border-primary/50" /><span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-accent">t</span></div>
              <Button size="sm" onClick={claim} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />} Claim</Button>
            </div>
          </motion.div>
        )}

        {/* project tonnage bars */}
        <div className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted">Project ledger</div>
        <div className="mt-2 space-y-2.5">
          {claims.length === 0 && <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">No claims yet.</div>}
          {claims.map((c) => {
            const verified = c.state === 'verified', rejected = c.state === 'rejected'
            const claimW = (c.claimed_tonnes / maxClaimed) * 100
            const verW = c.claimed_tonnes ? (c.verified_tonnes / c.claimed_tonnes) * claimW : 0
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card/40 p-3.5">
                <div className="flex items-center gap-2">
                  <Leaf className={`h-4 w-4 shrink-0 ${verified ? 'text-true' : rejected ? 'text-false' : 'text-muted'}`} />
                  <span className="truncate text-sm font-medium">{c.project}</span>
                  <span className="ml-auto font-mono text-sm tabular-nums">{verified ? <span className="text-true">{c.verified_tonnes}</span> : <span className="text-muted">{c.claimed_tonnes}</span>}<span className="text-[11px] text-muted"> / {c.claimed_tonnes} t</span></span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-background">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-border" style={{ width: `${claimW}%` }} />
                    {verified && <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${verW}%` }} />}
                  </div>
                  {c.state === 'pending'
                    ? <Button size="sm" disabled={busy === c.id} onClick={() => verify(c)}>{busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify</Button>
                    : <span className={`shrink-0 text-[10px] font-bold uppercase ${verified ? 'text-true' : 'text-false'}`}>{c.state}</span>}
                </div>
                {c.reason && c.state !== 'pending' && <p className="mt-1.5 line-clamp-1 text-[11px] text-muted">{c.reason}</p>}
              </div>
            )
          })}
        </div>
      </main>
      <footer className="border-t border-border"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 text-xs text-muted"><span>GreenProof · consensus-verified carbon credits</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
