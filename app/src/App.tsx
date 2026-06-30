import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import {
  Leaf, Wallet, Loader2, Plus, ShieldCheck, Sprout,
} from 'lucide-react'
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
      for (let i = total - 1; i >= 0 && i >= total - 12; i--) { try { const c = (await read('get_claim', [String(i)])) as any; if (c?.exists) out.push({ ...c, id: String(i) }) } catch {} }
      setClaims(out)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function claim() { if (!project.trim() || !ev.trim()) return toast.error('Project + evidence URL.'); const t = Number(tonnes); if (!(t > 0)) return toast.error('Tonnes > 0'); setCreating(true); const to = toast.loading('Filing claim…'); try { await write('claim_offset', [project.trim(), ev.trim(), Math.round(t)]); toast.success('Claim filed.', { id: to }); setProject(''); setEv(''); setOpen(false); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: to }) } finally { setCreating(false) } }
  async function verify(c: Claim) { setBusy(c.id); const to = toast.loading('Validators verifying the offset… (30–60s)'); try { await write('verify', [c.id]); const x = (await read('get_claim', [c.id])) as any; toast.success(x?.legitimate ? `Verified · ${x?.verified_tonnes} t` : 'Rejected', { id: to }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: to }) } finally { setBusy(null) } }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(720px_circle_at_50%_-5%,#84cc1620,transparent_60%)]" />

      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-2.5 px-5">
          <Leaf className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">GreenProof</span>
          <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_claims} /></b> claims · <b className="text-primary"><NumberTicker value={stats.verified} /></b> verified · <b className="text-accent"><NumberTicker value={stats.total_tonnes} /></b> t credited</div>
          <Button size="sm" className="ml-auto" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">Carbon credits, verified before they're issued</h1>
        <p className="mt-1 text-sm text-muted">Validators check the evidence and agree on legitimacy, then credit only the tonnage they can actually verify.</p>

        <div className="mt-5"><Button onClick={() => setOpen(!open)} variant={open ? 'ghost' : 'primary'}><Plus className="h-4 w-4" />{open ? 'Cancel' : 'Claim an offset'}</Button></div>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mt-3 grid gap-2 rounded-xl border border-border bg-card/60 p-3">
              <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Project name" className="rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
              <div className="flex gap-2"><input value={ev} onChange={(e) => setEv(e.target.value)} placeholder="Evidence / registry URL" className="flex-1 rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" /><div className="relative w-32"><input value={tonnes} onChange={(e) => setTonnes(e.target.value)} className="w-full rounded-md border border-border bg-background/70 px-3 py-2.5 pr-12 text-sm outline-none focus:border-primary/50" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-accent">t</span></div><Button size="sm" onClick={claim} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />} Claim</Button></div>
            </div>
          </motion.div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {claims.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">No claims yet.</div>}
          {claims.map((c) => {
            const verified = c.state === 'verified', rejected = c.state === 'rejected'
            const ratio = c.claimed_tonnes ? Math.min(100, (c.verified_tonnes / c.claimed_tonnes) * 100) : 0
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border p-4 ${verified ? 'border-true/30 bg-true/[0.04]' : rejected ? 'border-false/30 bg-false/[0.03]' : 'border-border bg-card/55'}`}>
                <div className="flex items-center gap-2"><Leaf className={`h-4 w-4 ${verified ? 'text-true' : 'text-primary'}`} /><span className="truncate font-semibold">{c.project}</span></div>
                <div className="mt-3 flex items-end gap-2">
                  <div><div className="text-2xl font-black tabular-nums text-accent">{verified ? c.verified_tonnes : c.claimed_tonnes}</div><div className="text-[10px] uppercase text-muted">{verified ? 'verified t' : 'claimed t'}</div></div>
                  {verified && c.verified_tonnes < c.claimed_tonnes && <div className="mb-1 text-[11px] text-muted">of {c.claimed_tonnes} claimed</div>}
                </div>
                {verified && (
                  <div className="mt-2"><div className="h-1.5 w-full overflow-hidden rounded-full bg-border"><div className="h-full bg-true" style={{ width: `${ratio}%` }} /></div><div className="mt-0.5 text-right text-[10px] text-muted">{ratio.toFixed(0)}% credited</div></div>
                )}
                {c.reason && c.state !== 'pending' && <p className="mt-2 line-clamp-2 text-[11px] text-muted">{c.reason}</p>}
                {c.state === 'pending' && <Button size="sm" className="mt-3 w-full" disabled={busy === c.id} onClick={() => verify(c)}>{busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify</Button>}
                {rejected && <div className="mt-2 text-xs font-semibold uppercase text-false">rejected</div>}
              </motion.div>
            )
          })}
        </div>
      </main>

      <footer className="border-t border-border"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-6 text-xs text-muted"><span>GreenProof · consensus-verified carbon credits on GenLayer</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
