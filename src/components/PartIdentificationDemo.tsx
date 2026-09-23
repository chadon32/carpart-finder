import { Camera, Check, Info, Search } from 'lucide-react'

export function PartIdentificationDemo({ onTryPhoto }: { onTryPhoto: () => void }) {
  return (
    <section aria-labelledby="sample-photo-demo-heading" className="overflow-hidden rounded-2xl border border-brand-200/80 bg-brand-50/50 dark:border-brand-900/50 dark:bg-brand-950/20">
      <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <figure className="relative min-h-52 overflow-hidden bg-slate-900 sm:min-h-full">
          <img
            src="/editorial/parts-workbench-demo.svg"
            alt="Original vector illustration showing an alternator, starter motor, brake pads, an air filter, a sensor, and spark plugs"
            loading="lazy"
            decoding="async"
            className="h-full min-h-52 w-full object-cover"
          />
          <figcaption className="absolute inset-x-3 bottom-3 rounded-lg bg-slate-950/85 px-2.5 py-2 text-[10px] font-medium leading-relaxed text-white">
            Original local vector illustration. It contains no customer vehicle details or third-party image data.
          </figcaption>
        </figure>

        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="icon-tile shrink-0 bg-brand-600 text-white"><Camera size={17} /></div>
            <div className="min-w-0">
              <p className="eyebrow text-brand-700 dark:text-brand-300">Illustrative sample</p>
              <h3 id="sample-photo-demo-heading" className="mt-1 text-base font-bold tracking-tight text-slate-950 dark:text-slate-50">What photo search can extract</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                This saved example shows the shape of a result without calling Gemini or interpreting a personal test.
              </p>
            </div>
          </div>

          <dl className="mt-4 space-y-2 text-xs">
            <div className="flex gap-2 rounded-lg bg-white/80 px-3 py-2 dark:bg-slate-900/70">
              <dt className="flex shrink-0 items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300"><Check size={13} /> Visual category</dt>
              <dd className="text-slate-700 dark:text-slate-200">Alternator housing</dd>
            </div>
            <div className="flex gap-2 rounded-lg bg-white/80 px-3 py-2 dark:bg-slate-900/70">
              <dt className="flex shrink-0 items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300"><Info size={13} /> Still uncertain</dt>
              <dd className="text-slate-700 dark:text-slate-200">Exact part number, options, and fitment</dd>
            </div>
          </dl>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Use the suggestion as a search starting point only. Confirm the label, part number, and vehicle configuration before buying.
          </p>
          <button type="button" onClick={onTryPhoto} className="btn btn-secondary mt-4 w-full text-xs sm:w-auto">
            <Search size={14} /> Use your own photo
          </button>
        </div>
      </div>
    </section>
  )
}
