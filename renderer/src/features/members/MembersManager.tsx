import { useEffect, useState } from 'react'
import type { DragEvent, FormEvent } from 'react'
import { GripVertical } from 'lucide-react'
import { useAppStore } from '@renderer/store/useAppStore'
import { Card, Pill, SectionHeader } from '@renderer/components/ui'

export const MembersManager = ({ addRequestToken = 0 }: { addRequestToken?: number }) => {
  const members = useAppStore((state) => state.members)
  const upsertMember = useAppStore((state) => state.upsertMember)
  const deleteMember = useAppStore((state) => state.deleteMember)
  const reorderMembers = useAppStore((state) => state.reorderMembers)

  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [name, setName] = useState('')
  const [memberType, setMemberType] = useState<'person' | 'property' | 'business'>('person')
  const [active, setActive] = useState(true)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [draggedMemberId, setDraggedMemberId] = useState<string | null>(null)
  const [dragOverMemberId, setDragOverMemberId] = useState<string | null>(null)

  useEffect(() => {
    if (addRequestToken < 1) return
    setEditingId(undefined)
    setName('')
    setMemberType('person')
    setActive(true)
    setPendingDeleteId(null)
    setPanelOpen(true)
  }, [addRequestToken])

  const resetForm = () => {
    setEditingId(undefined)
    setName('')
    setMemberType('person')
    setActive(true)
    setPendingDeleteId(null)
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return

    await upsertMember({
      id: editingId,
      name: name.trim(),
      member_type: memberType,
      active,
    })

    resetForm()
  }

  const beginEdit = (memberId: string) => {
    const member = members.find((candidate) => candidate.id === memberId)
    if (!member) return
    setEditingId(member.id)
    setName(member.name)
    setMemberType(member.member_type ?? 'person')
    setActive(member.active)
    setPanelOpen(true)
  }

  const removeMember = async (memberId: string) => {
    if (pendingDeleteId !== memberId) {
      setPendingDeleteId(memberId)
      return
    }

    await deleteMember({ id: memberId })
    setPendingDeleteId(null)

    if (editingId === memberId) {
      resetForm()
    }
  }

  const handleDropReorder = async (targetMemberId: string) => {
    if (!draggedMemberId || draggedMemberId === targetMemberId) {
      setDragOverMemberId(null)
      return
    }

    const sourceIndex = members.findIndex((member) => member.id === draggedMemberId)
    const targetIndex = members.findIndex((member) => member.id === targetMemberId)
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggedMemberId(null)
      setDragOverMemberId(null)
      return
    }

    const reordered = [...members]
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    setDraggedMemberId(null)
    setDragOverMemberId(null)
    await reorderMembers({ ids: reordered.map((member) => member.id) })
  }

  return (
    <Card>
      <SectionHeader title="Members" subtitle="Add, edit, reorder, and manage active household members, businesses, and properties." />

      <div className="space-y-4 p-5">
        {panelOpen && (
          <form className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2" onSubmit={onSubmit}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Member name"
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <select
              value={memberType}
              onChange={(event) => setMemberType(event.target.value as 'person' | 'property' | 'business')}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="person">Person</option>
              <option value="property">Property</option>
              <option value="business">Business</option>
            </select>

            <label className="flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
              Active
            </label>

            <div className="flex gap-2">
              <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
                {editingId ? 'Update Member' : 'Add Member'}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setPanelOpen(false)
                }}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                Clear
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              role="button"
              tabIndex={0}
              onClick={() => beginEdit(member.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  beginEdit(member.id)
                }
              }}
              onDragOver={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault()
                if (draggedMemberId) setDragOverMemberId(member.id)
              }}
              onDrop={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault()
                void handleDropReorder(member.id)
              }}
              onDragLeave={() => {
                if (dragOverMemberId === member.id) setDragOverMemberId(null)
              }}
              className={`flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 shadow-sm transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-[1px] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                dragOverMemberId === member.id ? 'border-slate-400 ring-1 ring-slate-300' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-label="Reorder handle"
                  title="Drag this handle onto another member card to reorder"
                  draggable
                  onClick={(event) => {
                    event.stopPropagation()
                  }}
                  onMouseDown={(event) => {
                    event.stopPropagation()
                  }}
                  onDragStart={(event: DragEvent<HTMLSpanElement>) => {
                    event.stopPropagation()
                    event.dataTransfer.effectAllowed = 'move'
                    setDraggedMemberId(member.id)
                  }}
                  onDragEnd={() => {
                    setDraggedMemberId(null)
                    setDragOverMemberId(null)
                  }}
                  className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                  <p className="text-xs capitalize text-slate-500">{member.member_type}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Pill tone={member.active ? 'positive' : 'neutral'}>{member.active ? 'Active' : 'Inactive'}</Pill>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    beginEdit(member.id)
                  }}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                >
                  Edit
                </button>
                <button
                  type="button"
                  title={pendingDeleteId === member.id ? 'Click again to confirm delete' : 'Delete'}
                  onClick={(event) => {
                    event.stopPropagation()
                    void removeMember(member.id)
                  }}
                  className="inline-flex items-center justify-center rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50"
                >
                  {pendingDeleteId === member.id ? 'Confirm' : 'Delete'}
                </button>
              </div>
            </div>
          ))}

          {members.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No members yet. Use Add Member to create the first household member.
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
