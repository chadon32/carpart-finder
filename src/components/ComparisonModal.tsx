import { X } from 'lucide-react'
import type { Listing } from '../api/client'
import { Modal } from './Modal'

export function ComparisonModal({ listings, onClose }: { listings: Listing[]; onClose: () => void }) {
  return (
    <Modal label="Compare listings" onClose={onClose} maxWidth="max-w-6xl">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold">Compare Listings</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {listings.map((item) => (
            <div key={item.id} className="rounded-2xl border p-4">
              <div className="mb-2 text-sm font-semibold">{item.title}</div>
              <div className="mb-2 text-2xl font-bold">${item.price.toFixed(2)}</div>
              <div className="mb-1 text-xs text-slate-500">
                {item.condition} • {item.source}
              </div>
              <div className="text-xs text-slate-500">{item.seller}</div>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary mt-4 w-full text-sm"
              >
                View Listing
              </a>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
