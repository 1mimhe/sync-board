import { useEffect, useState, useCallback } from 'react'
import type { Card, WorkspaceMember, ListWithCards } from '../../../types'
import { boardViewApi, boardApi, cardApi } from '../../../api/endpoints'
import { CardModal } from '../../card/CardModal'
import { Modal } from '../../common/Modal'
import { useToast } from '../../../stores/toast.store'
import {
  IconChevronLeft,
  IconChevronRight,
  IconCheck,
  IconPlus,
} from '../../common/Icons'

export interface CalendarViewProps {
  workspaceId: string
  boardId: string
  members: WorkspaceMember[]
  onBoardUpdated: () => void
}

export function CalendarView({
  workspaceId,
  boardId,
  members,
  onBoardUpdated,
}: CalendarViewProps) {
  const { addToast } = useToast()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)

  // Scheduling on date state
  const [scheduleDay, setScheduleDay] = useState<Date | null>(null)
  const [scheduleMode, setScheduleMode] = useState<'existing' | 'new'>('existing')
  const [boardLists, setBoardLists] = useState<ListWithCards[]>([])
  const [unscheduledCards, setUnscheduledCards] = useState<Card[]>([])
  const [selectedCardToSchedule, setSelectedCardToSchedule] = useState('')
  const [newCardTitle, setNewCardTitle] = useState('')
  const [newCardListId, setNewCardListId] = useState('')
  const [isScheduling, setIsScheduling] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Start & End of current month window
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)

  // Calendar grid includes leading days from previous month and trailing days
  const startDayOfWeek = firstDayOfMonth.getDay() // 0 = Sunday
  const totalDays = lastDayOfMonth.getDate()

  const startDate = new Date(year, month, 1 - startDayOfWeek)
  const endDate = new Date(year, month, totalDays + (6 - lastDayOfMonth.getDay()))

  const loadCalendarData = useCallback(async () => {
    setLoading(true)
    const res = await boardViewApi.calendar(workspaceId, boardId, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    })
    if (res.success && res.data) {
      setCards(res.data.items || [])
    }
    setLoading(false)
  }, [workspaceId, boardId, startDate.toISOString(), endDate.toISOString()])

  const openScheduleModal = async (day: Date) => {
    setScheduleDay(day)
    const res = await boardApi.getWithContent(workspaceId, boardId)
    if (res.success && res.data) {
      const lists = res.data.lists || []
      setBoardLists(lists)
      if (lists.length > 0) {
        setNewCardListId(lists[0].id)
      }
      const all = lists.flatMap((l) => l.cards || [])
      const unscheduled = all.filter((c) => !c.dueDate)
      setUnscheduledCards(unscheduled)
      if (unscheduled.length > 0) {
        setSelectedCardToSchedule(unscheduled[0].id)
        setScheduleMode('existing')
      } else {
        setScheduleMode('new')
      }
    }
  }

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scheduleDay) return

    const targetDate = new Date(scheduleDay)
    targetDate.setHours(23, 59, 59, 999)
    const dueDateIso = targetDate.toISOString()

    setIsScheduling(true)
    if (scheduleMode === 'existing') {
      if (!selectedCardToSchedule) {
        setIsScheduling(false)
        return
      }
      const res = await cardApi.update(workspaceId, boardId, selectedCardToSchedule, {
        dueDate: dueDateIso,
      })
      setIsScheduling(false)
      if (res.success) {
        addToast('Card scheduled on date!', 'success')
        setScheduleDay(null)
        loadCalendarData()
        onBoardUpdated()
      } else {
        addToast(res.error?.message || 'Failed to schedule card', 'error')
      }
    } else {
      if (!newCardTitle.trim() || !newCardListId) {
        setIsScheduling(false)
        return
      }
      const res = await cardApi.create(workspaceId, boardId, newCardListId, {
        title: newCardTitle.trim(),
        dueDate: dueDateIso,
      })
      setIsScheduling(false)
      if (res.success) {
        addToast('Card created with due date!', 'success')
        setNewCardTitle('')
        setScheduleDay(null)
        loadCalendarData()
        onBoardUpdated()
      } else {
        addToast(res.error?.message || 'Failed to create card', 'error')
      }
    }
  }

  useEffect(() => {
    loadCalendarData()
  }, [loadCalendarData])

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Build array of days
  const days: Date[] = []
  const curr = new Date(startDate)
  while (curr <= endDate) {
    days.push(new Date(curr))
    curr.setDate(curr.getDate() + 1)
  }

  // Group cards by day (YYYY-MM-DD)
  const cardsByDate: Record<string, Card[]> = {}
  for (const card of cards) {
    if (card.dueDate) {
      const key = new Date(card.dueDate).toISOString().slice(0, 10)
      if (!cardsByDate[key]) cardsByDate[key] = []
      cardsByDate[key].push(card)
    }
  }

  const monthName = currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const todayKey = new Date().toISOString().slice(0, 10)

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Calendar Header / Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg2)',
          padding: '10px 16px',
          borderRadius: 'var(--radius2)',
          border: '1px solid var(--border)',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
            {monthName}
          </h2>
          {loading && <span style={{ fontSize: 11, color: 'var(--muted2)' }}>Loading cards…</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleToday}>
            Today
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handlePrevMonth} title="Previous Month">
            <IconChevronLeft size={16} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleNextMonth} title="Next Month">
            <IconChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Calendar Month Grid */}
      <div
        style={{
          background: 'var(--bg2)',
          borderRadius: 'var(--radius2)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow)',
        }}
      >
        {/* Day of week headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            background: 'var(--bg3)',
            borderBottom: '1px solid var(--border)',
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--muted)',
            padding: '8px 0',
          }}
        >
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridAutoRows: 'minmax(110px, auto)',
          }}
        >
          {days.map((day) => {
            const dayKey = day.toISOString().slice(0, 10)
            const isCurrentMonth = day.getMonth() === month
            const isToday = dayKey === todayKey
            const dayCards = cardsByDate[dayKey] || []

            return (
              <div
                key={dayKey}
                style={{
                  borderRight: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  background: isToday
                    ? 'rgba(124, 58, 237, 0.05)'
                    : isCurrentMonth
                    ? 'transparent'
                    : 'rgba(0, 0, 0, 0.25)',
                  minHeight: 110,
                }}
              >
                {/* Date Number & Schedule Button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: isToday ? 800 : 600,
                        color: isToday
                          ? '#fff'
                          : isCurrentMonth
                          ? 'var(--text)'
                          : 'var(--muted2)',
                        background: isToday ? 'var(--violet)' : 'transparent',
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {day.getDate()}
                    </span>
                    {dayCards.length > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--muted2)', fontWeight: 700 }}>
                        {dayCards.length}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      openScheduleModal(day)
                    }}
                    style={{
                      padding: '2px 5px',
                      fontSize: 10,
                      borderRadius: 4,
                      color: 'var(--muted)',
                    }}
                    title={`Schedule card for ${day.toLocaleDateString()}`}
                  >
                    <IconPlus size={12} />
                  </button>
                </div>

                {/* Day Card Chips */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, overflow: 'hidden' }}>
                  {dayCards.map((card) => {
                    const isDone = card.isComplete || card.isCompleted
                    const isOverdue = new Date(dayKey) < new Date(todayKey) && !isDone

                    return (
                      <div
                        key={card.id}
                        onClick={() => setSelectedCard(card)}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 6px',
                          borderRadius: 5,
                          background: isDone
                            ? 'rgba(16, 185, 129, 0.12)'
                            : isOverdue
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'var(--bg3)',
                          border: `1px solid ${
                            isDone
                              ? 'rgba(16, 185, 129, 0.3)'
                              : isOverdue
                              ? 'rgba(239, 68, 68, 0.3)'
                              : 'var(--border)'
                          }`,
                          color: isDone
                            ? '#34d399'
                            : isOverdue
                            ? '#fca5a5'
                            : 'var(--text)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textDecoration: isDone ? 'line-through' : 'none',
                        }}
                        title={card.title}
                      >
                        {isDone && <IconCheck size={10} style={{ flexShrink: 0 }} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {card.title}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          workspaceId={workspaceId}
          boardId={boardId}
          members={members}
          allBoardCards={cards}
          isOpen={!!selectedCard}
          onClose={() => setSelectedCard(null)}
          onOpenCard={(c) => setSelectedCard(c)}
          onCardUpdated={() => {
            loadCalendarData()
            onBoardUpdated()
          }}
        />
      )}

      {/* Schedule / Add Card on Date Modal */}
      {scheduleDay && (
        <Modal
          isOpen={!!scheduleDay}
          onClose={() => setScheduleDay(null)}
          title={`Schedule for ${scheduleDay.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}`}
        >
          <form onSubmit={handleSaveSchedule} style={{ display: 'grid', gap: 14 }}>
            {/* Mode Switcher */}
            <div
              style={{
                display: 'flex',
                background: 'var(--bg3)',
                padding: 3,
                borderRadius: 8,
                border: '1px solid var(--border)',
                gap: 4,
              }}
            >
              <button
                type="button"
                className={`btn btn-sm ${scheduleMode === 'existing' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, fontSize: 12, justifyContent: 'center' }}
                onClick={() => setScheduleMode('existing')}
                disabled={unscheduledCards.length === 0}
              >
                Schedule Existing Card {unscheduledCards.length > 0 ? `(${unscheduledCards.length})` : ''}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${scheduleMode === 'new' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, fontSize: 12, justifyContent: 'center' }}
                onClick={() => setScheduleMode('new')}
              >
                Create New Card
              </button>
            </div>

            {scheduleMode === 'existing' ? (
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                  Select an unscheduled card:
                </label>
                <select
                  value={selectedCardToSchedule}
                  onChange={(e) => setSelectedCardToSchedule(e.target.value)}
                  style={{
                    fontSize: 13,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  required
                >
                  {unscheduledCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                    Card Title:
                  </label>
                  <input
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    placeholder="Enter card title…"
                    style={{
                      fontSize: 13,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                    required
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                    List:
                  </label>
                  <select
                    value={newCardListId}
                    onChange={(e) => setNewCardListId(e.target.value)}
                    style={{
                      fontSize: 13,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                    required
                  >
                    {boardLists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setScheduleDay(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isScheduling || (scheduleMode === 'new' && !newCardTitle.trim())}
              >
                {isScheduling
                  ? 'Saving…'
                  : scheduleMode === 'existing'
                  ? 'Schedule Card'
                  : 'Create & Schedule'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
