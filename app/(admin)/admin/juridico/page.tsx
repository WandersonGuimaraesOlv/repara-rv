'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Save, X,
} from 'lucide-react'
import {
  getLegalDocumentAction,
  upsertLegalClauseAction,
  deleteLegalClauseAction,
  reorderLegalClausesAction,
  updateLegalDocumentMetaAction,
} from '@/app/actions/legal-admin'
import { LEGAL_DOCUMENT_SLUGS, LEGAL_CLAUSE_ICONS, type LegalDocumentSlug, type LegalClauseIcon } from '@/lib/validations/legal-admin'
import { LEGAL_ICON_MAP } from '@/lib/legal-icons'
import { renderLegalMarkdown } from '@/lib/legal-markdown'
import { toast } from 'sonner'

interface LegalDocument {
  slug: LegalDocumentSlug
  title: string
  version: string
  effective_date: string
  updated_at: string
  updated_by: string | null
}

interface LegalClause {
  id: string
  document_slug: LegalDocumentSlug
  order_index: number
  section_id: string
  title: string
  icon_key: string | null
  body_markdown: string
  created_at: string
  updated_at: string
}

const DOCUMENT_LABELS: Record<LegalDocumentSlug, string> = {
  termos: 'Termos de Uso',
  privacidade: 'Política de Privacidade',
  contrato: 'Contrato do Técnico Parceiro',
}

const EMPTY_CLAUSE_FORM = { id: undefined as string | undefined, section_id: '', title: '', icon_key: '' as string, body_markdown: '' }

function slugifyTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

export default function AdminJuridicoPage() {
  const [activeSlug, setActiveSlug] = useState<LegalDocumentSlug>('termos')
  const [document, setDocument] = useState<LegalDocument | null>(null)
  const [clauses, setClauses] = useState<LegalClause[]>([])
  const [loading, setLoading] = useState(true)

  const [metaForm, setMetaForm] = useState({ title: '', version: '', effective_date: '' })
  const [savingMeta, setSavingMeta] = useState(false)

  const [clauseForm, setClauseForm] = useState(EMPTY_CLAUSE_FORM)
  const [editingClauseOpen, setEditingClauseOpen] = useState(false)
  const [savingClause, setSavingClause] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deletingClause, setDeletingClause] = useState<LegalClause | null>(null)
  const [reordering, setReordering] = useState(false)

  const fetchDocument = useCallback(async (slug: LegalDocumentSlug) => {
    setLoading(true)
    try {
      const res = await getLegalDocumentAction({ slug })
      if (res.success) {
        setDocument((res.document as LegalDocument) ?? null)
        setClauses((res.clauses as LegalClause[]) ?? [])
        if (res.document) {
          const doc = res.document as LegalDocument
          setMetaForm({ title: doc.title, version: doc.version, effective_date: doc.effective_date })
        }
      } else {
        toast.error(res.error || 'Erro ao carregar documento jurídico.')
      }
    } catch {
      toast.error('Erro de conexão ao carregar documento jurídico.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocument(activeSlug)
  }, [activeSlug, fetchDocument])

  const handleSaveMeta = async () => {
    setSavingMeta(true)
    try {
      const res = await updateLegalDocumentMetaAction({ slug: activeSlug, ...metaForm })
      if (res.success) {
        toast.success('Metadados do documento atualizados.')
        fetchDocument(activeSlug)
      } else {
        toast.error(res.error || 'Erro ao salvar metadados.')
      }
    } finally {
      setSavingMeta(false)
    }
  }

  const openNewClause = () => {
    setClauseForm(EMPTY_CLAUSE_FORM)
    setPreviewOpen(false)
    setEditingClauseOpen(true)
  }

  const openEditClause = (clause: LegalClause) => {
    setClauseForm({
      id: clause.id,
      section_id: clause.section_id,
      title: clause.title,
      icon_key: clause.icon_key ?? '',
      body_markdown: clause.body_markdown,
    })
    setPreviewOpen(false)
    setEditingClauseOpen(true)
  }

  const handleSaveClause = async () => {
    if (!clauseForm.title.trim() || !clauseForm.body_markdown.trim()) {
      toast.error('Preencha título e corpo da cláusula.')
      return
    }
    const sectionId = clauseForm.section_id.trim() || slugifyTitle(clauseForm.title)

    setSavingClause(true)
    try {
      const res = await upsertLegalClauseAction({
        id: clauseForm.id,
        document_slug: activeSlug,
        section_id: sectionId,
        title: clauseForm.title.trim(),
        icon_key: (clauseForm.icon_key || null) as LegalClauseIcon | null,
        body_markdown: clauseForm.body_markdown,
      })
      if (res.success) {
        toast.success(clauseForm.id ? 'Cláusula atualizada.' : 'Cláusula criada.')
        setEditingClauseOpen(false)
        fetchDocument(activeSlug)
      } else {
        toast.error(res.error || 'Erro ao salvar cláusula.')
      }
    } finally {
      setSavingClause(false)
    }
  }

  const handleDeleteClause = async () => {
    if (!deletingClause) return
    try {
      const res = await deleteLegalClauseAction({ id: deletingClause.id })
      if (res.success) {
        toast.success('Cláusula excluída.')
        setDeletingClause(null)
        fetchDocument(activeSlug)
      } else {
        toast.error(res.error || 'Erro ao excluir cláusula.')
      }
    } catch {
      toast.error('Erro de conexão ao excluir cláusula.')
    }
  }

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= clauses.length) return

    const reordered = [...clauses]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    setClauses(reordered)
    setReordering(true)
    try {
      const res = await reorderLegalClausesAction({
        document_slug: activeSlug,
        ordered_ids: reordered.map((c) => c.id),
      })
      if (!res.success) {
        toast.error(res.error || 'Erro ao reordenar cláusulas.')
        fetchDocument(activeSlug)
      }
    } finally {
      setReordering(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText size={20} className="text-[var(--color-primary)]" />
            Documentos Jurídicos
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Edite as cláusulas de Termos de Uso, Privacidade e Contrato sem precisar de deploy.
          </p>
        </div>
      </div>

      {/* Abas dos 3 documentos */}
      <div className="flex gap-2 border-b border-[var(--color-border)]">
        {LEGAL_DOCUMENT_SLUGS.map((slug) => (
          <button
            key={slug}
            type="button"
            onClick={() => setActiveSlug(slug)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
              activeSlug === slug
                ? 'bg-[var(--color-surface)] text-[var(--color-primary)] border border-[var(--color-border)] border-b-[var(--color-surface)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {DOCUMENT_LABELS[slug]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-[var(--color-text-muted)] py-8 text-center">Carregando...</div>
      ) : (
        <>
          {/* Metadados do documento */}
          <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wide">Metadados do Documento</h2>
              {document?.updated_at && (
                <span className="text-xs text-[var(--color-text-subtle)]">
                  Última atualização: {new Date(document.updated_at).toLocaleString('pt-BR')}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] block mb-1">Título</label>
                <input
                  type="text"
                  value={metaForm.title}
                  onChange={(e) => setMetaForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border-strong)] rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] block mb-1">Versão</label>
                <input
                  type="text"
                  value={metaForm.version}
                  onChange={(e) => setMetaForm((f) => ({ ...f, version: e.target.value }))}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border-strong)] rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] block mb-1">Data de Vigência</label>
                <input
                  type="date"
                  value={metaForm.effective_date}
                  onChange={(e) => setMetaForm((f) => ({ ...f, effective_date: e.target.value }))}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border-strong)] rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveMeta}
              disabled={savingMeta}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--color-surface-alt)] hover:bg-[var(--color-border-strong)] text-[var(--color-text)] border border-[var(--color-border-strong)] transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {savingMeta ? 'Salvando...' : 'Salvar Metadados'}
            </button>
          </div>

          {/* Lista de cláusulas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wide">
                Cláusulas ({clauses.length})
              </h2>
              <button
                type="button"
                onClick={openNewClause}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white transition-colors"
              >
                <Plus size={14} />
                Nova Cláusula
              </button>
            </div>

            {clauses.length === 0 && (
              <div className="text-sm text-[var(--color-text-subtle)] py-6 text-center border border-dashed border-[var(--color-border)] rounded-2xl">
                Nenhuma cláusula cadastrada ainda para {DOCUMENT_LABELS[activeSlug]}.
              </div>
            )}

            {clauses.map((clause, index) => {
              const IconComponent = clause.icon_key ? LEGAL_ICON_MAP[clause.icon_key] : null
              return (
                <div
                  key={clause.id}
                  className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl p-4 flex items-start gap-3"
                >
                  <span className="shrink-0 w-7 h-7 rounded-full bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] text-xs font-bold flex items-center justify-center mt-0.5">
                    {index + 1}
                  </span>
                  {IconComponent && <IconComponent size={16} className="text-[var(--color-primary)] shrink-0 mt-1.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{clause.title}</p>
                    <p className="text-xs text-[var(--color-text-subtle)] font-mono">#{clause.section_id}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0 || reordering}
                      title="Mover para cima"
                      className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface-alt)] disabled:opacity-30 transition-colors"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === clauses.length - 1 || reordering}
                      title="Mover para baixo"
                      className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface-alt)] disabled:opacity-30 transition-colors"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditClause(clause)}
                      title="Editar"
                      className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-alt)] transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingClause(clause)}
                      title="Excluir"
                      className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-[var(--color-surface-alt)] transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modal de edição/criação de cláusula */}
      {editingClauseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {clauseForm.id ? 'Editar Cláusula' : 'Nova Cláusula'}
              </h3>
              <button type="button" onClick={() => setEditingClauseOpen(false)} className="text-[var(--color-text-muted)] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] block mb-1">Título</label>
              <input
                type="text"
                value={clauseForm.title}
                onChange={(e) => setClauseForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border-strong)] rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:border-[var(--color-primary)]"
                placeholder="Ex: Da Garantia do Serviço de 7 Dias"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] block mb-1">
                  Âncora (id) {clauseForm.id ? '— cuidado: alterar quebra links salvos' : '— gerada automaticamente se vazio'}
                </label>
                <input
                  type="text"
                  value={clauseForm.section_id}
                  onChange={(e) => setClauseForm((f) => ({ ...f, section_id: e.target.value }))}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border-strong)] rounded-lg text-sm text-white px-3 py-2 font-mono focus:outline-none focus:border-[var(--color-primary)]"
                  placeholder="garantia-7-dias"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] block mb-1">Ícone (opcional)</label>
                <select
                  value={clauseForm.icon_key}
                  onChange={(e) => setClauseForm((f) => ({ ...f, icon_key: e.target.value }))}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border-strong)] rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:border-[var(--color-primary)]"
                >
                  <option value="">Sem ícone</option>
                  {LEGAL_CLAUSE_ICONS.map((icon) => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[var(--color-text-muted)]">Corpo (Markdown)</label>
                <button
                  type="button"
                  onClick={() => setPreviewOpen((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:text-[var(--color-primary)]"
                >
                  {previewOpen ? <EyeOff size={13} /> : <Eye size={13} />}
                  {previewOpen ? 'Ocultar prévia' : 'Pré-visualizar'}
                </button>
              </div>
              {previewOpen ? (
                <div
                  className="legal-card bg-[var(--color-bg)] border border-[var(--color-border-strong)] rounded-lg p-4 text-sm text-[var(--color-text)] min-h-[180px] prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderLegalMarkdown(clauseForm.body_markdown || '_Nada para pré-visualizar ainda._') }}
                />
              ) : (
                <textarea
                  value={clauseForm.body_markdown}
                  onChange={(e) => setClauseForm((f) => ({ ...f, body_markdown: e.target.value }))}
                  rows={10}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border-strong)] rounded-lg text-sm text-white px-3 py-2 font-mono focus:outline-none focus:border-[var(--color-primary)]"
                  placeholder="Texto da cláusula em Markdown..."
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingClauseOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveClause}
                disabled={savingClause}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {savingClause ? 'Salvando...' : 'Salvar Cláusula'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {deletingClause && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5">
            <h3 className="text-base font-bold text-white">Excluir cláusula?</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Tem certeza que deseja excluir <strong className="text-[var(--color-text)]">&quot;{deletingClause.title}&quot;</strong>?
              Essa ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingClause(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteClause}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                <Trash2 size={14} />
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
