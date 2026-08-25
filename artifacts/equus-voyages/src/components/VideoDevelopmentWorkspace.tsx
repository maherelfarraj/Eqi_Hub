import React, { useState } from 'react';
import { 
  useVideoRelease3Development, 
  useVideoRelease3Actions, 
  type TrainingPlan, 
  type Benchmark, 
  type Milestone, 
  type DevelopmentComparison, 
  type CoachReport, 
  type DevelopmentTimelinePoint 
} from '../hooks/use-video-release-3';
import { useVideoRelease2PilotRiders } from '../hooks/use-video-release-2';
import { useHorses } from '../hooks/use-horses';
import {
  PrimaryButton,
  OutlineButton,
  SurfaceCard,
  PageSkeleton,
  EmptyState,
  ErrorState,
  StatusBadge,
  Modal,
  BusyLabel,
  formatDate,
  fieldClass,
  labelClass
} from './EquiVistaUI';
import { Users, FileText, Target, Award, GitMerge, CheckCircle, Clock, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function useWorkspaceLocale() {
  const { i18n } = useTranslation();
  return (i18n.resolvedLanguage ?? i18n.language) === 'ar' ? 'ar-JO' : 'en-US';
}

function TimelineTab({
  timeline
}: {
  timeline: DevelopmentTimelinePoint[];
}) {
  const locale = useWorkspaceLocale();
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl text-espresso font-serif">Development Timeline</h3>
      </div>

      {timeline.length === 0 ? (
        <EmptyState icon={Clock} title="No timeline data" description="Approved video sessions will appear here as evidence." compact />
      ) : (
        <div className="relative border-l-2 border-cream-200 ml-4 pl-6 space-y-8 py-4">
          {timeline.map((tp, idx) => (
            <div key={`${tp.sessionId}-${idx}`} className="relative">
              <div className="absolute -left-[35px] top-1 w-4 h-4 rounded-full border-2 border-primary-500 bg-white" />
              <div className="text-xs font-bold text-primary-600 mb-1">{formatDate(tp.approvedAt, locale)}</div>
              <SurfaceCard className="p-4 inline-block min-w-full max-w-xl">
                <div className="font-bold text-espresso mb-1">{tp.title}</div>
                <div className="text-sm text-text-secondary flex gap-3 items-center flex-wrap">
                  <span className="bg-cream-100 px-2 py-0.5 rounded text-xs">{tp.category}</span>
                  <span className="w-1 h-1 rounded-full bg-cream-300" />
                  <span className="font-semibold">Score: {tp.score}</span>
                </div>
                {tp.exerciseContext && (
                  <div className="mt-3 text-sm italic text-text-secondary border-l-2 border-cream-200 pl-3">
                    {tp.exerciseContext}
                  </div>
                )}
              </SurfaceCard>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlansTab({
  riderId,
  plans,
  timeline,
  horses,
  actions,
  refetch
}: {
  riderId: string;
  plans: TrainingPlan[];
  timeline: DevelopmentTimelinePoint[];
  horses: {id: string, name: string}[];
  actions: ReturnType<typeof useVideoRelease3Actions>;
  refetch: () => void;
}) {
  const locale = useWorkspaceLocale();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<TrainingPlan> | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [title, setTitle] = useState('');
  const [cycleType, setCycleType] = useState<'monthly'|'term'|'yearly'>('monthly');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [targetText, setTargetText] = useState('');
  const [horseId, setHorseId] = useState('');
  const [status, setStatus] = useState<TrainingPlan['status']>('draft');

  const openNew = () => {
    setEditingPlan(null);
    setTitle('');
    setCycleType('monthly');
    setPeriodStart('');
    setPeriodEnd('');
    setTargetText('');
    setHorseId('');
    setStatus('draft');
    setModalOpen(true);
  };

  const openEdit = (p: TrainingPlan) => {
    setEditingPlan(p);
    setTitle(p.title);
    setCycleType(p.cycleType);
    setPeriodStart(p.periodStart.slice(0, 10));
    setPeriodEnd(p.periodEnd.slice(0, 10));
    setTargetText(p.targetText);
    setHorseId(p.horseId ?? '');
    setStatus(p.status);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!title || !periodStart || !periodEnd || !targetText) return;
    setSaving(true);
    const res = await actions.savePlan({
      riderId,
      title,
      cycleType,
      periodStart,
      periodEnd,
      targetText,
      horseId: horseId || null,
      planId: editingPlan?.id,
      status
    });
    setSaving(false);
    if (res === null) return;
    setModalOpen(false);
    refetch();
  };

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkPlanId, setLinkPlanId] = useState('');
  const [linkSessionId, setLinkSessionId] = useState('');
  const [linkNote, setLinkNote] = useState('');

  const openLink = (p: TrainingPlan) => {
    setLinkPlanId(p.id);
    setLinkSessionId('');
    setLinkNote('');
    setLinkModalOpen(true);
  };

  const handleLink = async () => {
    if (!linkPlanId || !linkSessionId) return;
    setSaving(true);
    const res = await actions.linkPlanEvidence(linkPlanId, linkSessionId, linkNote);
    setSaving(false);
    if (res === null) return;
    setLinkModalOpen(false);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl text-espresso font-serif">Training Plans</h3>
        <PrimaryButton onClick={openNew}><Plus className="w-4 h-4"/> New Plan</PrimaryButton>
      </div>

      {plans.length === 0 ? (
        <EmptyState icon={Target} title="No plans" description="Create a training plan to track goals." compact />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map(p => (
            <SurfaceCard key={p.id} className="p-5 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-espresso line-clamp-1" title={p.title}>{p.title}</h4>
                <StatusBadge status={p.status} />
              </div>
              <div className="text-sm text-text-secondary mb-4 line-clamp-3 flex-1">{p.targetText}</div>
              <div className="flex flex-wrap gap-2 text-xs text-text-secondary mb-4">
                <span className="bg-cream-100 px-2 py-1 rounded capitalize">{p.cycleType}</span>
                <span className="bg-cream-100 px-2 py-1 rounded">{formatDate(p.periodStart, locale)} - {formatDate(p.periodEnd, locale)}</span>
                <span className="bg-cream-100 px-2 py-1 rounded">{p.evidenceCount} evidence linked</span>
              </div>
              <div className="flex gap-2 mt-auto pt-2 border-t border-cream-100">
                <OutlineButton onClick={() => openEdit(p)} className="flex-1 py-1.5 min-h-9">Edit</OutlineButton>
                <OutlineButton onClick={() => openLink(p)} className="flex-1 py-1.5 min-h-9">Link</OutlineButton>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingPlan ? "Edit Plan" : "New Plan"} size="lg"
        footer={
          <>
            <OutlineButton onClick={() => setModalOpen(false)}>Cancel</OutlineButton>
            <PrimaryButton onClick={handleSave} disabled={saving}>{saving ? <BusyLabel label="Saving..." /> : "Save Plan"}</PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          {actions.error && <ErrorState message={actions.error} />}
          <div>
            <label className={labelClass}>Title</label>
            <input className={fieldClass} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Cycle Type</label>
              <select className={fieldClass} value={cycleType} onChange={e => setCycleType(e.target.value as any)}>
                <option value="monthly">Monthly</option>
                <option value="term">Term</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Horse (Optional)</label>
              <select className={fieldClass} value={horseId} onChange={e => setHorseId(e.target.value)}>
                <option value="">Any</option>
                {horses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Start Date</label>
              <input type="date" className={fieldClass} value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>End Date</label>
              <input type="date" className={fieldClass} value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Target Goals</label>
            <textarea className={`${fieldClass} h-32`} value={targetText} onChange={e => setTargetText(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select className={fieldClass} value={status} onChange={e => setStatus(e.target.value as any)}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </Modal>

      <Modal open={linkModalOpen} onClose={() => setLinkModalOpen(false)} title="Link Evidence"
        footer={
          <>
            <OutlineButton onClick={() => setLinkModalOpen(false)}>Cancel</OutlineButton>
            <PrimaryButton onClick={handleLink} disabled={saving || !linkSessionId}>{saving ? <BusyLabel label="Linking..." /> : "Link Evidence"}</PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          {actions.error && <ErrorState message={actions.error} />}
          <div>
            <label className={labelClass}>Select Evidence</label>
            <select className={fieldClass} value={linkSessionId} onChange={e => setLinkSessionId(e.target.value)}>
              <option value="">Choose an approved session...</option>
              {timeline.map(tp => <option key={tp.sessionId} value={tp.sessionId}>{tp.title} ({formatDate(tp.approvedAt, locale)})</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Coach Note (Optional)</label>
            <textarea className={`${fieldClass} h-24`} value={linkNote} onChange={e => setLinkNote(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function BenchmarksTab({
  riderId,
  benchmarks,
  timeline,
  horses,
  actions,
  refetch
}: {
  riderId: string;
  benchmarks: Benchmark[];
  timeline: DevelopmentTimelinePoint[];
  horses: {id: string, name: string}[];
  actions: ReturnType<typeof useVideoRelease3Actions>;
  refetch: () => void;
}) {
  const locale = useWorkspaceLocale();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [family, setFamily] = useState<'foundation'|'show_jumping'>('foundation');
  const [level, setLevel] = useState('1');
  const [evidenceSessionId, setEvidenceSessionId] = useState('');
  const [coachNote, setCoachNote] = useState('');
  const [horseId, setHorseId] = useState('');
  const maxLevel = family === 'show_jumping' ? 5 : 10;

  const handleSave = async () => {
    if (!evidenceSessionId) return;
    setSaving(true);
    const res = await actions.confirmBenchmark({
      riderId,
      family,
      level: Math.min(maxLevel, Math.max(1, parseInt(level, 10) || 1)),
       evidenceSessionId,
      horseId: horseId || null,
      coachNote
    });
    setSaving(false);
    if (res === null) return;
    setModalOpen(false);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl text-espresso font-serif">Benchmarks</h3>
        <PrimaryButton onClick={() => setModalOpen(true)}><Plus className="w-4 h-4"/> Confirm Benchmark</PrimaryButton>
      </div>

      {benchmarks.length === 0 ? (
        <EmptyState icon={Award} title="No benchmarks" description="Confirm developmental benchmarks reached." compact />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {benchmarks.map(b => (
            <SurfaceCard key={b.id} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-espresso capitalize">{b.family.replace('_', ' ')} &middot; Level {b.level}</h4>
                  <div className="text-xs text-text-secondary">{formatDate(b.confirmedAt, locale)}</div>
                </div>
              </div>
              {b.coachNote && <p className="text-sm text-text-secondary italic border-l-2 border-cream-200 pl-3">"{b.coachNote}"</p>}
            </SurfaceCard>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Confirm Benchmark" size="lg"
        footer={
          <>
            <OutlineButton onClick={() => setModalOpen(false)}>Cancel</OutlineButton>
            <PrimaryButton onClick={handleSave} disabled={saving || !evidenceSessionId}>{saving ? <BusyLabel label="Saving..." /> : "Confirm Benchmark"}</PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          {actions.error && <ErrorState message={actions.error} />}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Family</label>
              <select className={fieldClass} value={family} onChange={e => {
                const nextFamily = e.target.value as 'foundation' | 'show_jumping';
                setFamily(nextFamily);
                setLevel((current) => String(Math.min(nextFamily === 'show_jumping' ? 5 : 10, Math.max(1, parseInt(current, 10) || 1))));
              }}>
                <option value="foundation">Foundation</option>
                <option value="show_jumping">Show Jumping</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Level</label>
              <input type="number" min="1" max={maxLevel} className={fieldClass} value={level} onChange={e => setLevel(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Horse (Optional)</label>
            <select className={fieldClass} value={horseId} onChange={e => setHorseId(e.target.value)}>
              <option value="">Any</option>
              {horses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Evidence Session</label>
            <select className={fieldClass} value={evidenceSessionId} onChange={e => setEvidenceSessionId(e.target.value)}>
              <option value="">Select an approved session...</option>
              {timeline.map(tp => <option key={tp.sessionId} value={tp.sessionId}>{tp.title} ({formatDate(tp.approvedAt, locale)})</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Coach Note</label>
            <textarea className={`${fieldClass} h-24`} value={coachNote} onChange={e => setCoachNote(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MilestonesTab({
  riderId,
  milestones,
  timeline,
  horses,
  actions,
  refetch
}: {
  riderId: string;
  milestones: Milestone[];
  timeline: DevelopmentTimelinePoint[];
  horses: {id: string, name: string}[];
  actions: ReturnType<typeof useVideoRelease3Actions>;
  refetch: () => void;
}) {
  const locale = useWorkspaceLocale();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [title, setTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [detail, setDetail] = useState('');
  const [horseId, setHorseId] = useState('');
  const [evidenceSessionId, setEvidenceSessionId] = useState('');

  const handleSave = async () => {
    if (!title || !milestoneDate) return;
    setSaving(true);
    const res = await actions.createMilestone({
      riderId,
      title,
      milestoneDate,
      detail,
      horseId: horseId || null,
       evidenceSessionId: evidenceSessionId || null
    });
    setSaving(false);
    if (res === null) return;
    setModalOpen(false);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl text-espresso font-serif">Milestones</h3>
        <PrimaryButton onClick={() => setModalOpen(true)}><Plus className="w-4 h-4"/> Log Milestone</PrimaryButton>
      </div>

      {milestones.length === 0 ? (
        <EmptyState icon={CheckCircle} title="No milestones" description="Log major milestones in the rider's journey." compact />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {milestones.map(m => (
            <SurfaceCard key={m.id} className="p-5 flex gap-4 items-start">
              <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 mt-1">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-espresso text-lg">{m.title}</h4>
                <div className="text-sm font-semibold text-primary-600 mb-2">{formatDate(m.milestoneDate, locale)}</div>
                {m.detail && <p className="text-sm text-text-secondary leading-relaxed">{m.detail}</p>}
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Milestone" size="lg"
        footer={
          <>
            <OutlineButton onClick={() => setModalOpen(false)}>Cancel</OutlineButton>
            <PrimaryButton onClick={handleSave} disabled={saving || !title || !milestoneDate}>{saving ? <BusyLabel label="Saving..." /> : "Save Milestone"}</PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          {actions.error && <ErrorState message={actions.error} />}
          <div>
            <label className={labelClass}>Title</label>
            <input className={fieldClass} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Date</label>
            <input type="date" className={fieldClass} value={milestoneDate} onChange={e => setMilestoneDate(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Detail</label>
            <textarea className={`${fieldClass} h-24`} value={detail} onChange={e => setDetail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Horse (Optional)</label>
              <select className={fieldClass} value={horseId} onChange={e => setHorseId(e.target.value)}>
                <option value="">Any</option>
                {horses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Linked Evidence (Optional)</label>
              <select className={fieldClass} value={evidenceSessionId} onChange={e => setEvidenceSessionId(e.target.value)}>
                <option value="">None</option>
                {timeline.map(tp => <option key={tp.sessionId} value={tp.sessionId}>{tp.title} ({formatDate(tp.approvedAt, locale)})</option>)}
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ComparisonsTab({
  riderId,
  comparisons,
  timeline,
  horses,
  actions,
  refetch
}: {
  riderId: string;
  comparisons: DevelopmentComparison[];
  timeline: DevelopmentTimelinePoint[];
  horses: {id: string, name: string}[];
  actions: ReturnType<typeof useVideoRelease3Actions>;
  refetch: () => void;
}) {
  const locale = useWorkspaceLocale();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [firstSessionId, setFirstSessionId] = useState('');
  const [secondSessionId, setSecondSessionId] = useState('');
  const [summary, setSummary] = useState('');
  const [horseId, setHorseId] = useState('');

  const handleSave = async () => {
    if (!firstSessionId || !secondSessionId || !summary) return;
    setSaving(true);
    const res = await actions.createComparison({
      riderId,
      firstSessionId,
      secondSessionId,
      summary,
      horseId: horseId || null
    });
    setSaving(false);
    if (res === null) return;
    setModalOpen(false);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl text-espresso font-serif">Development Comparisons</h3>
        <PrimaryButton onClick={() => setModalOpen(true)}><Plus className="w-4 h-4"/> New Comparison</PrimaryButton>
      </div>

      {comparisons.length === 0 ? (
        <EmptyState icon={GitMerge} title="No comparisons" description="Compare two video sessions to highlight development." compact />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {comparisons.map(c => {
            const first = timeline.find(t => t.sessionId === c.firstSessionId);
            const second = timeline.find(t => t.sessionId === c.secondSessionId);
            return (
              <SurfaceCard key={c.id} className="p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary-300" />
                <div className="flex items-center gap-3 mb-4 p-3 bg-cream-50 rounded-xl border border-cream-100">
                  <div className="flex-1 truncate text-sm font-bold text-espresso text-right">{first?.title ?? 'Unknown Session'}</div>
                  <div className="w-8 h-8 rounded-full bg-white border border-cream-200 flex items-center justify-center shrink-0 shadow-sm">
                    <GitMerge className="w-4 h-4 text-primary-500" />
                  </div>
                  <div className="flex-1 truncate text-sm font-bold text-espresso">{second?.title ?? 'Unknown Session'}</div>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed mb-3">{c.summary}</p>
                <div className="text-xs text-text-secondary">Created {formatDate(c.createdAt, locale)}</div>
              </SurfaceCard>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Comparison" size="lg"
        footer={
          <>
            <OutlineButton onClick={() => setModalOpen(false)}>Cancel</OutlineButton>
            <PrimaryButton onClick={handleSave} disabled={saving || !firstSessionId || !secondSessionId || !summary}>{saving ? <BusyLabel label="Saving..." /> : "Create Comparison"}</PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          {actions.error && <ErrorState message={actions.error} />}
          <div>
            <label className={labelClass}>Horse (Optional)</label>
            <select className={fieldClass} value={horseId} onChange={e => setHorseId(e.target.value)}>
              <option value="">Any</option>
              {horses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4 p-4 bg-cream-50 rounded-xl border border-cream-100">
            <div>
              <label className={labelClass}>First Session (Earlier)</label>
              <select className={fieldClass} value={firstSessionId} onChange={e => setFirstSessionId(e.target.value)}>
                <option value="">Select session...</option>
                {timeline.map(tp => <option key={tp.sessionId} value={tp.sessionId}>{tp.title} ({formatDate(tp.approvedAt, locale)})</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Second Session (Later)</label>
              <select className={fieldClass} value={secondSessionId} onChange={e => setSecondSessionId(e.target.value)}>
                <option value="">Select session...</option>
                {timeline.map(tp => <option key={tp.sessionId} value={tp.sessionId}>{tp.title} ({formatDate(tp.approvedAt, locale)})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Development Summary</label>
            <textarea className={`${fieldClass} h-32`} value={summary} onChange={e => setSummary(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ReportsTab({
  riderId,
  reports,
  timeline,
  actions,
  refetch
}: {
  riderId: string;
  reports: CoachReport[];
  timeline: DevelopmentTimelinePoint[];
  actions: ReturnType<typeof useVideoRelease3Actions>;
  refetch: () => void;
}) {
  const locale = useWorkspaceLocale();
  const [modalOpen, setReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<Partial<CoachReport> | null>(null);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [contentEn, setContentEn] = useState('');
  const [contentAr, setContentAr] = useState('');

  const openNew = () => {
    setEditingReport({});
    setPeriodStart('');
    setPeriodEnd('');
    setTitleEn('');
    setTitleAr('');
    setContentEn('');
    setContentAr('');
    setSourceIds([]);
    setReportModalOpen(true);
  };

  const openEdit = (r: CoachReport) => {
    setEditingReport(r);
    setPeriodStart(r.periodStart.slice(0, 10));
    setPeriodEnd(r.periodEnd.slice(0, 10));
    setTitleEn(r.titleEn);
    setTitleAr(r.titleAr);
    setContentEn(r.contentEn);
    setContentAr(r.contentAr);
    setSourceIds([]); // User must re-select evidence to save changes to ensure intent
    setReportModalOpen(true);
  };

  const handleSave = async (statusToSet?: "approved") => {
    if (!periodStart || !periodEnd || !titleEn || !titleAr || !contentEn || !contentAr || sourceIds.length === 0) return;
    setSaving(true);
    const res = await actions.saveReport({
      riderId,
      periodStart,
      periodEnd,
      titleEn,
      titleAr,
      contentEn,
      contentAr,
      sourceSessionIds: sourceIds,
      reportId: editingReport?.id
    });
    if (res === null) {
      setSaving(false);
      return;
    }
    if (statusToSet === "approved") {
      const approveRes = await actions.approveReport(res);
      if (approveRes === null) {
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setReportModalOpen(false);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl text-espresso font-serif">Coach Reports</h3>
        <PrimaryButton onClick={openNew}><Plus className="w-4 h-4"/> New Report</PrimaryButton>
      </div>
      
      {reports.length === 0 ? (
        <EmptyState icon={FileText} title="No reports yet" description="Create bilingual coach reports backed by video evidence." compact />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reports.map(r => (
            <SurfaceCard key={r.id} className="p-5 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 min-w-0 pr-4">
                  <h4 className="font-bold text-espresso truncate">{r.titleEn}</h4>
                  <p className="text-sm text-text-secondary dir-rtl text-right truncate mt-1" dir="rtl">{r.titleAr}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="text-sm text-text-secondary mb-4 flex-1">
                {formatDate(r.periodStart, locale)} - {formatDate(r.periodEnd, locale)} &middot; {r.sourceCount} sources cited
              </div>
              {r.status === 'draft' && (
                <OutlineButton onClick={() => openEdit(r)} className="w-full mt-auto">Edit & Approve</OutlineButton>
              )}
            </SurfaceCard>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setReportModalOpen(false)} title={editingReport?.id ? "Edit Report" : "New Report"} size="xl"
        footer={
          <>
            <OutlineButton onClick={() => setReportModalOpen(false)}>Cancel</OutlineButton>
            <OutlineButton onClick={() => handleSave()} disabled={saving || sourceIds.length === 0}>
              {saving ? <BusyLabel label="Saving..." /> : "Save Draft"}
            </OutlineButton>
            <PrimaryButton onClick={() => handleSave('approved')} disabled={saving || sourceIds.length === 0}>
              {saving ? <BusyLabel label="Approving..." /> : "Save & Approve"}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          {actions.error && <ErrorState message={actions.error} />}
          <div className="grid grid-cols-2 gap-4 bg-cream-50 p-4 rounded-xl border border-cream-100">
            <div>
              <label className={labelClass}>Period Start</label>
              <input type="date" className={fieldClass} value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Period End</label>
              <input type="date" className={fieldClass} value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Title (English)</label>
              <input className={fieldClass} value={titleEn} onChange={e => setTitleEn(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Title (Arabic)</label>
              <input className={fieldClass} value={titleAr} onChange={e => setTitleAr(e.target.value)} dir="rtl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Content (English)</label>
              <textarea className={`${fieldClass} h-40 resize-none`} value={contentEn} onChange={e => setContentEn(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Content (Arabic)</label>
              <textarea className={`${fieldClass} h-40 resize-none`} value={contentAr} onChange={e => setContentAr(e.target.value)} dir="rtl" />
            </div>
          </div>
          
          <div className="pt-2 border-t border-cream-100 mt-2">
            <h4 className="font-bold text-espresso mb-2">Cite Approved Evidence <span className="text-error-500">*</span></h4>
            <div className="max-h-48 overflow-y-auto border border-cream-200 rounded-xl p-2 bg-cream-50">
              {timeline.length === 0 ? (
                <p className="text-sm text-text-secondary p-4 text-center">No approved video evidence available to cite.</p>
              ) : (
                <div className="space-y-1">
                  {timeline.map(tp => (
                    <label key={tp.sessionId} className="flex items-center gap-3 p-3 hover:bg-white rounded-lg cursor-pointer border border-transparent hover:border-cream-200 transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-cream-300"
                        checked={sourceIds.includes(tp.sessionId)}
                        onChange={(e) => {
                          if (e.target.checked) setSourceIds(prev => [...prev, tp.sessionId]);
                          else setSourceIds(prev => prev.filter(id => id !== tp.sessionId));
                        }}
                      />
                      <div className="text-sm min-w-0">
                        <div className="font-semibold text-espresso truncate">{tp.title}</div>
                        <div className="text-xs text-text-secondary mt-0.5">{tp.category} &middot; Score: {tp.score} &middot; {formatDate(tp.approvedAt, locale)}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const TABS = [
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'plans', label: 'Training Plans', icon: Target },
  { id: 'benchmarks', label: 'Benchmarks', icon: Award },
  { id: 'milestones', label: 'Milestones', icon: CheckCircle },
  { id: 'comparisons', label: 'Comparisons', icon: GitMerge },
  { id: 'reports', label: 'Coach Reports', icon: FileText },
] as const;

export function VideoDevelopmentWorkspace() {
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['id']>('timeline');

  const { data: riders, loading: ridersLoading, error: ridersError } = useVideoRelease2PilotRiders();
  const { data: horses, loading: horsesLoading, error: horsesError } = useHorses();

  const { data: devData, loading: devLoading, error: devError, refetch: devRefetch } = useVideoRelease3Development(selectedRiderId, selectedHorseId);
  const actions = useVideoRelease3Actions();

  const timeline = devData?.timeline || [];
  const plans = devData?.plans || [];
  const benchmarks = devData?.benchmarks || [];
  const milestones = devData?.milestones || [];
  const comparisons = devData?.comparisons || [];
  const reports = devData?.reports || [];

  const handleRetry = () => {
    devRefetch();
  };

  const renderError = (err: any) => {
    const msg = typeof err === 'string' ? err : err?.message || "Failed to load data";
    return <ErrorState message={msg} onRetry={handleRetry} retryLabel="Retry" />;
  };

  return (
    <div className="bg-cream-50 min-h-[600px] flex flex-col rounded-2xl border border-cream-200 overflow-hidden shadow-sm">
      {/* Workspace Header Configuration */}
      <div className="bg-white p-5 md:p-6 border-b border-cream-200 flex flex-col md:flex-row gap-5 md:items-end">
        <div className="flex-1 w-full max-w-sm">
          <label className={labelClass}>Assigned Adult Rider</label>
          {ridersLoading ? (
            <div className="mt-1.5 h-11 w-full animate-pulse bg-cream-100 rounded-xl" />
          ) : (
            <select
              className={fieldClass}
              value={selectedRiderId ?? ''}
              onChange={(e) => setSelectedRiderId(e.target.value || null)}
            >
              <option value="">Select Rider...</option>
              {riders?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          {ridersError && <div className="text-xs text-error-600 mt-1">Failed to load riders</div>}
        </div>
        
        <div className="flex-1 w-full max-w-sm">
          <label className={labelClass}>Filter by Horse (Optional)</label>
          {horsesLoading ? (
            <div className="mt-1.5 h-11 w-full animate-pulse bg-cream-100 rounded-xl" />
          ) : (
            <select
              className={fieldClass}
              value={selectedHorseId ?? ''}
              onChange={(e) => setSelectedHorseId(e.target.value || null)}
              disabled={!selectedRiderId}
            >
              <option value="">All Horses</option>
              {horses?.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
          {horsesError && <div className="text-xs text-error-600 mt-1">Failed to load horses</div>}
        </div>
      </div>

      {/* Global Actions Error */}
      {actions.error && (
        <div className="px-6 pt-6 pb-0">
          <ErrorState message={actions.error} />
        </div>
      )}

      {/* Workspace Content Area */}
      {!selectedRiderId ? (
        <div className="flex-1 p-10 flex items-center justify-center">
          <EmptyState icon={Users} title="Select a Rider" description="Choose a rider above to build and manage their longitudinal development record using video evidence." />
        </div>
      ) : devLoading ? (
        <div className="p-8">
          <PageSkeleton cards={4} />
        </div>
      ) : devError ? (
        <div className="p-8">
          {renderError(devError)}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <nav className="w-full md:w-64 lg:w-72 bg-white border-r border-cream-200 shrink-0 p-3 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-y-auto">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              let count = null;
              if (tab.id === 'timeline') count = timeline.length;
              if (tab.id === 'plans') count = plans.length;
              if (tab.id === 'benchmarks') count = benchmarks.length;
              if (tab.id === 'milestones') count = milestones.length;
              if (tab.id === 'comparisons') count = comparisons.length;
              if (tab.id === 'reports') count = reports.length;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
                    isActive 
                      ? 'bg-primary-50 text-primary-700' 
                      : 'text-text-secondary hover:bg-cream-100 hover:text-espresso'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 opacity-80" />
                    {tab.label}
                  </div>
                  {count !== null && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isActive ? 'bg-primary-100 text-primary-800' : 'bg-cream-100 text-text-secondary'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          
          {/* Main Tab Content */}
          <main className="flex-1 p-6 md:p-8 lg:p-10 overflow-y-auto bg-cream-50/50">
            {activeTab === 'timeline' && <TimelineTab timeline={timeline} />}
            {activeTab === 'plans' && <PlansTab riderId={selectedRiderId} plans={plans} timeline={timeline} horses={horses || []} actions={actions} refetch={devRefetch} />}
            {activeTab === 'benchmarks' && <BenchmarksTab riderId={selectedRiderId} benchmarks={benchmarks} timeline={timeline} horses={horses || []} actions={actions} refetch={devRefetch} />}
            {activeTab === 'milestones' && <MilestonesTab riderId={selectedRiderId} milestones={milestones} timeline={timeline} horses={horses || []} actions={actions} refetch={devRefetch} />}
            {activeTab === 'comparisons' && <ComparisonsTab riderId={selectedRiderId} comparisons={comparisons} timeline={timeline} horses={horses || []} actions={actions} refetch={devRefetch} />}
            {activeTab === 'reports' && <ReportsTab riderId={selectedRiderId} reports={reports} timeline={timeline} actions={actions} refetch={devRefetch} />}
          </main>
        </div>
      )}
    </div>
  );
}
